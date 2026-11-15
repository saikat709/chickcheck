import os
import time
import glob
import logging
from collections import deque
from threading import Lock
from typing import Optional, Tuple, List
import cv2
import numpy as np
from backend.app.config import settings

logger = logging.getLogger("chickcheck.services.recorder")


class VideoClipRecorder:
    """
    Maintains a thread-safe circular ring buffer of recent video frames to allow
    instant extraction of pre-and-post event video clips (10-second clips).
    """

    def __init__(self, buffer_seconds: float = 15.0):
        self.buffer_seconds = buffer_seconds
        self.lock = Lock()
        self.buffer: deque = deque()
        self._fps: float = 25.0
        self._recent_clips: Dict[str, Tuple[float, str]] = {}

    def add_frame(self, frame: np.ndarray, timestamp: float, fps: float = 25.0) -> None:
        if frame is None:
            return
        self._fps = fps
        with self.lock:
            # Store scaled-down copy if needed, or frame as-is (e.g. 720p or 640p)
            self.buffer.append((timestamp, frame.copy()))
            # Evict frames older than buffer_seconds
            oldest_allowed = timestamp - self.buffer_seconds
            while self.buffer and self.buffer[0][0] < oldest_allowed:
                self.buffer.popleft()

    def save_snapshot(
        self,
        frame: np.ndarray,
        filename_prefix: str = "snap",
        highlight_bbox: Optional[Tuple[float, float, float, float]] = None,
    ) -> Tuple[str, bytes]:
        """
        Saves a high-quality JPEG snapshot and returns (relative_path, image_bytes).
        """
        os.makedirs(settings.SNAPSHOTS_DIR, exist_ok=True)
        filename = f"{filename_prefix}_{int(time.time() * 1000)}.jpg"
        full_path = os.path.join(settings.SNAPSHOTS_DIR, filename)

        snap = frame.copy()
        if highlight_bbox is not None:
            x1, y1, x2, y2 = map(int, highlight_bbox)
            # Draw red alert bounding highlight
            cv2.rectangle(snap, (x1, y1), (x2, y2), (68, 68, 239), 3, cv2.LINE_AA)

        success, buf = cv2.imencode(".jpg", snap, [cv2.IMWRITE_JPEG_QUALITY, 90])
        if success:
            with open(full_path, "wb") as f:
                f.write(buf.tobytes())
            rel_path = f"snapshots/{filename}"
            return rel_path, buf.tobytes()
        else:
            raise RuntimeError("Failed to encode JPEG snapshot.")

    def export_clip(
        self,
        filename_prefix: str = "clip",
        clip_duration_s: float = 10.0,
    ) -> Optional[str]:
        """
        Extracts recent frames spanning up to clip_duration_s from the ring buffer
        and writes an MP4 file.
        Returns the relative path to the saved clip.
        """
        now = time.time()
        # Throttling: if a clip with this prefix was recorded in the last 6.0 seconds, reuse it
        recent = self._recent_clips.get(filename_prefix)
        if recent and (now - recent[0]) < 6.0:
            return recent[1]

        os.makedirs(settings.CLIPS_DIR, exist_ok=True)
        filename = f"{filename_prefix}_{int(now * 1000)}.mp4"
        full_path = os.path.join(settings.CLIPS_DIR, filename)

        with self.lock:
            if not self.buffer:
                return None
            frames_to_write = list(self.buffer)

        if not frames_to_write:
            return None

        # Filter last clip_duration_s
        end_time = frames_to_write[-1][0]
        start_time = end_time - clip_duration_s
        selected_frames = [f[1] for f in frames_to_write if f[0] >= start_time]

        if not selected_frames:
            selected_frames = [f[1] for f in frames_to_write]

        h, w = selected_frames[0].shape[:2]
        fps = max(10.0, min(60.0, self._fps))

        # Try mp4v codec
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(full_path, fourcc, fps, (w, h))

        if not writer.isOpened():
            # Fallback to XVID
            fourcc = cv2.VideoWriter_fourcc(*"XVID")
            writer = cv2.VideoWriter(full_path, fourcc, fps, (w, h))

        if not writer.isOpened():
            logger.error("Failed to initialize cv2.VideoWriter for clip recording.")
            return None

        for frm in selected_frames:
            # Ensure dimensions match
            if frm.shape[:2] != (h, w):
                frm = cv2.resize(frm, (w, h))
            writer.write(frm)

        writer.release()
        clip_rel = f"clips/{filename}"
        self._recent_clips[filename_prefix] = (now, clip_rel)
        logger.info(f"Recorded incident video clip: {full_path} ({len(selected_frames)} frames)")
        return clip_rel

    @classmethod
    def cleanup_retention(cls, retention_days: int = 7) -> int:
        """
        Deletes snapshot and clip files older than retention_days.
        """
        cutoff_sec = time.time() - (retention_days * 86400)
        deleted_count = 0

        for folder in [settings.SNAPSHOTS_DIR, settings.CLIPS_DIR, settings.REPORTS_DIR]:
            if not os.path.exists(folder):
                continue
            for entry in glob.glob(os.path.join(folder, "*")):
                try:
                    if os.path.isfile(entry) and os.path.getmtime(entry) < cutoff_sec:
                        os.remove(entry)
                        deleted_count += 1
                except Exception as e:
                    logger.warning(f"Failed to remove expired file {entry}: {e}")

        if deleted_count > 0:
            logger.info(f"Retention cleanup: removed {deleted_count} files older than {retention_days} days.")
        return deleted_count

