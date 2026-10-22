import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from engine import simulate
import math

result = simulate({'NT_total': 100, 'NT_start': 60, 'NN': 96})
ly = result['lyapunov']
assert ly['status'] == 'finite_time_estimate'
assert ly['samples']
assert math.isfinite(ly['exponent'])
print('lyapunov ok:', ly['exponent'], 'samples:', len(ly['samples']))

# Independent analytic benchmark: x'=a*x has exact exponent a.
import engine
from unittest.mock import patch
class LinearSolver:
    rate = 0.2
    def RK4(self, y, t, dt, params):
        return [v * math.exp(self.rate * dt) for v in y]
for rate in (-0.3, 0.0, 0.2):
    LinearSolver.rate = rate
    with patch.object(engine, 'Solver', LinearSolver):
        benchmark = engine.finite_time_lyapunov({'NN': 100}, [0.]*7, 0.01)
    assert abs(benchmark['exponent'] - rate) < 1e-10
print('PASS: exact stable, neutral and unstable linear exponents')
