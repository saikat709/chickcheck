import os
import time
import logging
from typing import Tuple, Optional
import cv2
import numpy as np
from backend.app.sources.base import FrameSource

logger = logging.getLogger("chickcheck.sources.file")


class FileSource(FrameSource):
    """
    Reads a local video file, paces playback to match the video's nominal FPS,
    and loops seamlessly forever to simulate an uninterrupted feed.
    """

    def __init__(self, file_path: str):
        self.file_path = file_path
        self._cap: Optional[cv2.VideoCapture] = None
        self._fps: float = 30.0
        self._total_frames: int = 0
        self._duration: float = 0.0
        self._frame_count: int = 0
        self._loop_count: int = 0
        self._last_read_wall_time: Optional[float] = None
        self._is_open: bool = False

    def open(self) -> None:
        if not os.path.exists(self.file_path):
            raise FileNotFoundError(
                f"Video source file '{self.file_path}' does not exist. "
                f"Please place the video file at this path or configure VIDEO_SOURCE in .env."
            )

        self._cap = cv2.VideoCapture(self.file_path)
        if not self._cap.isOpened():
            raise RuntimeError(
                f"Failed to open video file '{self.file_path}'. "
                f"Please verify that it is a valid video file supported by OpenCV."
            )

        fps = self._cap.get(cv2.CAP_PROP_FPS)
        self._fps = float(fps) if fps and fps > 0 else 30.0
        self._total_frames = int(self._cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if self._total_frames > 0:
            self._duration = self._total_frames / self._fps
        else:
            self._duration = 10.0

        self._frame_count = 0
        self._loop_count = 0
        self._last_read_wall_time = None
        self._is_open = True
        logger.info(
            f"FileSource opened: {self.file_path} (FPS: {self._fps:.2f}, Frames: {self._total_frames}, Duration: {self._duration:.2f}s)"
        )

    def read(self) -> Tuple[np.ndarray, float]:
        if not self._is_open or self._cap is None:
            raise RuntimeError("FileSource is not open. Call open() first.")

        # Pacing: delay to maintain real FPS speed
        frame_interval = 1.0 / self._fps
        now = time.time()
        if self._last_read_wall_time is not None:
            elapsed = now - self._last_read_wall_time
            sleep_needed = frame_interval - elapsed
            if sleep_needed > 0.001:
                time.sleep(sleep_needed)
        self._last_read_wall_time = time.time()

        ret, frame = self._cap.read()
        if not ret or frame is None:
            # Reached end of file: loop back to beginning
            self._loop_count += 1
            self._cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, frame = self._cap.read()
            if not ret or frame is None:
                raise RuntimeError(f"Failed to rewind and read from video file '{self.file_path}'.")

        # Compute monotonic timeline timestamp
        frame_idx_in_loop = int(self._cap.get(cv2.CAP_PROP_POS_FRAMES)) - 1
        if frame_idx_in_loop < 0:
            frame_idx_in_loop = 0
        video_timeline_timestamp = (self._loop_count * self._duration) + (frame_idx_in_loop / self._fps)
        self._frame_count += 1

        return frame, video_timeline_timestamp

    def close(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None
        self._is_open = False
        logger.info(f"FileSource closed: {self.file_path}")

    @property
    def fps(self) -> float:
        return self._fps

    @property
    def is_live(self) -> bool:
        return False

