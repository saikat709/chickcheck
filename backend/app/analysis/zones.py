import math
from typing import List, Tuple, Dict, Any, Optional
import numpy as np
import cv2


class BarnZoneManager:
    """
    Manages user-defined zones (feeder, drinker, resting, exclusion) and perspective calibration.
    Allows farmers to calibrate real barn layouts and monitor zone visits without hardcoded assumptions.
    """

    def __init__(self, zones: Optional[List[Dict[str, Any]]] = None):
        # Default template zones if none configured:
        # e.g., feeder in center/lower-mid, drinker along top, resting on sides
        self.zones: List[Dict[str, Any]] = zones or [
            {
                "name": "feeder_zone",
                "type": "feeder",
                "polygon": [[0.25, 0.20], [0.75, 0.20], [0.75, 0.80], [0.25, 0.80]],
            },
            {
                "name": "resting_zone",
                "type": "resting",
                "polygon": [[0.0, 0.0], [0.25, 0.0], [0.25, 1.0], [0.0, 1.0]],
            },
            {
                "name": "drinker_zone",
                "type": "drinker",
                "polygon": [[0.75, 0.0], [1.0, 0.0], [1.0, 1.0], [0.75, 1.0]],
            },
        ]

    def update_zones(self, new_zones: List[Dict[str, Any]]) -> None:
        self.zones = new_zones

    def point_in_zone(self, point_norm: Tuple[float, float], polygon_norm: List[List[float]]) -> bool:
        """Point in polygon check using ray casting in normalized [0, 1] coordinates."""
        x, y = point_norm
        inside = False
        n = len(polygon_norm)
        p1x, p1y = polygon_norm[0]
        for i in range(n + 1):
            p2x, p2y = polygon_norm[i % n]
            if y > min(p1y, p2y):
                if y <= max(p1y, p2y):
                    if x <= max(p1x, p2x):
                        if p1y != p2y:
                            xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        if p1x == p2x or x <= xinters:
                            inside = not inside
            p1x, p1y = p2x, p2y
        return inside

    def compute_zone_occupancy(
        self,
        bird_centroids_px: List[Tuple[float, float]],
        frame_shape: Tuple[int, int] = (1920, 1080),
    ) -> Dict[str, float]:
        """Returns normalized percentage occupancy per zone category."""
        w, h = frame_shape
        metrics = self.compute_zone_metrics(bird_centroids_px, w, h)
        out = {}
        for name, data in metrics["zones"].items():
            z_type = data.get("type", name)
            out[z_type] = data["percentage"]
        # Ensure standard categories are present
        for k in ["feeder", "drinker", "resting"]:
            if k not in out:
                out[k] = 0.0
        return out

    def compute_zone_metrics(
        self,
        bird_centroids_px: List[Tuple[float, float]],
        frame_width: int,
        frame_height: int,
    ) -> Dict[str, Any]:
        """
        Computes count and occupancy percentage for each zone.
        """
        w = max(1, frame_width)
        h = max(1, frame_height)
        total_birds = len(bird_centroids_px)

        zone_counts = {z["name"]: 0 for z in self.zones}
        zone_occupancy = {}

        for cx, cy in bird_centroids_px:
            nx = cx / float(w)
            ny = cy / float(h)
            for z in self.zones:
                if self.point_in_zone((nx, ny), z["polygon"]):
                    zone_counts[z["name"]] += 1
                    break  # Primary zone assignment

        for z in self.zones:
            name = z["name"]
            c = zone_counts[name]
            pct = round((c / float(total_birds)) * 100.0, 1) if total_birds > 0 else 0.0
            zone_occupancy[name] = {
                "count": c,
                "percentage": pct,
                "type": z.get("type", "general"),
            }

        return {
            "total_birds": total_birds,
            "zones": zone_occupancy,
            "zone_occupancy": zone_occupancy,
        }

    def get_perspective_expected_size(self, y_norm: float, base_size_px: float = 40.0) -> float:
        """
        Estimates expected bird size along the depth axis (tilt angle).
        y_norm: 0.0 (far top) to 1.0 (near bottom).
        """
        # Linear perspective scaling: birds at the top are ~50% the pixel width of birds at the bottom
        depth_scale = 0.5 + 0.5 * np.clip(y_norm, 0.0, 1.0)
        return float(base_size_px * depth_scale)
