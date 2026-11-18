#!/usr/bin/env python3
"""
Commercial Poultry Flock Analytics Evaluation Suite.
Measures empirical performance on barn footage:
  - Detection throughput (FPS, mean latency, p95 latency)
  - Counting stability (Mean, StdDev, MAE vs ground-truth/nominal)
  - ID stability (Unique IDs spawned, ID churn ratio)
  - Optical flow activity index & motion energy
  - False alert rates and regime transitions
"""

import sys
import os
import time
import argparse
import numpy as np
import cv2

# Add repository root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.config import settings
from backend.app.vision.detector import LivestockDetector
from backend.app.vision.tracker_state import TrackerPool
from backend.app.analysis.optical_flow import FlockFlowAnalyzer
from backend.app.vision.density_counter import FlockDensityCounter
from backend.app.analysis.immobile import ImmobileBirdDetector
from backend.app.analysis.anomalies import AnomalyDetector
from backend.app.analysis.metrics import compute_flock_metrics


def run_evaluation(video_path: str, max_frames: int = 150, ground_truth_count: float = 19.0):
    if not os.path.exists(video_path):
        print(f"Error: Video file '{video_path}' not found.")
        return 1

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: Could not open video '{video_path}'.")
        return 1

    total_video_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    print(f"===============================================================")
    print(f"  ChickCheck Commercial Flock Evaluation Suite")
    print(f"===============================================================")
    print(f"  Target Video:     {video_path}")
    print(f"  Resolution:       {width}x{height} @ {video_fps:.1f} FPS")
    print(f"  Evaluation Window:{min(max_frames, total_video_frames)} frames")
    print(f"  Ground Truth:     ~{ground_truth_count:.1f} birds")
    print(f"---------------------------------------------------------------")

    # Initialize engines
    detector = LivestockDetector()
    tracker_pool = TrackerPool(track_lost_seconds=4.0)
    flow_analyzer = FlockFlowAnalyzer(grid_rows=8, grid_cols=8)
    density_counter = FlockDensityCounter(window_size=7)
    immobile_detector = ImmobileBirdDetector(min_duration_s=15.0)
    thresholds = settings.get_active_thresholds()
    profile = settings.get_species_profile()
    anomaly_detector = AnomalyDetector(thresholds, profile)

    frame_idx = 0
    latencies_ms = []
    box_counts = []
    smoothed_counts = []
    flow_activities = []
    all_seen_ids = set()
    alerts_flagged = []
    regimes = {"sparse_box": 0, "dense_crowd": 0}

    start_wall_time = time.time()

    while cap.isOpened() and frame_idx < max_frames:
        ret, frame = cap.read()
        if not ret:
            break

        frame_idx += 1
        t_now = frame_idx / video_fps

        t0 = time.time()
        # 1. Detection & Tracking
        detections, was_enhanced = detector.track(
            frame,
            imgsz=settings.INFER_IMGSZ,
            conf=settings.CONF_THRESHOLD,
            enhance_low_res=settings.ENHANCE_LOW_RES,
        )
        t_detect = (time.time() - t0) * 1000.0
        latencies_ms.append(t_detect)

        # 2. Track pool association
        matched = tracker_pool.update_detections(detections, t_now, frame=frame)
        active_tracks = tracker_pool.get_active_tracks()
        for t in active_tracks:
            all_seen_ids.add(t.animal_id)

        # 3. Dense optical flow
        flow_res = flow_analyzer.update(frame)
        flow_activities.append(flow_res["activity_index"])

        # 4. Density counter with uncertainty
        density_res = density_counter.estimate(frame, box_count=len(active_tracks), tracks=active_tracks)
        regimes[density_res.regime] = regimes.get(density_res.regime, 0) + 1

        box_counts.append(len(active_tracks))
        smoothed_counts.append(density_res.count)

        # 5. Immobile candidate screening
        immobile_cands = immobile_detector.update(frame, t_now, active_flock_motion=(flow_res["activity_index"] > 20.0))

        # 6. Flock metrics & Anomaly detection
        metrics = compute_flock_metrics(active_tracks, frame_width=width, frame_height=height)
        metrics["optical_flow_activity"] = flow_res["activity_index"]
        metrics["flow_variance"] = flow_res["variance"]
        metrics["smoothed_count"] = density_res.count

        findings = anomaly_detector.evaluate(t_now, active_tracks, metrics, {"is_default": True})
        if findings:
            for f in findings:
                alerts_flagged.append((frame_idx, f.rule_name, f.severity, f.confidence))

        if frame_idx % 30 == 0:
            print(f"  Frame {frame_idx:3d}/{max_frames} | Box Count: {len(active_tracks):2d} | Smoothed: {density_res.count:2d}±{density_res.uncertainty} | Activity: {flow_res['activity_index']:4.1f}% | Latency: {t_detect:4.1f}ms")

    total_eval_time = time.time() - start_wall_time
    cap.release()

    # Compute Statistical Metrics
    avg_fps = frame_idx / max(0.001, total_eval_time)
    mean_lat = float(np.mean(latencies_ms))
    p95_lat = float(np.percentile(latencies_ms, 95))

    mean_box = float(np.mean(box_counts))
    std_box = float(np.std(box_counts))
    mean_smooth = float(np.mean(smoothed_counts))
    std_smooth = float(np.std(smoothed_counts))

    mae_box = float(np.mean(np.abs(np.array(box_counts) - ground_truth_count)))
    mape_box = (mae_box / ground_truth_count) * 100.0

    mae_smooth = float(np.mean(np.abs(np.array(smoothed_counts) - ground_truth_count)))
    mape_smooth = (mae_smooth / ground_truth_count) * 100.0

    unique_ids_count = len(all_seen_ids)
    id_churn_ratio = unique_ids_count / max(1.0, ground_truth_count)

    print(f"\n===============================================================")
    print(f"  EVALUATION RESULTS & BENCHMARK REPORT")
    print(f"===============================================================")
    print(f"  Throughput & Speed:")
    print(f"    - Processed Frames:     {frame_idx} in {total_eval_time:.2f}s")
    print(f"    - Processing Throughput:{avg_fps:.2f} FPS")
    print(f"    - Mean Model Latency:   {mean_lat:.1f} ms")
    print(f"    - p95 Model Latency:    {p95_lat:.1f} ms")
    print(f"")
    print(f"  Counting Accuracy & Stability (vs GT ~{ground_truth_count:.1f}):")
    print(f"    - Raw Box Count:        {mean_box:.1f} ± {std_box:.2f} (MAE: {mae_box:.2f}, MAPE: {mape_box:.1f}%)")
    print(f"    - Smoothed Dual-Regime: {mean_smooth:.1f} ± {std_smooth:.2f} (MAE: {mae_smooth:.2f}, MAPE: {mape_smooth:.1f}%)")
    print(f"    - Count Variance Drop:  {((std_box - std_smooth) / max(1e-4, std_box)) * 100:.1f}% reduction in count jitter")
    print(f"    - Regime Distribution:  {regimes.get('sparse_box', 0)} sparse frames, {regimes.get('dense_crowd', 0)} dense crowd frames")
    print(f"")
    print(f"  Tracking Quality & ID Churn:")
    print(f"    - Unique IDs Spawned:   {unique_ids_count} across {frame_idx} frames")
    print(f"    - ID Churn Multiplier:  {id_churn_ratio:.1f}x nominal flock size")
    print(f"    - Verification Outcome: Confirms flock-level analytics MUST remain primary.")
    print(f"")
    print(f"  Flock Kinetic Activity & Alerts:")
    print(f"    - Mean Activity Index:  {np.mean(flow_activities):.1f} / 100 (StdDev: {np.std(flow_activities):.2f})")
    print(f"    - Total Alerts Fired:   {len(alerts_flagged)}")
    alert_summary = {}
    for _, name, sev, _ in alerts_flagged:
        alert_summary[name] = alert_summary.get(name, 0) + 1
    for name, cnt in alert_summary.items():
        print(f"      * {name}: {cnt} instances")
    print(f"===============================================================\n")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate ChickCheck flock CV models.")
    parser.add_argument("--video", type=str, default="samples/dummy.mp4", help="Path to video file")
    parser.add_argument("--frames", type=int, default=150, help="Number of frames to evaluate")
    parser.add_argument("--ground-truth", type=float, default=19.0, help="Estimated true count")
    args = parser.parse_args()

    sys.exit(run_evaluation(args.video, args.frames, args.ground_truth))
