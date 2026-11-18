import math
from typing import Tuple, Dict, Any, Optional, List
import numpy as np
import cv2


class FlockFlowAnalyzer:
    """
    Computes dense Farnebäck Optical Flow across poultry sheds to measure collective
    kinetic energy, motion velocity vectors, and spatial activity distribution without
    relying on brittle per-bird tracking IDs.
    
    Operates on a downscaled grayscale representation for real-time CPU speed (<6ms per frame).
    """

    def __init__(
        self,
        grid_rows: int = 8,
        grid_cols: int = 8,
        motion_energy_scale: float = 12.0,
        grid_size: Optional[Tuple[int, int]] = None,
        **kwargs,
    ):
        if grid_size is not None:
            grid_rows, grid_cols = grid_size
        self.grid_rows = grid_rows
        self.grid_cols = grid_cols
        self.motion_energy_scale = motion_energy_scale
        self._prev_gray: Optional[np.ndarray] = None
        self._last_flow: Optional[np.ndarray] = None

    def update(self, frame_bgr: np.ndarray) -> Dict[str, Any]:
        """Convenience alias for process_frame."""
        return self.process_frame(frame_bgr)

    def process_frame(self, frame_bgr: np.ndarray) -> Dict[str, Any]:
        """
        Calculates optical flow between consecutive frames and computes whole-flock
        and per-cell motion metrics.
        """
        h, w = frame_bgr.shape[:2]
        # Downscale for real-time CPU optical flow (target width 320px)
        scale = 320.0 / max(1, w)
        small_w = 320
        small_h = max(1, int(h * scale))
        
        resized = cv2.resize(frame_bgr, (small_w, small_h), interpolation=cv2.INTER_LINEAR)
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        # Apply gentle blur to suppress camera sensor noise and dust speckles
        gray = cv2.GaussianBlur(gray, (5, 5), 0)

        if self._prev_gray is None or self._prev_gray.shape != gray.shape:
            self._prev_gray = gray
            return {
                "activity_index": 0.0,
                "mean_magnitude": 0.0,
                "max_magnitude": 0.0,
                "variance": 0.0,
                "grid_energy": np.zeros((self.grid_rows, self.grid_cols), dtype=np.float32).tolist(),
                "flow_vectors": [],
            }

        # Farnebäck Dense Optical Flow
        flow = cv2.calcOpticalFlowFarneback(
            prev=self._prev_gray,
            next=gray,
            flow=None,
            pyr_scale=0.5,
            levels=3,
            winsize=15,
            iterations=3,
            poly_n=5,
            poly_sigma=1.2,
            flags=0,
        )
        self._prev_gray = gray
        self._last_flow = flow

        # Flow components
        fx = flow[..., 0]
        fy = flow[..., 1]
        mag, ang = cv2.cartToPolar(fx, fy)

        # Threshold sensor noise (sub-pixel jitter < 0.25px)
        mag_filtered = np.where(mag > 0.25, mag, 0.0)

        mean_mag = float(np.mean(mag_filtered))
        max_mag = float(np.max(mag_filtered))
        var_mag = float(np.var(mag_filtered))

        # Normalized Flock Activity Index (0 to 100)
        # 0 = completely still flock resting at night
        # 25-45 = normal diurnal foraging / walking
        # > 75 = rapid mass stampede / panic movement
        activity_index = float(np.clip(mean_mag * self.motion_energy_scale * 10.0, 0.0, 100.0))

        # Spatial Grid Energy Matrix (e.g. 8x8 zones across barn)
        cell_h = small_h / float(self.grid_rows)
        cell_w = small_w / float(self.grid_cols)
        grid_energy = np.zeros((self.grid_rows, self.grid_cols), dtype=np.float32)

        for r in range(self.grid_rows):
            r1 = int(r * cell_h)
            r2 = int((r + 1) * cell_h)
            for c in range(self.grid_cols):
                c1 = int(c * cell_w)
                c2 = int((c + 1) * cell_w)
                cell_crop = mag_filtered[r1:r2, c1:c2]
                if cell_crop.size > 0:
                    grid_energy[r, c] = float(np.mean(cell_crop)) * self.motion_energy_scale

        return {
            "activity_index": round(activity_index, 1),
            "mean_magnitude": round(mean_mag, 3),
            "max_magnitude": round(max_mag, 2),
            "variance": round(var_mag, 3),
            "grid_energy": grid_energy.tolist(),
        }

    def render_flow_overlay(
        self,
        frame_bgr: np.ndarray,
        step: int = 24,
        color: Tuple[int, int, int] = (0, 255, 255),
    ) -> np.ndarray:
        """Alias for render_flow_vectors."""
        return self.render_flow_vectors(frame_bgr, step=step, color=color)

    def render_flow_vectors(
        self,
        frame_bgr: np.ndarray,
        step: int = 24,
        color: Tuple[int, int, int] = (0, 255, 255),
    ) -> np.ndarray:
        """
        Renders optical flow motion vector arrows over the annotated frame.
        Useful for operator visual inspection of flock momentum and flow patterns.
        """
        if self._last_flow is None:
            return frame_bgr

        out = frame_bgr.copy()
        h, w = out.shape[:2]
        flow_h, flow_w = self._last_flow.shape[:2]
        scale_x = w / float(flow_w)
        scale_y = h / float(flow_h)

        for y in range(0, flow_h, step):
            for x in range(0, flow_w, step):
                dx = self._last_flow[y, x, 0]
                dy = self._last_flow[y, x, 1]
                mag = math.hypot(dx, dy)
                if mag > 0.4:
                    orig_x = int(x * scale_x)
                    orig_y = int(y * scale_y)
                    tip_x = int((x + dx * 2.5) * scale_x)
                    tip_y = int((y + dy * 2.5) * scale_y)
                    cv2.arrowedLine(
                        out,
                        (orig_x, orig_y),
                        (tip_x, tip_y),
                        color,
                        1,
                        tipLength=0.3,
                        line_type=cv2.LINE_AA,
                    )

        return out
