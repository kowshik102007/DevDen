import time
import torch


def measure_latency(func, *args, **kwargs):
    start = time.time()
    result = func(*args, **kwargs)
    end = time.time()

    latency = (end - start) * 1000
    return result, latency


def get_memory_usage():
    if torch.cuda.is_available():
        return torch.cuda.memory_allocated() / (1024 ** 2)
    return 0