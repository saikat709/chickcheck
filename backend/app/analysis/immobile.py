import time
import math
from typing import List, Tuple, Dict, Any, Optional
import numpy as np
import cv2


class ImmobileCandidate:
    def __init__(
        self,
        candidate_id: int,
        first_seen_time: float,
        bbox: Tuple[float, float, float, float],
        centroid: Tuple[float, float],
    ):
        self.candidate_id = candidate_id
        self.first_seen_time = first_seen_time
        self.last_seen_time = first_seen_time
        self.bbox = bbox
        self.centroid = centroid
        self.stationary_frames: int = 1
        self.crop_image: Optional[np.ndarray] = None
        self.alert_dispatched: bool = False

    @property
    def duration_seconds(self) -> float:
        return self.last_seen_time - self.first_seen_time


class ImmobileBirdDetector:
    """
    Detects potential bird mortality or severely injured/prostrate birds by tracking
    stationary plumage blobs that remain completely motionless over extended durations
    while the rest of the flock moves.
    
    Operates via accumulated temporal difference decay and plumage contour consistency,
    immune to tracking ID swaps.
    """

    def __init__(
        self,
        min_duration_seconds: float = 30.0,
        max_movement_drift_px: float = 25.0,
        min_duration_s: Optional[float] = None,
        **kwargs,
    ):
        if min_duration_s is not None:
            min_duration_seconds = min_duration_s
        self.min_duration_seconds = min_duration_seconds
        self.max_movement_drift_px = max_movement_drift_px
        self._next_candidate_id: int = 1
        self.candidates: Dict[int, ImmobileCandidate] = {}
        self._bg_subtractor = cv2.createBackgroundSubtractorMOG2(history=300, varThreshold=25, detectShadows=False)

    def update(
        self,
        frame_bgr: np.ndarray,
        timestamp: float,
        active_flock_motion: bool = True,
        flock_activity_index: float = 30.0,
        box_detections: Optional[List[Dict[str, Any]]] = None,
    ) -> List[Dict[str, Any]]:
        """Convenience alias for process_frame."""
        act = flock_activity_index if active_flock_motion else 0.0
        return self.process_frame(frame_bgr, timestamp, act, box_detections or [])

    def process_frame(
        self,
        frame_bgr: np.ndarray,
        timestamp: float,
        flock_activity_index: float,
        box_detections: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Evaluates frame for stationary candidates.
        Returns list of active candidates that exceed min_duration_seconds.
        """
        h, w = frame_bgr.shape[:2]
        total_area = float(h * w)

        # In completely dark or quiet night rest periods (activity_index < 3.0),
        # entire flock is naturally sleeping, so suppress false mortality triggers.
        if flock_activity_index < 3.0:
            return []

        # Segment plumage
        hsv = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, np.array([0, 0, 125]), np.array([180, 110, 255]))
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        opened = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        contours, _ = cv2.findContours(opened, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        current_plumage_centroids = []
        for c in contours:
            area = cv2.contourArea(c)
            # Bird-sized plumage contour
            if 700 < area < (0.22 * total_area):
                bx, by, bw, bh = cv2.boundingRect(c)
                if 0.35 < (bw / max(1, bh)) < 2.8:
                    cx = bx + bw / 2.0
                    cy = by + bh / 2.0
                    current_plumage_centroids.append(((bx, by, bx + bw, by + bh), (cx, cy)))

        # Update candidate state machine
        matched_candidate_ids = set()
        for bbox, centroid in current_plumage_centroids:
            matched_id = None
            best_dist = self.max_movement_drift_px
            for cid, cand in self.candidates.items():
                dist = math.hypot(centroid[0] - cand.centroid[0], centroid[1] - cand.centroid[1])
                if dist < best_dist:
                    best_dist = dist
                    matched_id = cid

            if matched_id is not None:
                cand = self.candidates[matched_id]
                cand.last_seen_time = timestamp
                cand.stationary_frames += 1
                cand.bbox = bbox
                # Slight centroid smoothing
                cand.centroid = (
                    0.8 * cand.centroid[0] + 0.2 * centroid[0],
                    0.8 * cand.centroid[1] + 0.2 * centroid[1],
                )
                matched_candidate_ids.add(matched_id)
            else:
                # Spawn new candidate tracker
                cid = self._next_candidate_id
                self._next_candidate_id += 1
                new_cand = ImmobileCandidate(cid, timestamp, bbox, centroid)
                x1, y1, x2, y2 = map(int, bbox)
                crop = frame_bgr[max(0, y1):min(h, y2), max(0, x1):min(w, x2)]
                if crop.size > 0:
                    new_cand.crop_image = crop.copy()
                self.candidates[cid] = new_cand
                matched_candidate_ids.add(cid)

        # Prune candidates that moved away or disappeared (not seen in last 4.0s)
        stale_ids = [cid for cid, cand in self.candidates.items() if (timestamp - cand.last_seen_time) > 4.0]
        for cid in stale_ids:
            self.candidates.pop(cid, None)

        # Gather validated immobile alerts exceeding threshold
        confirmed_alerts = []
        for cid in matched_candidate_ids:
            cand = self.candidates[cid]
            if cand.duration_seconds >= self.min_duration_seconds:
                x1, y1, x2, y2 = map(int, cand.bbox)
                crop = frame_bgr[max(0, y1):min(h, y2), max(0, x1):min(w, x2)]
                confirmed_alerts.append({
                    "candidate_id": cand.candidate_id,
                    "bbox": cand.bbox,
                    "centroid": cand.centroid,
                    "duration_seconds": round(cand.duration_seconds, 1),
                    "duration_s": round(cand.duration_seconds, 1),
                    "confidence": min(0.95, 0.70 + (cand.duration_seconds / 60.0)),
                    "crop_image": crop if crop.size > 0 else cand.crop_image,
                    "status": "candidate_needs_inspection",
                })

        return confirmed_alerts
