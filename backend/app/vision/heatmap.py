import cv2
import numpy as np
from collections import deque
from typing import List, Tuple


class HeatmapAccumulator:
    """
    Maintains a rolling 2D spatial density matrix of livestock positions.
    Renders color-mapped overlays and provides zone density arrays.
    """

    def __init__(self, width: int = 640, height: int = 360, max_points: int = 1500, decay: float = 0.995):
        self.width = width
        self.height = height
        self.max_points = max_points
        self.decay = decay
        self.density_grid = np.zeros((height, width), dtype=np.float32)
        self.points_buffer: deque = deque(maxlen=max_points)

    def update(self, centroids: List[Tuple[float, float]], original_w: int = 1920, original_h: int = 1080) -> None:
        """Decays previous density and splats new centroid observations."""
        self.density_grid *= self.decay

        sx = self.width / max(1, original_w)
        sy = self.height / max(1, original_h)

        for cx, cy in centroids:
            x = int(np.clip(cx * sx, 0, self.width - 1))
            y = int(np.clip(cy * sy, 0, self.height - 1))
            self.points_buffer.append((x, y))

            # Apply a 2D Gaussian splat around each animal
            radius = 12
            x_min = max(0, x - radius)
            x_max = min(self.width, x + radius + 1)
            y_min = max(0, y - radius)
            y_max = min(self.height, y + radius + 1)

            for py in range(y_min, y_max):
                for px in range(x_min, x_max):
                    dist_sq = (px - x) ** 2 + (py - y) ** 2
                    if dist_sq <= radius ** 2:
                        val = np.exp(-dist_sq / (2.0 * (radius / 2.0) ** 2))
                        self.density_grid[py, px] += val

    def get_overlay(self, target_shape: Tuple[int, int, int], colormap: int = cv2.COLORMAP_TURBO) -> np.ndarray:
        """
        Generates an RGB/BGR heatmap overlay resized to target frame dimensions.
        """
        th, tw = target_shape[:2]
        max_val = np.max(self.density_grid)
        if max_val > 0.001:
            norm_density = (self.density_grid / max_val * 255.0).astype(np.uint8)
        else:
            norm_density = np.zeros((self.height, self.width), dtype=np.uint8)

        # Smooth and color-map
        blurred = cv2.GaussianBlur(norm_density, (15, 15), 0)
        color_map = cv2.applyColorMap(blurred, colormap)

        if (tw, th) != (self.width, self.height):
            color_map = cv2.resize(color_map, (tw, th), interpolation=cv2.INTER_LINEAR)
            mask = cv2.resize(blurred, (tw, th), interpolation=cv2.INTER_LINEAR)
        else:
            mask = blurred

        return color_map, mask

    def to_png_bytes(self) -> bytes:
        """Returns PNG encoded representation of the standalone heatmap."""
        max_val = np.max(self.density_grid)
        if max_val > 0.001:
            norm = (self.density_grid / max_val * 255.0).astype(np.uint8)
        else:
            norm = np.zeros((self.height, self.width), dtype=np.uint8)

        blurred = cv2.GaussianBlur(norm, (11, 11), 0)
        color_map = cv2.applyColorMap(blurred, cv2.COLORMAP_TURBO)
        ret, buf = cv2.imencode(".png", color_map)
        return buf.tobytes() if ret else b""

    def to_grid(self, rows: int = 8, cols: int = 8) -> List[List[float]]:
        """Downsamples current density into a discrete rows x cols grid."""
        cell_h = self.height / rows
        cell_w = self.width / cols
        grid = []
        max_val = float(np.max(self.density_grid)) or 1.0

        for r in range(rows):
            row_vals = []
            y1 = int(r * cell_h)
            y2 = int((r + 1) * cell_h)
            for c in range(cols):
                x1 = int(c * cell_w)
                x2 = int((c + 1) * cell_w)
                cell_sum = float(np.sum(self.density_grid[y1:y2, x1:x2]))
                norm_val = round(cell_sum / (max_val * cell_h * cell_w + 1e-5), 3)
                row_vals.append(norm_val)
            grid.append(row_vals)
        return grid

