import time
from contextlib import contextmanager

@contextmanager
def timer():
    t0 = time.perf_counter()
    try:
        yield
    finally:
        t1 = time.perf_counter()
        print(f"[timing] {t1 - t0:.3f}s")

