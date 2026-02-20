from datetime import datetime

def log(*args):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}]", *args)

