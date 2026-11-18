import math
from typing import List, Tuple, Dict, Any, Optional
from collections import deque
import numpy as np
import cv2


class FlockDensityCounter:
    """
    Dual-regime flock counting engine:
    1. Bounding-Box Detection Regime: Used in sparse to moderate densities.
    2. Density / Blob Estimation Regime: Engaged automatically when bounding boxes overlap heavily,
       clustering exceeds density thresholds, or detection saturates.
    
    Includes temporal median smoothing over a sliding window to prevent transient camera jitter
    or momentary occlusion from triggering false "Count Drop" alarms.
    Outputs an honest uncertainty range (e.g., 20 ± 2) and the estimation method used.
    """

    def __init__(
        self,
        window_size: int = 7,
        dense_overlap_threshold: float = 0.35,
        nominal_bird_area_px: float = 2400.0,
        history_size: Optional[int] = None,
        **kwargs,
    ):
        if history_size is not None:
            window_size = history_size
        self.window_size = window_size
        self.dense_overlap_threshold = dense_overlap_threshold
        self.nominal_bird_area_px = nominal_bird_area_px
        self._history: deque = deque(maxlen=window_size)
        self._learned_bird_area: float = nominal_bird_area_px

    def update_learned_bird_area(self, isolated_boxes: List[Tuple[float, float, float, float]]) -> None:
        """
        Learns the expected pixel area of an individual bird from non-overlapping boxes in the scene.
        Adapts across broiler growth stages (Day 1 chick ~ 800px vs Day 40 broiler ~ 6000px).
        """
        areas = []
        for box in isolated_boxes:
            w = max(1.0, box[2] - box[0])
            h = max(1.0, box[3] - box[1])
            areas.append(w * h)
        if len(areas) >= 3:
            median_area = float(np.median(areas))
            # Smoothly update learned area with EWMA
            self._learned_bird_area = 0.85 * self._learned_bird_area + 0.15 * median_area

    def estimate_from_plumage_mask(
        self,
        frame_bgr: np.ndarray,
        exclusion_mask: Optional[np.ndarray] = None,
    ) -> Tuple[int, int, int]:
        """
        Computes crowd count from plumage color segmentation and distance transform peaks.
        Returns (estimated_count, min_bound, max_bound).
        """
        hsv = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2HSV)
        # Broiler plumage: high value/luminance, low to moderate saturation
        mask = cv2.inRange(hsv, np.array([0, 0, 125]), np.array([180, 110, 255]))
        
        if exclusion_mask is not None:
            mask = cv2.bitwise_and(mask, mask, mask=cv2.bitwise_not(exclusion_mask))

        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        clean_mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

        total_plumage_px = float(cv2.countNonZero(clean_mask))
        if total_plumage_px < 200:
            return 0, 0, 0

        # Method A: Total plumage area divided by learned individual bird area
        area_count = total_plumage_px / max(400.0, self._learned_bird_area)

        # Method B: Distance transform local maxima (peaks representing bird centroids)
        dist = cv2.distanceTransform(clean_mask, cv2.DIST_L2, 5)
        local_max = cv2.dilate(dist, kernel)
        peaks = (dist == local_max) & (dist > 8.0)
        num_peaks = int(np.count_nonzero(peaks))

        # Blended estimate
        if num_peaks > 0:
            count_est = int(round(0.6 * area_count + 0.4 * num_peaks))
        else:
            count_est = int(round(area_count))

        uncertainty = max(1, int(math.ceil(0.12 * count_est)))
        return count_est, max(0, count_est - uncertainty), count_est + uncertainty

    def estimate(
        self,
        frame_bgr: np.ndarray,
        box_count: int = 0,
        tracks: Optional[List[Any]] = None,
        exclusion_mask: Optional[np.ndarray] = None,
    ) -> Any:
        """
        Convenience estimation method returning typed structure for pipeline integration.
        """
        boxes = []
        if tracks:
            for t in tracks:
                b = getattr(t, "last_bbox", None) or (0, 0, 10, 10)
                boxes.append({"bbox": b})
        elif box_count > 0:
            boxes = [{"bbox": (0, 0, 50, 50)} for _ in range(box_count)]

        res = self.compute_count(boxes, frame_bgr, exclusion_mask)

        class DensityEstimateResult:
            def __init__(self, data: Dict[str, Any]):
                self.count = data["count"]
                self.uncertainty = data["uncertainty"]
                self.count_min = data["count_range"][0]
                self.count_max = data["count_range"][1]
                self.regime = "dense_crowd" if data["density_regime"] == "dense" else "sparse_box"
                self.method = "plumage_density_map" if "density" in data["method"] else "box_tracking"
                self.data = data

        return DensityEstimateResult(res)

    def compute_count(
        self,
        box_detections: List[Dict[str, Any]],
        frame_bgr: np.ndarray,
        exclusion_mask: Optional[np.ndarray] = None,
    ) -> Dict[str, Any]:
        """
        Integrates box detections with density estimation and temporal smoothing.
        Returns:
            Dict containing:
                count: smoothed integer count
                count_range: [min_bound, max_bound]
                uncertainty: integer uncertainty range
                method: "box_detection" | "density_estimation" | "hybrid"
                density_regime: "sparse" | "moderate" | "dense"
        """
        num_boxes = len(box_detections)
        boxes = [d["bbox"] for d in box_detections]

        # Check pairwise overlap to identify whether boxes are merging or saturating
        overlap_count = 0
        isolated_boxes = []
        for i in range(num_boxes):
            b1 = boxes[i]
            is_isolated = True
            for j in range(num_boxes):
                if i == j:
                    continue
                b2 = boxes[j]
                inter_x1 = max(b1[0], b2[0])
                inter_y1 = max(b1[1], b2[1])
                inter_x2 = min(b1[2], b2[2])
                inter_y2 = min(b1[3], b2[3])
                inter = max(0.0, inter_x2 - inter_x1) * max(0.0, inter_y2 - inter_y1)
                a1 = (b1[2] - b1[0]) * (b1[3] - b1[1])
                a2 = (b2[2] - b2[0]) * (b2[3] - b2[1])
                iou = inter / max(1e-6, a1 + a2 - inter)
                if iou > 0.20:
                    overlap_count += 1
                    is_isolated = False
                    break
            if is_isolated:
                isolated_boxes.append(b1)

        self.update_learned_bird_area(isolated_boxes)

        overlap_ratio = overlap_count / max(1, num_boxes)
        density_est, d_min, d_max = self.estimate_from_plumage_mask(frame_bgr, exclusion_mask)

        # Determine regime
        if num_boxes >= 25 or overlap_ratio > self.dense_overlap_threshold or (density_est > num_boxes * 1.3):
            density_regime = "dense"
            # In dense regime, plumage density is more reliable than clustered boxes
            raw_count = max(num_boxes, density_est)
            raw_min = min(num_boxes, d_min)
            raw_max = max(num_boxes, d_max)
            method = "density_estimation" if density_est > num_boxes else "hybrid"
        elif overlap_ratio > 0.15:
            density_regime = "moderate"
            raw_count = int(round(0.65 * num_boxes + 0.35 * density_est))
            raw_min = min(num_boxes, d_min)
            raw_max = max(num_boxes, d_max)
            method = "hybrid"
        else:
            density_regime = "sparse"
            raw_count = num_boxes
            uncertainty = max(1, int(math.ceil(0.05 * raw_count)))
            raw_min = max(0, raw_count - uncertainty)
            raw_max = raw_count + uncertainty
            method = "box_detection"

        # Apply temporal median smoothing across sliding window
        self._history.append((raw_count, raw_min, raw_max))
        smoothed_count = int(round(float(np.median([h[0] for h in self._history]))))
        smoothed_min = int(round(float(np.median([h[1] for h in self._history]))))
        smoothed_max = int(round(float(np.median([h[2] for h in self._history]))))

        uncertainty = max(1, int(math.ceil((smoothed_max - smoothed_min) / 2.0)))

        return {
            "count": smoothed_count,
            "count_range": [smoothed_min, smoothed_max],
            "uncertainty": uncertainty,
            "method": method,
            "density_regime": density_regime,
            "raw_box_count": num_boxes,
            "density_estimate": density_est,
        }
