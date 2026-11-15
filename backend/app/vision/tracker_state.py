import math
from collections import deque
from typing import Dict, List, Optional, Tuple, Set
import numpy as np
import cv2


class AnimalTrackState:
    """
    Maintains kinematic, spatial, and behavioral state for a single tracked animal.
    Features bounding box EMA smoothing for low-resolution footage and appearance
    signature histograms for occlusion resilience in dense flocks.
    """

    def __init__(
        self,
        animal_id: int,
        initial_time: float,
        bbox: Tuple[float, float, float, float],
        species: str = "chicken",
        max_history: int = 150,
    ):
        self.animal_id = animal_id
        self.species = species
        self.first_seen = initial_time
        self.last_seen = initial_time
        self.max_history = max_history

        x1, y1, x2, y2 = bbox
        cx = (x1 + x2) / 2.0
        cy = (y1 + y2) / 2.0
        w = max(1.0, x2 - x1)
        h = max(1.0, y2 - y1)
        diag = math.hypot(w, h)
        ar = w / h

        self.last_bbox = bbox
        self.raw_bbox = bbox
        self.last_centroid = (cx, cy)
        self.last_diag = diag

        # Rolling histories: (timestamp, cx, cy, w, h, diag, speed_norm, heading_rad)
        self.history: deque = deque(maxlen=max_history)
        self.history.append((initial_time, cx, cy, w, h, diag, 0.0, 0.0))

        # Trail for rendering
        self.trail: deque = deque(maxlen=30)
        self.trail.append((cx, cy))

        # Aspect ratio history (for fallen posture detection)
        self.aspect_ratios: deque = deque(maxlen=100)
        self.aspect_ratios.append(ar)
        self.baseline_aspect_ratio: float = ar

        # Kinematic metrics
        self.total_distance_px: float = 0.0
        self.total_idle_seconds: float = 0.0
        self.current_idle_seconds: float = 0.0
        self.last_speed_px_s: float = 0.0
        self.last_speed_norm: float = 0.0
        self.last_heading: Optional[float] = None
        self.direction_changes_count: int = 0
        self.direction_change_rate: float = 0.0
        self.bbox_jitter_ratio: float = 0.0

        # Health & Anomaly status
        self.health_score: float = 100.0
        self.status: str = "healthy"  # healthy, watch, alert
        self.active_anomalies: Set[str] = set()
        self.cls_prob_healthy: Optional[float] = None  # Optional classifier probability

        # Appearance signature (16-bin Hue-Saturation color histogram)
        self.appearance_hist: Optional[np.ndarray] = None

    def update_appearance(self, frame_bgr: np.ndarray, bbox: Tuple[float, float, float, float]) -> None:
        """Extracts and updates rolling color histogram for track re-identification."""
        if frame_bgr is None or frame_bgr.size == 0:
            return
        x1, y1, x2, y2 = map(int, bbox)
        h, w = frame_bgr.shape[:2]
        crop = frame_bgr[max(0, y1):min(h, y2), max(0, x1):min(w, x2)]
        if crop.size < 36:
            return

        hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
        hist = cv2.calcHist([hsv], [0, 1], None, [8, 8], [0, 180, 0, 256])
        cv2.normalize(hist, hist, alpha=1.0, norm_type=cv2.NORM_L1)

        if self.appearance_hist is None:
            self.appearance_hist = hist
        else:
            self.appearance_hist = 0.8 * self.appearance_hist + 0.2 * hist

    def update(
        self,
        current_time: float,
        bbox: Tuple[float, float, float, float],
        idle_speed_threshold_norm: float = 0.05,
        species: Optional[str] = None,
        frame_bgr: Optional[np.ndarray] = None,
        smooth_coords: bool = True,
    ) -> None:
        dt = current_time - self.last_seen
        self.last_seen = current_time
        if species:
            self.species = species

        self.raw_bbox = bbox

        # EMA smoothing on bounding box to cancel low-resolution quantization jitter
        if smooth_coords and len(self.history) >= 1:
            alpha = 0.70  # Responsive yet filters 1-2px discretization jump
            sb0 = alpha * bbox[0] + (1 - alpha) * self.last_bbox[0]
            sb1 = alpha * bbox[1] + (1 - alpha) * self.last_bbox[1]
            sb2 = alpha * bbox[2] + (1 - alpha) * self.last_bbox[2]
            sb3 = alpha * bbox[3] + (1 - alpha) * self.last_bbox[3]
            smoothed_bbox = (sb0, sb1, sb2, sb3)
        else:
            smoothed_bbox = bbox

        x1, y1, x2, y2 = smoothed_bbox
        cx = (x1 + x2) / 2.0
        cy = (y1 + y2) / 2.0
        w = max(1.0, x2 - x1)
        h = max(1.0, y2 - y1)
        diag = math.hypot(w, h)
        ar = w / h

        self.last_bbox = smoothed_bbox
        self.aspect_ratios.append(ar)
        # Baseline aspect ratio is the running median of earliest/nominal observations
        if len(self.aspect_ratios) >= 10:
            self.baseline_aspect_ratio = float(np.median(list(self.aspect_ratios)[:20]))
        else:
            self.baseline_aspect_ratio = ar

        # Displacement
        dx = cx - self.last_centroid[0]
        dy = cy - self.last_centroid[1]
        dist_px = math.hypot(dx, dy)
        self.total_distance_px += dist_px
        self.last_centroid = (cx, cy)
        self.last_diag = diag
        self.trail.append((cx, cy))

        # Speed calculation
        if dt > 0.001:
            speed_px_s = dist_px / dt
            speed_norm = speed_px_s / max(1.0, diag)
            self.last_speed_px_s = speed_px_s
            self.last_speed_norm = speed_norm

            # Idle tracking
            if speed_norm < idle_speed_threshold_norm:
                self.current_idle_seconds += dt
                self.total_idle_seconds += dt
            else:
                self.current_idle_seconds = 0.0

            # Direction changes
            if dist_px > 3.0:  # Meaningful motion
                heading = math.atan2(dy, dx)
                if self.last_heading is not None:
                    angle_diff = abs((heading - self.last_heading + math.pi) % (2 * math.pi) - math.pi)
                    if angle_diff > (math.pi / 3.0):  # > 60 degree turn
                        self.direction_changes_count += 1
                self.last_heading = heading

            # Calculate direction change rate over history window
            if len(self.history) >= 5:
                window_dt = current_time - self.history[0][0]
                if window_dt > 1.0:
                    self.direction_change_rate = self.direction_changes_count / window_dt

            # Bounding box jitter proxy (variance of size relative to median)
            recent_diags = [h[5] for h in list(self.history)[-15:]]
            if len(recent_diags) >= 5:
                diags_arr = np.array(recent_diags, dtype=float)
                median_diag = float(np.median(diags_arr))
                mad = float(np.median(np.abs(diags_arr - median_diag)))
                self.bbox_jitter_ratio = mad / max(1.0, median_diag)
        else:
            speed_norm = self.last_speed_norm

        self.history.append((current_time, cx, cy, w, h, diag, speed_norm, self.last_heading or 0.0))

        if frame_bgr is not None:
            self.update_appearance(frame_bgr, smoothed_bbox)

    def is_lost(self, current_time: float, track_lost_seconds: float) -> bool:
        return (current_time - self.last_seen) > track_lost_seconds

    @property
    def current_aspect_ratio_shift(self) -> float:
        """Absolute delta between current aspect ratio and baseline."""
        if not self.aspect_ratios:
            return 0.0
        current_ar = float(np.median(list(self.aspect_ratios)[-3:]))
        return abs(current_ar - self.baseline_aspect_ratio)


class TrackerPool:
    """
    Manages active and historical track states with dense-crowd handling
    and multi-species track persistence.
    """

    def __init__(self, track_lost_seconds: float = 2.5, max_trail_points: int = 30):
        self.track_lost_seconds = track_lost_seconds
        self.max_trail_points = max_trail_points
        self.tracks: Dict[int, AnimalTrackState] = {}
        self.retired_tracks: Dict[int, AnimalTrackState] = {}

    def get_effective_track_lost_seconds(self) -> float:
        """In dense flocks (>12 animals), retain tracks longer during mutual occlusions."""
        if len(self.tracks) >= 12:
            return max(self.track_lost_seconds, 4.0)
        return self.track_lost_seconds

    def update_track(
        self,
        animal_id: int,
        timestamp: float,
        bbox: Tuple[float, float, float, float],
        idle_speed_threshold_norm: float = 0.05,
        species: str = "chicken",
        frame_bgr: Optional[np.ndarray] = None,
        frame: Optional[np.ndarray] = None,
    ) -> AnimalTrackState:
        img = frame if frame is not None else frame_bgr
        if animal_id in self.tracks:
            track = self.tracks[animal_id]
            track.update(timestamp, bbox, idle_speed_threshold_norm, species=species, frame_bgr=img)
        elif animal_id in self.retired_tracks:
            # Re-appearance of a previously retired track
            track = self.retired_tracks.pop(animal_id)
            track.update(timestamp, bbox, idle_speed_threshold_norm, species=species, frame_bgr=img)
            self.tracks[animal_id] = track
        else:
            # Check if this new detection strongly matches a recently retired track by spatial proximity & appearance
            matched_retired_id = None
            if self.retired_tracks and img is not None:
                cx = (bbox[0] + bbox[2]) / 2.0
                cy = (bbox[1] + bbox[3]) / 2.0
                diag = math.hypot(bbox[2] - bbox[0], bbox[3] - bbox[1])
                for ret_id, ret_track in self.retired_tracks.items():
                    if ret_track.species == species and (timestamp - ret_track.last_seen) < 3.0:
                        dist = math.hypot(cx - ret_track.last_centroid[0], cy - ret_track.last_centroid[1])
                        if dist < 1.5 * max(diag, ret_track.last_diag):
                            matched_retired_id = ret_id
                            break

            if matched_retired_id is not None:
                track = self.retired_tracks.pop(matched_retired_id)
                track.update(timestamp, bbox, idle_speed_threshold_norm, species=species, frame_bgr=img)
                self.tracks[matched_retired_id] = track
            else:
                track = AnimalTrackState(animal_id, timestamp, bbox, species=species)
                track.trail = deque(maxlen=self.max_trail_points)
                track.trail.append(((bbox[0] + bbox[2]) / 2.0, (bbox[1] + bbox[3]) / 2.0))
                if img is not None:
                    track.update_appearance(img, bbox)
                self.tracks[animal_id] = track

        return track

    def prune_lost_tracks(self, current_time: float) -> List[int]:
        lost_ids = []
        effective_timeout = self.get_effective_track_lost_seconds()
        for animal_id, track in list(self.tracks.items()):
            if track.is_lost(current_time, effective_timeout):
                lost_ids.append(animal_id)
                self.retired_tracks[animal_id] = self.tracks.pop(animal_id)
                # Keep retired tracks bounded to prevent memory leaks
                if len(self.retired_tracks) > 500:
                    oldest_key = min(self.retired_tracks.keys(), key=lambda k: self.retired_tracks[k].last_seen)
                    self.retired_tracks.pop(oldest_key, None)
        return lost_ids

    def get_active_tracks(self) -> List[AnimalTrackState]:
        return list(self.tracks.values())

    def get_track(self, animal_id: int) -> Optional[AnimalTrackState]:
        return self.tracks.get(animal_id) or self.retired_tracks.get(animal_id)
