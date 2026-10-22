"""Reproducible solver and model sensitivity checks; no external model/API needed."""
import argparse
import csv
import json
import math
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from physics import DEFAULTS, Solver
from engine import simulate


class Exponential(Solver):
    def F(self, y, t, params):
        return y.copy()


def integrate(solver, initial, p, end, steps, exact):
    y = initial.copy()
    dt = end / steps
    error = 0.0
    for i in range(steps):
        y = solver.RK4(y, i * dt, dt, p)
        error = max(error, max(abs(a-b) for a, b in zip(y, exact((i+1)*dt))))
    return error


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT / 'validation')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    analytic = []
    # Actual model reduces exactly to y5'' + .04*y5' + y5 = 0.
    p = dict(DEFAULTS, HG=0., K13=0., K23=0., Epsilon13=0., Epsilon23=0.,
             Fah=0., Fat=0., Ffm=0., Ffp=0., Ffb=0.)
    damping = p['Epsilon33']
    omega = math.sqrt(1-damping*damping)

    def exact_oscillator(t):
        decay = math.exp(-damping*t)
        return [0., 0., 0., 0., decay*(math.cos(omega*t)+damping/omega*math.sin(omega*t)),
                -decay*math.sin(omega*t)/omega]

    for name, solver, initial, params, end, exact in [
        ('exponential', Exponential(), [1.]*6, DEFAULTS, 1., lambda t: [math.exp(t)]*6),
        ('model_damped_oscillator', Solver(), [0., 0., 0., 0., 1., 0.], p, 10., exact_oscillator),
    ]:
        previous = None
        for n in (40, 80, 160, 320):
            error = integrate(solver, initial, params, end, n, exact)
            order = math.log2(previous/error) if previous else None
            analytic.append(dict(case=name, steps=n, dt=end/n, max_abs_error=error, observed_order=order))
            previous = error
        assert 3.7 < analytic[-1]['observed_order'] < 4.3, name

    step_rows = []
    for nn in (64, 128, 256, 512):
        r = simulate(dict(NT_total=180, NT_start=80, NN=nn))
        step_rows.append(dict(NN=nn, **r['stats'], dt=r['sampling']['dt']))
    duration_rows = []
    # Fixed 100-cycle observation window; vary discarded transient length.
    for total in (180, 360, 720, 1440):
        r = simulate(dict(NT_total=total, NT_start=total-100, NN=256))
        duration_rows.append(dict(NT_total=total, NT_start=total-100, NN=256, **r['stats']))

    def difference(a, b):
        return {key: abs(a[key]-b[key])/max(abs(b[key]), 1e-15)*100
                for key in ('rms', 'peak', 'dominant_frequency')}

    result = dict(analytic=analytic, step_sensitivity=step_rows,
                  duration_sensitivity=duration_rows,
                  step_256_vs_512_percent=difference(step_rows[-2], step_rows[-1]),
                  duration_last_two_percent=difference(duration_rows[-2], duration_rows[-1]),
                  limits=['NN=512 is a comparison reference, not an exact solution.',
                          'No assertion of steady state, chaos, dimensional units or device accuracy.',
                          'Tests do not certify arbitrary parameter combinations or the browser implementation.'])
    (args.output/'results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    for name, rows in [('analytic', analytic), ('step_sensitivity', step_rows), ('duration_sensitivity', duration_rows)]:
        with (args.output/(name+'.csv')).open('w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)
    def table(rows, keys):
        return '\n'.join(['| '+' | '.join(keys)+' |', '| '+' | '.join(['---']*len(keys))+' |'] +
                         ['| '+' | '.join(f'{row[k]:.8g}' if isinstance(row[k], float) else str(row[k]) for k in keys)+' |' for row in rows])
    step_diff = result['step_256_vs_512_percent']
    duration_diff = result['duration_last_two_percent']
    report = f'''# 数值验证报告

本报告由 `tests/validate_numerics.py` 实际运行生成。原始参数和生产求解器未修改。

## 1. 解析基准

指数方程验证相同 RK 更新器；阻尼振子直接使用生产模型的 `Solver.F`，将间隙、耦合和外力设零，初值 y5=1、其余为零，得到 y5''+0.04 y5'+y5=0。比较全部六个状态在每个积分时刻的最大绝对误差。两项最终观测阶数均须落在 3.7–4.3，否则脚本失败。这验证平滑基准下的四阶收敛，不意味着间隙边界处也保持四阶。

{table(analytic, ['case','steps','dt','max_abs_error','observed_order'])}

## 2. 默认物理参数的步长对照

除计算量外保留原始默认参数；总周期180，丢弃前80周期，分析后100周期。时间均为模型时间。NN=512仅为本次较细步长参考值。

{table(step_rows, ['NN','dt','rms','peak','dominant_frequency'])}

NN=256相对512的差：RMS {step_diff['rms']:.4f}%，峰值 {step_diff['peak']:.4f}%，主频 {step_diff['dominant_frequency']:.4f}%。

## 3. 计算时长对照

NN固定256，输出窗口固定为最后100周期，只改变此前等待长度。固定窗口可以保持频谱分辨率一致。单边PSD分析分辨率为1/(100×2π)，约0.00159155 模型时间⁻¹。

{table(duration_rows, ['NT_total','NT_start','NN','rms','peak','dominant_frequency'])}

最后两组相对差：RMS {duration_diff['rms']:.4f}%，峰值 {duration_diff['peak']:.4f}%，主频 {duration_diff['dominant_frequency']:.4f}%。这些是窗口敏感性数据，不据此自动宣布稳态。

## 4. 如何使用结论

- 解析基准通过，说明求解器在这两项平滑问题上具有预期四阶精度。
- 当前模型含分段间隙力，长时间统计量可能不单调收敛；应同时查看RMS、峰值、主频和多个窗口，不能只凭图形相似判断正确。
- 本次未验证原始20000周期配置的稳态收敛，也未独立认证浏览器版本、关联维数或李雅普诺夫估计。
- 每组拟用于论文的参数应单独做步长加倍、延长瞬态和窗口对照，并声明可接受的差异标准。统计量接近不能单独证明模型与真实设备一致。
- 可运行 `python tests/validate_numerics.py --output validation` 复现；JSON和CSV包含原始指标。
'''
    (args.output/'数值验证报告.md').write_text(report, encoding='utf-8')
    print(json.dumps(dict(analytic='PASS', step_percent=step_diff, duration_percent=duration_diff,
                         output=str(args.output)), ensure_ascii=False))


if __name__ == '__main__':
    main()
