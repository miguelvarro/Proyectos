import threading
import time

lock = threading.Lock()
total = 0

def worker(n, iters):
    global total
    local = 0
    for _ in range(iters):
        local += 1
    # sección crítica
    with lock:
        total += local

if __name__ == "__main__":
    threads = []
    t0 = time.perf_counter()

    for i in range(8):
        th = threading.Thread(target=worker, args=(i, 3_000_00))
        th.start()
        threads.append(th)

    for th in threads:
        th.join()

    t1 = time.perf_counter()
    print("total =", total)
    print("time  =", round(t1 - t0, 4), "s")

