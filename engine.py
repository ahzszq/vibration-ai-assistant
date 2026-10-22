"""Local six-state dynamics simulation. No cloud service or API key required."""
import math
import time
from contextvars import ContextVar
from collections import deque
import numpy as np
from physics import DEFAULTS, Solver

REQUEST_DEADLINE = ContextVar('request_deadline', default=None)
REQUEST_PROGRESS = ContextVar('request_progress', default=None)

def correlation_dimension(points, max_points=900, bins=28):
    """Grassberger-Procaccia reference curve from a sampled state trajectory."""
    x = np.asarray(points, dtype=float)
    if x.ndim != 2 or len(x) < 12:
        return dict(status='insufficient_data', samples=[], slope=None, note='末段轨迹点不足，无法估计关联维数。')
    if len(x) > max_points:
        x = x[np.linspace(0, len(x)-1, max_points).astype(int)]
    scale = np.ptp(x, axis=0)
    scale[scale == 0] = 1.0
    z = (x - x.mean(axis=0)) / scale
    dist = np.sqrt(((z[:, None, :] - z[None, :, :]) ** 2).sum(axis=2))
    d = dist[np.triu_indices(len(z), 1)]
    d = d[np.isfinite(d) & (d > 0)]
    if len(d) < 20:
        return dict(status='insufficient_data', samples=[], slope=None, note='轨迹距离不足，无法估计关联维数。')
    radii = np.geomspace(np.percentile(d, 2), np.percentile(d, 80), bins)
    counts = np.array([(d <= r).mean() for r in radii])
    valid = (counts > 0) & (counts < 1)
    lx, ly = np.log(radii[valid]), np.log(counts[valid])
    slope = None
    if len(lx) >= 5:
        lo, hi = max(0, len(lx)//5), max(5, len(lx)*4//5)
        slope = float(np.polyfit(lx[lo:hi], ly[lo:hi], 1)[0])
    return dict(status='reference_curve', samples=np.column_stack([lx, ly]).tolist(), slope=slope,
                dimensions=int(x.shape[1]), point_count=int(len(x)),
                note='Grassberger–Procaccia 参考曲线；斜率受窗口、采样和尺度区间影响，不作为严格维数证明。')

def finite_time_lyapunov(params, initial_state, dt, periods=8, renorm_fraction=0.25, perturbation=1e-8):
    """Estimate the largest finite-time Lyapunov exponent with Benettin renormalization.

    The reference and perturbed trajectories share the same external forcing.  This is
    a local divergence diagnostic for the forced, non-autonomous model; it is not a
    standalone chaos classifier.
    """
    solver = Solver()
    steps = max(16, int(round(float(periods) * params['NN'])))
    interval = max(1, int(round(params['NN'] * renorm_fraction)))
    ref = [float(v) for v in initial_state]
    t = float(ref[0]) if len(ref) == 7 else 0.0
    ref = ref[1:] if len(ref) == 7 else ref
    pert = ref.copy()
    pert[0] += perturbation
    d0 = math.sqrt(sum((a-b)**2 for a,b in zip(pert, ref))) or perturbation
    log_sum = 0.0
    samples = []
    for step in range(1, steps + 1):
        ref = solver.RK4(ref, t, dt, params)
        pert = solver.RK4(pert, t, dt, params)
        t += dt
        if step % interval == 0 or step == steps:
            dist = math.sqrt(sum((a-b)**2 for a,b in zip(pert, ref)))
            if not math.isfinite(dist) or dist <= 0:
                return dict(status='unavailable', exponent=None, samples=[],
                            window_periods=float(periods), note='扰动低于数值分辨率或轨迹发散，无法估计指数。')
            log_sum += math.log(dist / d0)
            elapsed = step * dt
            exponent = log_sum / max(elapsed, dt)
            samples.append([float(t), float(exponent)])
            scale = d0 / dist
            pert = [a + (b-a) * scale for a,b in zip(ref, pert)]
    exponent = float(samples[-1][1]) if samples else 0.0
    return dict(status='finite_time_estimate', exponent=exponent, samples=samples,
                window_periods=float(periods), perturbation=float(perturbation),
                renorm_steps=int(interval), note='有限时间局部轨迹发散率；不自动判定混沌。')

def parameters(values):
    p = dict(DEFAULTS)
    for key, value in values.items():
        if key not in p:
            raise ValueError('未知参数: ' + key)
        n = float(value)
        if not math.isfinite(n):
            raise ValueError('参数必须是有限数值')
        if key in ('NT_total', 'NT_start', 'NN'):
            if not n.is_integer():
                raise ValueError('计算参数必须是整数')
            n = int(n)
        p[key] = n
    if not 10 <= p['NT_total'] <= 40000 or not 32 <= p['NN'] <= 512:
        raise ValueError('总周期需为10–40000，每周期步数需为32–512')
    if not 0 <= p['NT_start'] < p['NT_total'] - 2:
        raise ValueError('开始输出周期须小于总周期减2')
    if not 0.1 <= p['Omegaeh'] <= 5 or not 0 <= p['Omegaet'] <= 5:
        raise ValueError('激励频率超出原型支持范围')
    for key in p:
        if key.startswith(('Epsilon', 'K', 'H')) and p[key] < 0:
            raise ValueError('阻尼、刚度、间隙不能为负')
        if abs(p[key]) > 10000 and key not in ('NT_total', 'NT_start', 'NN'):
            raise ValueError('参数绝对值过大')
    return p

def simulate(values):
    p = parameters(values)
    solver = Solver()
    y = [0.] * 6
    period = 2 * math.pi / p['Omegaeh']
    dt = period / p['NN']
    rows = np.empty(((p['NT_total'] - p['NT_start']) * p['NN'], 3))
    section = []
    output_index = 0
    started = time.perf_counter()
    total = p['NT_total'] * p['NN']
    sample_stride = max(1, math.ceil(len(rows) / 2200))
    state_samples = []
    state_tail = deque(maxlen=8 * p['NN'])
    progress = REQUEST_PROGRESS.get()
    # Preserve the original derivative and RK integration. Timestamp follows the step.
    for step in range(p['NT_total'] * p['NN']):
        if progress and step % 4096 == 0:
            progress(dict(stage='integrating', completed=step, total=total))
        if step % 1024 == 0 and REQUEST_DEADLINE.get() is not None and time.monotonic() > REQUEST_DEADLINE.get():
            raise ValueError('计算超时，请减少周期、步数或实验组数后重试')
        y = solver.RK4(y, step * dt, dt, p)
        if not all(math.isfinite(v) and abs(v) < 1e8 for v in y):
            raise ValueError('积分发散，请减小步长或调整参数')
        if step >= p['NT_start'] * p['NN']:
            state = [(step + 1) * dt, *y]
            state_tail.append(state)
            if output_index % sample_stride == 0:
                state_samples.append(state)
            rows[output_index] = [(step + 1) * dt, y[4], y[5]]
            output_index += 1
            if (step + 1) % p['NN'] == 0:
                section.append([y[4], y[5]])
    a = rows
    if progress:
        progress(dict(stage='analysis', completed=total, total=total))
    signal = a[:, 1]
    centered = signal - signal.mean()
    window = np.hanning(len(signal))
    power = dt * abs(np.fft.rfft(centered * window)) ** 2 / float((window ** 2).sum())
    power[1:-1 if len(signal) % 2 == 0 else None] *= 2
    freq = np.fft.rfftfreq(len(signal), dt)
    peak = int(np.argmax(power[1:]) + 1)
    stride = max(1, math.ceil(len(a) / 2200))
    # A global stride can skip almost whole periods and connect unrelated phases.
    # Keep every integration sample in a short, contiguous final-time window.
    phase_count = min(len(a), 8 * p['NN'])
    phase_rows = a[-phase_count:]
    lyapunov = finite_time_lyapunov(p, list(state_tail)[0], dt,
                                    periods=min(8, phase_count / p['NN']))
    corr = correlation_dimension(phase_rows[:, 1:3])
    segments = np.array_split(a, min(24, len(a)))
    rms_windows = [[float(segment[-1, 0]), float(np.sqrt(np.mean(segment[:, 1] ** 2)))] for segment in segments]
    counts, histogram_edges = np.histogram(signal, bins=24)
    histogram = np.column_stack([(histogram_edges[:-1]+histogram_edges[1:])/2, counts]).tolist()
    # Keep strongest bin per frequency interval to preserve peaks in compact charts.
    edges = np.linspace(0, len(freq), min(len(freq), 2200) + 1, dtype=int)
    bins = [left + int(np.argmax(power[left:right])) for left, right in zip(edges[:-1], edges[1:]) if right > left]
    return dict(params=p, stats=dict(rms=float(np.sqrt(np.mean(signal**2))),
        peak=float(np.max(np.abs(signal))), mean=float(signal.mean()),
        dominant_frequency=float(freq[peak]), points=len(signal), seconds=time.perf_counter()-started),
        spectrum_full=np.column_stack([freq, power]).tolist(),
        spectrum_method='one-sided Hann periodogram; mean removed; density scaling',
        series=a[::stride].tolist(), spectrum=np.column_stack([freq[bins], power[bins]]).tolist(),
        phase=phase_rows[:, 1:3].tolist(),
        states=state_samples, state_tail=list(state_tail),
        analysis=dict(rms_windows=rms_windows, histogram=histogram, correlation_dimension=corr), lyapunov=lyapunov,
        poincare=section, sampling=dict(dt=dt, period=period, chart_stride=stride,
            phase_stride=1, phase_points=phase_count,
            phase_cycles=phase_count / p['NN'],
            phase_time_start=float(phase_rows[0, 0]), phase_time_end=float(phase_rows[-1, 0])))

