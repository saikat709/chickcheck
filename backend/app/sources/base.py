from abc import ABC, abstractmethod
from typing import Tuple
import numpy as np


class FrameSource(ABC):
    """Abstract interface for video frame sources."""

    @abstractmethod
    def open(self) -> None:
        """Initialize and open the video stream or file."""
        pass

    @abstractmethod
    def read(self) -> Tuple[np.ndarray, float]:
        """
        Read the next frame.
        Returns:
            Tuple of (frame_bgr, timestamp_seconds).
        """
        pass

    @abstractmethod
    def close(self) -> None:
        """Release underlying video capture resources."""
        pass

    @property
    @abstractmethod
    def fps(self) -> float:
        """Frame rate of the video source."""
        pass

    @property
    @abstractmethod
    def is_live(self) -> bool:
        """True if the source is a live network stream, False if a local looped file."""
        pass

