#!/usr/bin/env python3
"""
Offline benchmarking script for ChickCheck.
Processes a video file offline and measures processing throughput (FPS),
inference latency, and tracking stability across different configurations.
"""

import sys
import os
import time
import argparse
import numpy as np
import cv2
import torch
from ultralytics import YOLO

# Add root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.config import SPECIES_PROFILES
from backend.app.vision.tracker_state import TrackerPool
from backend.app.vision.enhancer import AdaptiveImageEnhancer
from backend.app.analysis.metrics import compute_flock_metrics


def run_benchmark(
    video_path: str,
    weights_path: str,
    imgsz: int,
    process_every_n: int,
    conf: float,
    species: str,
    max_frames: int,
    enhance_low_res: bool = False,
):
    print("=" * 60)
    print("  CHICKCHECK OFFLINE PERFORMANCE BENCHMARK")
    print("=" * 60)
    print(f"Video Source      : {video_path}")
    print(f"Model Weights     : {weights_path}")
    print(f"Inference Img Size: {imgsz}")
    print(f"Process Every N   : {process_every_n}")
    print(f"Species           : {species}")
    print(f"Enhance Low-Res   : {enhance_low_res}")

    if not os.path.exists(video_path):
        print(f"\n[ERROR] Video file '{video_path}' does not exist.")
        sys.exit(1)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Hardware Device   : {device.upper()}")
    print("-" * 60)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"\n[ERROR] Failed to open video file '{video_path}' with OpenCV.")
        sys.exit(1)

    video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_video_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    print(f"Native Video FPS  : {video_fps:.2f} ({total_video_frames} frames)")

    print(f"Loading YOLO model '{weights_path}' onto {device}...")
    model = YOLO(weights_path)
    model.to(device)

    # Class selection (supports single or comma-separated multi-species or all)
    target_classes = []
    enhancer = AdaptiveImageEnhancer() if enhance_low_res else None
    if species.lower() == "all":
        target_classes = list({p.coco_class_id for p in SPECIES_PROFILES.values()})
    else:
        for sp in [s.strip().lower() for s in species.split(",") if s.strip()]:
            prof = SPECIES_PROFILES.get(sp, SPECIES_PROFILES["chicken"])
            if prof.coco_class_id not in target_classes:
                target_classes.append(prof.coco_class_id)

    tracker_pool = TrackerPool(track_lost_seconds=2.0)

    frame_idx = 0
    inference_count = 0
    inference_latencies = []
    overall_start_time = time.time()

    print("\nRunning benchmark across frames...")
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret or frame is None:
            break

        frame_idx += 1
        ts = frame_idx / video_fps

        if frame_idx % max(1, process_every_n) == 0:
            t0 = time.time()
            inf_frame = frame
            if enhancer:
                inf_frame, _ = enhancer.enhance(frame)

            results = model.track(
                source=inf_frame,
                persist=True,
                imgsz=imgsz,
                conf=conf,
                classes=target_classes,
                tracker="bytetrack.yaml",
                device=device,
                verbose=False,
            )
            lat = time.time() - t0
            inference_latencies.append(lat)
            inference_count += 1

            if results and len(results) > 0 and results[0].boxes is not None:
                boxes = results[0].boxes
                if boxes.id is not None:
                    ids = boxes.id.cpu().numpy().astype(int)
                    xyxy = boxes.xyxy.cpu().numpy()
                    for tid, box in zip(ids, xyxy):
                        tracker_pool.update_track(tid, ts, tuple(map(float, box)))

            tracker_pool.prune_lost_tracks(ts)

        if max_frames > 0 and frame_idx >= max_frames:
            break

        if frame_idx % 50 == 0:
            print(f"  Processed {frame_idx} frames... (current infer lat: {np.mean(inference_latencies[-10:]):.4f}s)")

    cap.release()
    total_elapsed = time.time() - overall_start_time
    avg_fps = frame_idx / max(0.001, total_elapsed)
    avg_lat = float(np.mean(inference_latencies)) if inference_latencies else 0.0
    p95_lat = float(np.percentile(inference_latencies, 95)) if inference_latencies else 0.0

    print("\n" + "=" * 60)
    print("  BENCHMARK RESULTS")
    print("=" * 60)
    print(f"Total Video Frames Read    : {frame_idx}")
    print(f"Inference Passes Executed  : {inference_count}")
    print(f"Total Elapsed Time         : {total_elapsed:.2f} s")
    print(f"Effective Throughput       : {avg_fps:.2f} FPS")
    print(f"Mean Inference Latency     : {avg_lat * 1000.0:.1f} ms")
    print(f"95th Percentile Latency    : {p95_lat * 1000.0:.1f} ms")
    print(f"Total Distinct Animals Seen: {len(tracker_pool.tracks) + len(tracker_pool.retired_tracks)}")
    print("-" * 60)

    if avg_fps >= video_fps:
        print(f" STATUS: REAL-TIME COMPLIANT ({avg_fps:.1f} FPS >= native {video_fps:.1f} FPS)")
    else:
        print(f" STATUS: BELOW REAL-TIME ({avg_fps:.1f} FPS < native {video_fps:.1f} FPS)")
        print(f"   Suggestion: Increase PROCESS_EVERY_N (e.g. 3 or 4) or decrease INFER_IMGSZ (e.g. 480 or 320)")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ChickCheck Video Pipeline Benchmarker")
    parser.add_argument("--video", default="samples/dummy.mp4", help="Path to input video file")
    parser.add_argument("--weights", default="yolo11n.pt", help="YOLO model weights path")
    parser.add_argument("--imgsz", type=int, default=640, help="Inference resolution")
    parser.add_argument("--process-every-n", type=int, default=2, help="Process every Nth frame")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold")
    parser.add_argument("--species", default="chicken", help="Livestock species (single, comma-separated, or 'all')")
    parser.add_argument("--max-frames", type=int, default=0, help="Max frames to benchmark (0 for all)")
    parser.add_argument("--enhance-low-res", action="store_true", help="Enable CLAHE and unsharp preprocessing")

    args = parser.parse_args()
    run_benchmark(
        video_path=args.video,
        weights_path=args.weights,
        imgsz=args.imgsz,
        process_every_n=args.process_every_n,
        conf=args.conf,
        species=args.species,
        max_frames=args.max_frames,
        enhance_low_res=args.enhance_low_res,
    )

