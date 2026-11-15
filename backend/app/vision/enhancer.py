import cv2
import numpy as np
from typing import Tuple


class AdaptiveImageEnhancer:
    """
    Preprocessing image enhancement engine for low-resolution, low-contrast,
    or dim livestock surveillance frames (IoT coops, 360p/480p RTSP streams).
    Applies CLAHE on luminance and unsharp masking for edge definition.
    """

    def __init__(
        self,
        clahe_clip_limit: float = 2.5,
        tile_grid_size: Tuple[int, int] = (8, 8),
        sharpen_strength: float = 0.4,
        low_res_threshold_h: int = 540,
        low_res_threshold_w: int = 640,
    ):
        self.clahe_clip_limit = clahe_clip_limit
        self.tile_grid_size = tile_grid_size
        self.sharpen_strength = sharpen_strength
        self.low_res_threshold_h = low_res_threshold_h
        self.low_res_threshold_w = low_res_threshold_w
        self._clahe = cv2.createCLAHE(clipLimit=self.clahe_clip_limit, tileGridSize=self.tile_grid_size)

    def is_low_res_or_degraded(self, frame: np.ndarray) -> bool:
        """
        Determines whether a frame is low-resolution, low-contrast, or underexposed.
        """
        if frame is None or frame.size == 0:
            return False

        h, w = frame.shape[:2]
        # Low resolution check
        if h < self.low_res_threshold_h or w < self.low_res_threshold_w:
            return True

        # Quick check for low contrast / poor dynamic range
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        std_dev = float(np.std(gray))
        if std_dev < 38.0:  # Flat lighting or hazy coop
            return True

        return False

    def enhance(
        self,
        frame: np.ndarray,
        force: bool = False,
        target_inference_dim: int = 640,
    ) -> Tuple[np.ndarray, bool]:
        """
        Enhances the frame if low-resolution/degraded or if force is True.
        Returns:
            Tuple of (enhanced_frame_bgr, was_enhanced: bool).
        """
        if frame is None or frame.size == 0:
            return frame, False

        needs_enhancement = force or self.is_low_res_or_degraded(frame)
        if not needs_enhancement:
            return frame, False

        out = frame

        # 1. Bicubic smart upscaling if dimensions are very small
        h, w = out.shape[:2]
        if min(h, w) < 420:
            scale = max(target_inference_dim / max(1, w), target_inference_dim / max(1, h))
            if scale > 1.0:
                new_w = int(w * scale)
                new_h = int(h * scale)
                out = cv2.resize(out, (new_w, new_h), interpolation=cv2.INTER_CUBIC)

        # 2. CLAHE on Luminance (LAB color space) to rescue shadow/bedding contrast
        lab = cv2.cvtColor(out, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        l_clahe = self._clahe.apply(l)
        lab_enhanced = cv2.merge((l_clahe, a, b))
        out = cv2.cvtColor(lab_enhanced, cv2.COLOR_LAB2BGR)

        # 3. Unsharp Masking for feather & silhouette edge recovery
        if self.sharpen_strength > 0.05:
            blurred = cv2.GaussianBlur(out, (0, 0), sigmaX=2.0)
            out = cv2.addWeighted(
                out,
                1.0 + self.sharpen_strength,
                blurred,
                -self.sharpen_strength,
                0,
            )

        return out, True
