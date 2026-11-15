import time
import logging
from typing import Tuple, Optional
import cv2
import numpy as np
from backend.app.sources.base import FrameSource

logger = logging.getLogger("chickcheck.sources.rtsp")


class RTSPSource(FrameSource):
    """
    Reads an RTSP or HTTP network video stream with automatic reconnect
    and exponential backoff. Uses wall-clock timestamps.
    """

    def __init__(self, stream_url: str):
        self.stream_url = stream_url
        self._cap: Optional[cv2.VideoCapture] = None
        self._fps: float = 25.0
        self._is_open: bool = False
        self._reconnect_delay: float = 1.0
        self._max_reconnect_delay: float = 30.0

    def open(self) -> None:
        self._connect()
        self._is_open = True

    def _connect(self) -> None:
        if self._cap is not None:
            self._cap.release()

        logger.info(f"Connecting to stream: {self.stream_url}...")
        self._cap = cv2.VideoCapture(self.stream_url, cv2.CAP_FFMPEG)
        if not self._cap.isOpened():
            logger.warning(f"Could not connect immediately to {self.stream_url}")
            return

        fps = self._cap.get(cv2.CAP_PROP_FPS)
        if fps and fps > 0:
            self._fps = float(fps)
        self._reconnect_delay = 1.0
        logger.info(f"Connected to stream: {self.stream_url} (FPS: {self._fps:.2f})")

    def read(self) -> Tuple[np.ndarray, float]:
        if not self._is_open:
            raise RuntimeError("RTSPSource is not open. Call open() first.")

        while self._is_open:
            if self._cap is None or not self._cap.isOpened():
                self._handle_reconnect()
                continue

            ret, frame = self._cap.read()
            if not ret or frame is None:
                logger.warning("Frame read failed on stream. Attempting reconnection...")
                self._handle_reconnect()
                continue

            return frame, time.time()

        raise RuntimeError("RTSPSource was closed while reading.")

    def _handle_reconnect(self) -> None:
        logger.info(f"Waiting {self._reconnect_delay:.1f}s before reconnecting to {self.stream_url}...")
        time.sleep(self._reconnect_delay)
        self._reconnect_delay = min(self._max_reconnect_delay, self._reconnect_delay * 2.0)
        self._connect()

    def close(self) -> None:
        self._is_open = False
        if self._cap is not None:
            self._cap.release()
            self._cap = None
        logger.info(f"RTSPSource closed: {self.stream_url}")

    @property
    def fps(self) -> float:
        return self._fps

    @property
    def is_live(self) -> bool:
        return True

