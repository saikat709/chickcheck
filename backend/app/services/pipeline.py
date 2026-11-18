import os
import time
import datetime
import asyncio
import threading
import logging
from typing import Optional, Dict, Any, List, Set, Tuple
import cv2
import numpy as np

from backend.app.config import settings
from backend.app.db import SessionLocal
from backend.app.models import AnimalTrack, AnimalMetricSnapshot, FlockMetric
from backend.app.sources.base import FrameSource
from backend.app.sources.file_source import FileSource
from backend.app.sources.rtsp_source import RTSPSource
from backend.app.vision.detector import LivestockDetector
from backend.app.vision.tracker_state import TrackerPool, AnimalTrackState
from backend.app.vision.annotator import FrameAnnotator
from backend.app.vision.heatmap import HeatmapAccumulator
from backend.app.analysis.metrics import compute_flock_metrics
from backend.app.analysis.anomalies import AnomalyDetector, AnomalyFinding
from backend.app.analysis.health_score import compute_animal_health_score, compute_flock_health_score
from backend.app.analysis.baseline import BaselineEngine
from backend.app.services.recorder import VideoClipRecorder
from backend.app.alerts.engine import AlertEngine
from backend.app.analysis.optical_flow import FlockFlowAnalyzer
from backend.app.vision.density_counter import FlockDensityCounter
from backend.app.analysis.immobile import ImmobileBirdDetector
from backend.app.vision.camera_guard import CameraGuard
from backend.app.analysis.zones import BarnZoneManager

logger = logging.getLogger("chickcheck.pipeline")


class LivestockPipeline:
    """
    Main asynchronous/threaded video processing engine.
    Ingests frames from FrameSource, runs YOLO11 ByteTrack, updates kinematic states,
    computes flock metrics, detects anomalies, dispatches alerts, and yields MJPEG & SSE.
    """

    def __init__(self):
        self.running = False
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()

        # Source
        self.source: Optional[FrameSource] = None
        self.source_status: str = "stopped"  # stopped, live, reconnecting, failed
        self.last_frame_time: float = 0.0
        self.current_fps: float = 0.0

        # Subsystems
        self.recorder = VideoClipRecorder(buffer_seconds=15.0)
        self.alert_engine = AlertEngine(self.recorder)
        self.tracker_pool = TrackerPool(
            track_lost_seconds=settings.TRACK_LOST_SECONDS,
            max_trail_points=settings.MAX_TRAIL_POINTS,
        )
        self.heatmap = HeatmapAccumulator(width=640, height=360)
        self.detector: Optional[LivestockDetector] = None
        self.anomaly_detector: Optional[AnomalyDetector] = None

        # Commercial flock analytical engines (flock-level trustworthy signals)
        self.flow_analyzer = FlockFlowAnalyzer(grid_size=(8, 8))
        self.density_counter = FlockDensityCounter(history_size=15)
        self.immobile_detector = ImmobileBirdDetector(min_duration_s=25.0)
        self.camera_guard = CameraGuard()
        self.zone_manager = BarnZoneManager()

        # Latest frame buffer for zero-lag MJPEG streaming
        self._latest_jpeg: Optional[bytes] = None
        self._show_heatmap_overlay: bool = False
        self._is_enhanced: bool = False
        self._show_boxes: bool = True
        self._show_trails: bool = False
        self._show_clusters: bool = False
        self._show_flow: bool = False
        self._show_zones: bool = False
        self._box_shape: str = "box"

        # Live stats cache
        self._latest_stats: Dict[str, Any] = {
            "species": settings.SPECIES,
            "count": 0,
            "active_count": 0,
            "idle_count": 0,
            "activity_index": 50.0,
            "flock_health_score": 100.0,
            "dispersion": 0.0,
            "crowding_index": 0.0,
            "mean_speed_norm": 0.0,
            "status": "healthy",
            "fps": 0.0,
            "timestamp": time.time(),
            "source_status": "initializing",
            "species_counts": {},
            "max_cluster_size": 0,
            "is_enhanced": False,
            "density_count": 0,
            "uncertainty": 0,
            "count_min": 0,
            "count_max": 0,
            "density_regime": "sparse_box",
            "density_method": "box_tracking",
            "optical_flow_activity": 50.0,
            "zone_occupancy": {},
            "immobile_candidates_count": 0,
        }

        # SSE Client Queues
        self._sse_clients: Set[asyncio.Queue] = set()
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def set_event_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def initialize_source(self) -> None:
        """Instantiates and opens the configured FrameSource."""
        src_str = settings.VIDEO_SOURCE.strip()
        if src_str.startswith("rtsp://") or src_str.startswith("http://") or src_str.startswith("https://"):
            logger.info(f"Configured network video source: {src_str}")
            self.source = RTSPSource(src_str)
        else:
            logger.info(f"Configured local file video source: {src_str}")
            self.source = FileSource(src_str)

        self.source.open()
        self.source_status = "live"

    def start(self) -> None:
        """Starts detector and launches the background processing thread."""
        if self.running:
            return

        logger.info("Starting ChickCheck Livestock Pipeline...")
        self.initialize_source()

        # Initialize detector and anomaly detector
        self.detector = LivestockDetector()
        profile = settings.get_species_profile()
        thresholds = settings.get_active_thresholds()
        self.anomaly_detector = AnomalyDetector(thresholds, profile)

        self.running = True
        self._thread = threading.Thread(target=self._run_loop, name="LivestockPipelineWorker", daemon=True)
        self._thread.start()
        logger.info("ChickCheck Livestock Pipeline running.")

    def stop(self) -> None:
        """Gracefully halts pipeline, releases video sources, and flushes resources."""
        logger.info("Stopping Livestock Pipeline...")
        self.running = False
        try:
            self._broadcast_sse("shutdown", {"status": "stopped"})
        except Exception:
            pass

        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)

        if self.source:
            try:
                self.source.close()
            except Exception as e:
                logger.warning(f"Error closing FrameSource: {e}")
            self.source = None

        self.source_status = "stopped"
        logger.info("Livestock Pipeline stopped.")

    def _run_loop(self) -> None:
        frame_counter = 0
        fps_timer = time.time()
        fps_frame_count = 0
        last_db_flock_save = 0.0
        last_retention_check = time.time()

        while self.running:
            try:
                if self.source is None:
                    time.sleep(0.1)
                    continue

                raw_frame, ts = self.source.read()
                self.last_frame_time = time.time()
                frame_counter += 1
                fps_frame_count += 1

                # Calculate pipeline FPS
                now = time.time()
                if now - fps_timer >= 1.0:
                    self.current_fps = fps_frame_count / (now - fps_timer)
                    fps_frame_count = 0
                    fps_timer = now

                # Add raw frame to ring buffer for pre-incident clip generation
                self.recorder.add_frame(raw_frame, ts, fps=self.source.fps)

                # Frame decimation: only run inference on every Nth frame
                is_inference_frame = (frame_counter % max(1, settings.PROCESS_EVERY_N) == 0)

                active_tracks: List[AnimalTrackState] = []
                animal_bboxes: Dict[int, Tuple[float, float, float, float]] = {}

                if is_inference_frame and self.detector is not None:
                    # Run YOLO11 + ByteTrack with low-res CLAHE enhancement
                    detections, was_enhanced = self.detector.track(
                        raw_frame,
                        imgsz=settings.INFER_IMGSZ,
                        conf=settings.CONF_THRESHOLD,
                        enhance_low_res=settings.ENHANCE_LOW_RES,
                    )
                    self._is_enhanced = was_enhanced

                    # Update track states (two-pass id association, thresholds computed once per frame)
                    idle_thr = settings.get_active_thresholds().inactivity_speed_norm
                    matched = self.tracker_pool.update_detections(
                        detections, ts, idle_speed_threshold_norm=idle_thr, frame=raw_frame
                    )
                    for det, track in matched:
                        bbox = det["bbox"]
                        animal_bboxes[track.animal_id] = bbox

                        # Optional crop classification if classifier model is loaded
                        if self.detector.classifier is not None and (frame_counter % 10 == 0):
                            x1, y1, x2, y2 = map(int, bbox)
                            h, w = raw_frame.shape[:2]
                            crop = raw_frame[max(0, y1):min(h, y2), max(0, x1):min(w, x2)]
                            if crop.size > 0:
                                track.cls_prob_healthy = self.detector.classify_crop(crop)

                        # Compute individual health score
                        compute_animal_health_score(track, track.cls_prob_healthy)

                    # Prune lost tracks
                    self.tracker_pool.prune_lost_tracks(ts)
                    active_tracks = self.tracker_pool.get_active_tracks()

                    # Update Heatmap
                    centroids = [t.last_centroid for t in active_tracks]
                    self.heatmap.update(centroids, raw_frame.shape[1], raw_frame.shape[0])
                else:
                    active_tracks = self.tracker_pool.get_active_tracks()
                    for t in active_tracks:
                        animal_bboxes[t.animal_id] = t.last_bbox

                # Compute aggregate flock metrics
                h, w = raw_frame.shape[:2]
                flock_metrics = compute_flock_metrics(
                    active_tracks,
                    frame_width=w,
                    frame_height=h,
                    inactivity_speed_norm=settings.get_active_thresholds().inactivity_speed_norm,
                )

                # Optical flow (dense flock motion energy independent of per-bird IDs)
                flow_metrics = self.flow_analyzer.update(raw_frame)

                # Density counter (dual regime: box tracking vs plumage density map)
                density_est = self.density_counter.estimate(
                    raw_frame,
                    box_count=len(active_tracks),
                    tracks=active_tracks,
                )

                # Immobile bird candidate detector (stationary plumage blob over time)
                immobile_cands = self.immobile_detector.update(
                    raw_frame,
                    timestamp=ts,
                    active_flock_motion=(flow_metrics["activity_index"] > 25.0),
                )

                # Barn Zones occupancy
                centroids = [t.last_centroid for t in active_tracks]
                zone_occupancy = self.zone_manager.compute_zone_occupancy(centroids, (w, h))

                # Inject robust commercial flock metrics
                flock_metrics["optical_flow_activity"] = flow_metrics["activity_index"]
                flock_metrics["flow_variance"] = flow_metrics["variance"]
                flock_metrics["density_regime"] = density_est.regime
                flock_metrics["density_count"] = density_est.count
                flock_metrics["uncertainty"] = density_est.uncertainty
                flock_metrics["count_min"] = density_est.count_min
                flock_metrics["count_max"] = density_est.count_max
                flock_metrics["density_method"] = density_est.method
                flock_metrics["smoothed_count"] = density_est.count
                flock_metrics["zone_occupancy_pcts"] = zone_occupancy

                # Camera operational fault guard check (every 15 frames)
                cam_fault = None
                if frame_counter % 15 == 0:
                    cam_fault = self.camera_guard.check(raw_frame)

                # Anomaly detection & Diurnal baseline evaluation
                flock_status = "healthy"
                flock_health_score = 100.0

                if is_inference_frame and self.anomaly_detector is not None:
                    db = SessionLocal()
                    try:
                        curr_hour = time.localtime(ts).tm_hour
                        baseline_data = BaselineEngine.get_baseline_for_hour(db, settings.SPECIES, curr_hour)

                        findings = self.anomaly_detector.evaluate(
                            current_time=ts,
                            tracks=active_tracks,
                            flock_metrics=flock_metrics,
                            baseline_data=baseline_data,
                            current_hour=curr_hour,
                        )

                        # Incorporate operational camera faults if detected
                        if cam_fault:
                            findings.append(
                                AnomalyFinding(
                                    rule_name="camera_fault",
                                    animal_id=None,
                                    severity="critical" if cam_fault.get("severity") == "critical" else "warning",
                                    title=f"Camera Operational Fault: {cam_fault.get('type', '').replace('_', ' ').title()}",
                                    description=cam_fault.get("description", "Camera fault detected"),
                                    confidence=0.95,
                                    metadata=cam_fault,
                                )
                            )

                        # Incorporate immobile bird candidates (mortality/downed screening)
                        if immobile_cands:
                            for cand in immobile_cands:
                                findings.append(
                                    AnomalyFinding(
                                        rule_name="immobile_bird_candidate",
                                        animal_id=None,
                                        severity="critical" if cand["duration_s"] >= 60.0 else "warning",
                                        title=f"Immobile Bird Candidate ({round(cand['duration_s'], 1)}s)",
                                        description=f"Stationary bird detected at ({int(cand['centroid'][0])}, {int(cand['centroid'][1])}) for {round(cand['duration_s'], 1)}s while flock is moving. Manual inspection advised.",
                                        confidence=cand["confidence"],
                                        metadata={"candidate_id": cand["candidate_id"], "duration_s": cand["duration_s"], "bbox": cand["bbox"]},
                                    )
                                )

                        active_flock_anomalies = [f.rule_name for f in findings if f.animal_id is None]
                        flock_health_score, flock_status = compute_flock_health_score(
                            active_tracks,
                            flock_metrics,
                            active_flock_anomalies,
                        )

                        # Process findings and dispatch alerts asynchronously
                        if findings:
                            self._schedule_alert_dispatch(findings, raw_frame, animal_bboxes)

                        # Periodic baseline EWMA learning (every ~10s)
                        if frame_counter % 100 == 0 and len(active_tracks) > 0:
                            BaselineEngine.update_baseline_sample(
                                db,
                                settings.SPECIES,
                                curr_hour,
                                flock_metrics["optical_flow_activity"],
                                flock_metrics["mean_speed_norm"],
                            )
                    finally:
                        db.close()
                else:
                    with self._lock:
                        flock_status = self._latest_stats.get("status", "healthy")
                        flock_health_score = self._latest_stats.get("flock_health_score", 100.0)

                # Render annotated frame with status-colored boxes, trails, HUD, clusters, flow, and zones
                annotated = FrameAnnotator.annotate(
                    frame=raw_frame,
                    tracks=active_tracks,
                    flock_status=flock_status,
                    flock_health_score=flock_health_score,
                    fps=self.current_fps,
                    timestamp=ts,
                    species=settings.SPECIES,
                    heatmap=self.heatmap,
                    show_heatmap=self._show_heatmap_overlay,
                    was_enhanced=self._is_enhanced,
                    clusters=flock_metrics.get("clusters"),
                    show_boxes=self._show_boxes,
                    show_trails=self._show_trails,
                    show_clusters=self._show_clusters,
                    box_shape=self._box_shape,
                    show_flow=self._show_flow,
                    flow_analyzer=self.flow_analyzer,
                    zone_manager=self.zone_manager,
                    show_zones=self._show_zones,
                    immobile_candidates=immobile_cands,
                    density_info={
                        "count": density_est.count,
                        "uncertainty": density_est.uncertainty,
                        "method": density_est.method,
                    },
                )

                # Encode JPEG for MJPEG stream
                encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 80]
                success, encoded_jpg = cv2.imencode(".jpg", annotated, encode_param)
                if success:
                    with self._lock:
                        self._latest_jpeg = encoded_jpg.tobytes()

                # Update cache of latest stats
                stats_dict = {
                    "species": settings.SPECIES,
                    "count": flock_metrics["count"],
                    "active_count": flock_metrics["active_count"],
                    "idle_count": flock_metrics["idle_count"],
                    "activity_index": flock_metrics["optical_flow_activity"],
                    "flock_health_score": flock_health_score,
                    "dispersion": flock_metrics["dispersion"],
                    "crowding_index": flock_metrics["crowding_index"],
                    "mean_speed_norm": flock_metrics["mean_speed_norm"],
                    "status": flock_status,
                    "fps": round(self.current_fps, 1),
                    "timestamp": ts,
                    "source_status": self.source_status,
                    "species_counts": flock_metrics.get("species_counts", {}),
                    "max_cluster_size": flock_metrics.get("max_cluster_size", 0),
                    "is_enhanced": self._is_enhanced,
                    "density_count": density_est.count,
                    "uncertainty": density_est.uncertainty,
                    "count_min": density_est.count_min,
                    "count_max": density_est.count_max,
                    "density_regime": density_est.regime,
                    "density_method": density_est.method,
                    "optical_flow_activity": flow_metrics["activity_index"],
                    "zone_occupancy": zone_occupancy,
                    "immobile_candidates_count": len(immobile_cands),
                }
                with self._lock:
                    self._latest_stats = stats_dict

                # Broadcast metrics tick via SSE (once per second)
                if now - last_db_flock_save >= 1.0:
                    last_db_flock_save = now
                    self._broadcast_sse("metrics_tick", stats_dict)
                    # Persist periodic snapshot to DB in background
                    self._persist_flock_snapshot(stats_dict, active_tracks)

                # Run file retention cleanup once per hour
                if now - last_retention_check >= 3600.0:
                    last_retention_check = now
                    threading.Thread(target=VideoClipRecorder.cleanup_retention, args=(settings.RETENTION_DAYS,), daemon=True).start()

            except Exception as e:
                logger.error(f"Error in pipeline loop: {e}", exc_info=True)
                time.sleep(0.5)

    def _persist_flock_snapshot(self, stats: Dict[str, Any], tracks: List[AnimalTrackState]) -> None:
        """Saves current metrics to SQLite/Postgres."""
        def _save():
            db = SessionLocal()
            try:
                fm = FlockMetric(
                    species=stats["species"],
                    count=stats["count"],
                    active_count=stats["active_count"],
                    idle_count=stats["idle_count"],
                    mean_speed_norm=stats["mean_speed_norm"],
                    activity_index=stats["activity_index"],
                    dispersion=stats["dispersion"],
                    crowding_index=stats["crowding_index"],
                    flock_health_score=stats["flock_health_score"],
                    status=stats["status"],
                    fps=stats["fps"],
                )
                db.add(fm)

                # Update or insert tracked animals
                now_dt = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
                for t in tracks:
                    rec = db.query(AnimalTrack).filter(AnimalTrack.animal_id == t.animal_id).first()
                    if not rec:
                        rec = AnimalTrack(
                            animal_id=t.animal_id,
                            species=t.species or settings.SPECIES,
                            first_seen=now_dt,
                            last_seen=now_dt,
                            status=t.status,
                            health_score=t.health_score,
                            total_distance_px=t.total_distance_px,
                            total_idle_seconds=t.total_idle_seconds,
                            last_speed_norm=t.last_speed_norm,
                            active=True,
                        )
                        db.add(rec)
                    else:
                        rec.last_seen = now_dt
                        rec.species = t.species or rec.species
                        rec.status = t.status
                        rec.health_score = t.health_score
                        rec.total_distance_px = t.total_distance_px
                        rec.total_idle_seconds = t.total_idle_seconds
                        rec.last_speed_norm = t.last_speed_norm
                        rec.active = True

                db.commit()
            except Exception as e:
                db.rollback()
                logger.error(f"Error persisting snapshot to DB: {e}")
            finally:
                db.close()

        threading.Thread(target=_save, daemon=True).start()

    def _schedule_alert_dispatch(self, findings: List[Any], frame: np.ndarray, bboxes: Dict[int, Any]) -> None:
        """Launches async task to process alert findings without stalling video loop."""
        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(
                self._dispatch_findings_async(findings, frame, bboxes),
                self._loop,
            )

    async def _dispatch_findings_async(self, findings: List[Any], frame: np.ndarray, bboxes: Dict[int, Any]) -> None:
        db = SessionLocal()
        try:
            await self.alert_engine.process_findings(
                db=db,
                findings=findings,
                current_frame=frame,
                animal_bboxes=bboxes,
                sse_broadcast_callback=self._broadcast_sse_coro,
            )
        finally:
            db.close()

    def _broadcast_sse(self, event_type: str, data: Dict[str, Any]) -> None:
        if self._loop and self._loop.is_running():
            msg = {"type": event_type, "data": data}
            self._loop.call_soon_threadsafe(self._put_sse_msg, msg)

    def _put_sse_msg(self, msg: Dict[str, Any]) -> None:
        dead_queues = set()
        for q in list(self._sse_clients):
            try:
                q.put_nowait(msg)
            except Exception:
                dead_queues.add(q)
        for dq in dead_queues:
            self._sse_clients.discard(dq)

    async def _broadcast_sse_coro(self, event_type: str, data: Dict[str, Any]) -> None:
        self._put_sse_msg({"type": event_type, "data": data})

    def subscribe_sse(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._sse_clients.add(q)
        return q

    def unsubscribe_sse(self, q: asyncio.Queue) -> None:
        self._sse_clients.discard(q)

    def get_latest_jpeg(self) -> Optional[bytes]:
        with self._lock:
            return self._latest_jpeg

    def get_latest_stats(self) -> Dict[str, Any]:
        with self._lock:
            return dict(self._latest_stats)

    def toggle_heatmap_overlay(self, enable: Optional[bool] = None) -> bool:
        if enable is not None:
            self._show_heatmap_overlay = enable
        else:
            self._show_heatmap_overlay = not self._show_heatmap_overlay
        return self._show_heatmap_overlay

    def set_annotation_style(
        self,
        show_boxes: Optional[bool] = None,
        box_shape: Optional[str] = None,
        show_trails: Optional[bool] = None,
        show_clusters: Optional[bool] = None,
        show_flow: Optional[bool] = None,
        show_zones: Optional[bool] = None,
    ) -> None:
        if show_boxes is not None:
            self._show_boxes = show_boxes
        if box_shape is not None:
            self._box_shape = box_shape
        if show_trails is not None:
            self._show_trails = show_trails
        if show_clusters is not None:
            self._show_clusters = show_clusters
        if show_flow is not None:
            self._show_flow = show_flow
        if show_zones is not None:
            self._show_zones = show_zones


# Global pipeline singleton
pipeline = LivestockPipeline()

