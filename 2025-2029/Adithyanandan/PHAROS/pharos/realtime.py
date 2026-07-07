"""Real-time closed-loop orchestrator — Stage 6."""

import queue
import threading
import time
from pathlib import Path

import numpy as np


class FileCaptureFn:
    """File-based frame source cycling through data/raw/*.png|bmp.
    Drop-in replacement for a real camera SDK until hardware is connected.
    """
    def __init__(self, raw_dir: str, bit_depth: int = 16, loop: bool = True):
        import cv2
        self._cv2 = cv2
        paths = sorted(Path(raw_dir).glob("*.bmp")) + sorted(Path(raw_dir).glob("*.png"))
        if not paths:
            raise FileNotFoundError(f"No frames found in {raw_dir}")
        self._paths = paths
        self._idx = 0
        self._bit_depth = bit_depth
        self._loop = loop

    def __call__(self) -> np.ndarray:
        if self._idx >= len(self._paths):
            if self._loop:
                self._idx = 0
            else:
                return None
        frame = self._cv2.imread(str(self._paths[self._idx]), self._cv2.IMREAD_UNCHANGED)
        self._idx += 1
        if frame is None:
            return None
        return frame.astype(np.float32) / (2 ** self._bit_depth - 1)


class DMLogFn:
    """Stub DM sink — records commands to a numpy array for offline analysis."""
    def __init__(self, n_actuators: int, max_frames: int = 10000):
        self.log = np.zeros((max_frames, n_actuators), dtype=np.float32)
        self._idx = 0

    def __call__(self, commands: np.ndarray):
        if self._idx < len(self.log):
            self.log[self._idx] = commands
            self._idx += 1

    @property
    def recorded(self) -> np.ndarray:
        return self.log[: self._idx]


class PHAROSRealTimeLoop:
    """
    Producer-consumer architecture:
    - Thread 1: capture frames from camera, push to queue
    - Thread 2: process frames (centroid → slopes → reconstruct → actuate)

    Replace _capture_frame and _send_dm_commands with real SDK calls.
    """

    def __init__(self, config: dict, process_fn, capture_fn=None, dm_fn=None):
        self.config = config
        self.frame_queue = queue.Queue(maxsize=4)
        self.running = False
        self._process_fn = process_fn
        self._capture_fn = capture_fn
        self._dm_fn = dm_fn
        self.latencies_ms = []

    def start(self):
        self.running = True
        self.capture_thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.process_thread = threading.Thread(target=self._process_loop, daemon=True)
        self.capture_thread.start()
        self.process_thread.start()

    def stop(self):
        self.running = False
        self.capture_thread.join(timeout=2)
        self.process_thread.join(timeout=2)

    def _capture_loop(self):
        while self.running:
            frame = self._capture_frame()
            if frame is None:
                break
            try:
                self.frame_queue.put_nowait(frame)
            except queue.Full:
                pass  # drop frame

    def _process_loop(self):
        while self.running:
            try:
                frame = self.frame_queue.get(timeout=0.05)
            except queue.Empty:
                continue
            t0 = time.perf_counter()
            commands = self._process_fn(frame)
            self._send_dm_commands(commands)
            elapsed_ms = (time.perf_counter() - t0) * 1000
            self.latencies_ms.append(elapsed_ms)
            if elapsed_ms > 10.0:
                print(f"WARNING: loop latency {elapsed_ms:.1f} ms exceeds 10 ms budget")

    def _capture_frame(self):
        if self._capture_fn is not None:
            return self._capture_fn()
        raise NotImplementedError("Provide capture_fn or override _capture_frame")

    def _send_dm_commands(self, commands):
        if self._dm_fn is not None:
            self._dm_fn(commands)
        # Default: no-op (log only)
