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


SYNTHETIC_ID_BASE = 1_000_000  # ids for detections ByteTrack did not label; never collides with tracker ids
RETIRED_MATCH_WINDOW_S = 3.0


class TrackerPool:
    """
    Manages active and retired tracks. Association is two-pass:
      1. detections whose tracker id is already known update their own track first;
      2. the rest (new/missing ids) are matched one-to-one, nearest first, to tracks
         NOT updated this frame, otherwise a new track is created.
    (Old code matched in detection order to the first nearby track, so a new chick next
    to a not-yet-updated neighbour was absorbed into the neighbour's track.)
    """

    def __init__(self, track_lost_seconds: float = 2.5, max_trail_points: int = 30):
        self.track_lost_seconds = track_lost_seconds
        self.max_trail_points = max_trail_points
        self.tracks: Dict[int, AnimalTrackState] = {}
        self.retired_tracks: Dict[int, AnimalTrackState] = {}
        self._alias: Dict[int, int] = {}  # tracker id -> pool key it was merged into
        self._next_synthetic = SYNTHETIC_ID_BASE

    def get_effective_track_lost_seconds(self) -> float:
        """In dense flocks (>12 animals), retain tracks longer during mutual occlusions."""
        if len(self.tracks) >= 12:
            return max(self.track_lost_seconds, 4.0)
        return self.track_lost_seconds

    def _new_synthetic_id(self) -> int:
        while self._next_synthetic in self.tracks or self._next_synthetic in self.retired_tracks:
            self._next_synthetic += 1
        sid = self._next_synthetic
        self._next_synthetic += 1
        return sid

    def _resolve(self, tid: int) -> Optional[int]:
        key = self._alias.get(tid, tid)
        return key if (key in self.tracks or key in self.retired_tracks) else None

    def _apply(self, key, ts, bbox, idle, species, img) -> AnimalTrackState:
        track = self.tracks.get(key)
        if track is None:  # revive a retired track
            track = self.retired_tracks.pop(key)
            self.tracks[key] = track
        track.update(ts, bbox, idle, species=species, frame_bgr=img)
        return track

    def _create(self, tid: Optional[int], ts, bbox, species, img) -> AnimalTrackState:
        if tid is not None and tid < SYNTHETIC_ID_BASE and tid not in self.tracks and tid not in self.retired_tracks:
            key = tid
            self._alias.pop(tid, None)
        else:
            key = self._new_synthetic_id()
        track = AnimalTrackState(key, ts, bbox, species=species)
        track.trail = deque(maxlen=self.max_trail_points)
        track.trail.append(((bbox[0] + bbox[2]) / 2.0, (bbox[1] + bbox[3]) / 2.0))
        if img is not None:
            track.update_appearance(img, bbox)
        self.tracks[key] = track
        return track

    def update_detections(
        self,
        detections: List[Dict],
        timestamp: float,
        idle_speed_threshold_norm: float = 0.05,
        frame: Optional[np.ndarray] = None,
    ) -> List[Tuple[Dict, AnimalTrackState]]:
        """Update the pool with one frame of detections. Returns (detection, track) pairs."""
        results: List[Optional[AnimalTrackState]] = [None] * len(detections)
        updated: Set[int] = set()
        pending: List[int] = []

        for i, det in enumerate(detections):  # pass 1: known ids
            tid = det.get("id")
            key = self._resolve(tid) if tid is not None else None
            if key is not None and key not in updated:
                results[i] = self._apply(key, timestamp, det["bbox"], idle_speed_threshold_norm,
                                         det.get("species") or "chicken", frame)
                updated.add(key)
            else:
                pending.append(i)

        if pending:  # pass 2: nearest-first, one-to-one
            candidates = []
            for i in pending:
                b = detections[i]["bbox"]
                sp = detections[i].get("species") or "chicken"
                cx, cy = (b[0] + b[2]) / 2.0, (b[1] + b[3]) / 2.0
                diag = math.hypot(b[2] - b[0], b[3] - b[1])
                for key, tr in list(self.tracks.items()) + list(self.retired_tracks.items()):
                    if key in updated or tr.species != sp or tr.last_seen >= timestamp:
                        continue
                    retired = key in self.retired_tracks
                    if retired and (timestamp - tr.last_seen) >= RETIRED_MATCH_WINDOW_S:
                        continue
                    cost = math.hypot(cx - tr.last_centroid[0], cy - tr.last_centroid[1]) / max(diag, tr.last_diag, 1.0)
                    if cost < (1.5 if retired else 1.0):
                        candidates.append((cost, i, key))
            candidates.sort()
            matched: Set[int] = set()
            for _, i, key in candidates:
                if i in matched or key in updated:
                    continue
                det = detections[i]
                results[i] = self._apply(key, timestamp, det["bbox"], idle_speed_threshold_norm,
                                         det.get("species") or "chicken", frame)
                updated.add(key)
                matched.add(i)
                if det.get("id") is not None:
                    self._alias[det["id"]] = key
            for i in pending:
                if i not in matched:
                    det = detections[i]
                    results[i] = self._create(det.get("id"), timestamp, det["bbox"],
                                              det.get("species") or "chicken", frame)

        return [(d, t) for d, t in zip(detections, results) if t is not None]

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
        """Single-detection convenience wrapper (kept for tests/benchmark)."""
        img = frame if frame is not None else frame_bgr
        det = {"id": animal_id, "bbox": bbox, "species": species}
        return self.update_detections([det], timestamp, idle_speed_threshold_norm, img)[0][1]

    def prune_lost_tracks(self, current_time: float) -> List[int]:
        lost_ids = []
        effective_timeout = self.get_effective_track_lost_seconds()
        for animal_id, track in list(self.tracks.items()):
            if track.is_lost(current_time, effective_timeout):
                lost_ids.append(animal_id)
                self.retired_tracks[animal_id] = self.tracks.pop(animal_id)
                if len(self.retired_tracks) > 500:
                    oldest = min(self.retired_tracks, key=lambda k: self.retired_tracks[k].last_seen)
                    self.retired_tracks.pop(oldest, None)
        if len(self._alias) > 2000:  # drop aliases pointing at forgotten tracks
            self._alias = {a: k for a, k in self._alias.items() if k in self.tracks or k in self.retired_tracks}
        return lost_ids

    def get_active_tracks(self) -> List[AnimalTrackState]:
        return list(self.tracks.values())

    def get_track(self, animal_id: int) -> Optional[AnimalTrackState]:
        return self.tracks.get(animal_id) or self.retired_tracks.get(animal_id)
