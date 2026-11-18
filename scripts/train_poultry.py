#!/usr/bin/env python3
"""
ChickCheck Poultry Model Fine-Tuning Script
Fine-tunes Ultralytics YOLO11 on poultry farm imagery with specialized augmentations
for dense, low-light, overlapping broilers.

Usage:
    python scripts/train_poultry.py --data dataset/poultry.yaml --epochs 50 --batch 16 --imgsz 640
    python scripts/train_poultry.py --bootstrap-from-video samples/dummy.mp4 --output-dir data/poultry_dataset
"""

import os
import sys
import argparse
import yaml
import cv2
import numpy as np


def create_template_dataset_yaml(output_path: str, dataset_dir: str) -> None:
    """Generates standard Ultralytics dataset YAML file."""
    cfg = {
        "path": os.path.abspath(dataset_dir),
        "train": "images/train",
        "val": "images/val",
        "names": {
            0: "chicken",
        },
    }
    with open(output_path, "w") as f:
        yaml.dump(cfg, f, default_flow_style=False)
    print(f"[INFO] Created dataset configuration at: {output_path}")


def bootstrap_dataset_from_video(
    video_path: str,
    output_dir: str,
    sample_every_n: int = 15,
    max_frames: int = 60,
) -> str:
    """
    Extracts frames from poultry farm video and bootstraps initial pseudo-labels
    using contour and multi-proxy detection for human verification in CVAT or Roboflow.
    """
    from backend.app.vision.detector import LivestockDetector

    detector = LivestockDetector()

    images_train = os.path.join(output_dir, "images", "train")
    images_val = os.path.join(output_dir, "images", "val")
    labels_train = os.path.join(output_dir, "labels", "train")
    labels_val = os.path.join(output_dir, "labels", "val")

    for p in [images_train, images_val, labels_train, labels_val]:
        os.makedirs(p, exist_ok=True)

    cap = cv2.VideoCapture(video_path)
    frame_idx = 0
    saved_count = 0

    print(f"[INFO] Bootstrapping pseudo-labeled dataset from: {video_path}")
    while cap.isOpened() and saved_count < max_frames:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % sample_every_n == 0:
            h, w = frame.shape[:2]
            dets, _ = detector.track(frame)

            is_val = (saved_count % 5 == 0)
            img_dir = images_val if is_val else images_train
            lbl_dir = labels_val if is_val else labels_train

            base_name = f"poultry_frame_{frame_idx:05d}"
            img_path = os.path.join(img_dir, f"{base_name}.jpg")
            lbl_path = os.path.join(lbl_dir, f"{base_name}.txt")

            cv2.imwrite(img_path, frame)

            with open(lbl_path, "w") as f:
                for d in dets:
                    bx = d["bbox"]
                    # Convert to normalized YOLO format (class x_center y_center width height)
                    bw = (bx[2] - bx[0]) / float(w)
                    bh = (bx[3] - bx[1]) / float(h)
                    cx = ((bx[0] + bx[2]) / 2.0) / float(w)
                    cy = ((bx[1] + bx[3]) / 2.0) / float(h)
                    f.write(f"0 {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}\n")

            saved_count += 1

        frame_idx += 1

    cap.release()
    yaml_path = os.path.join(output_dir, "data.yaml")
    create_template_dataset_yaml(yaml_path, output_dir)
    print(f"[SUCCESS] Bootstrapped {saved_count} frames into {output_dir}")
    print(f"[NOTE] Review and refine labels in CVAT/Roboflow before production training.")
    return yaml_path


def train_model(
    data_yaml: str,
    base_model: str = "yolo11n.pt",
    epochs: int = 50,
    batch: int = 16,
    imgsz: int = 640,
    output_dir: str = "runs/train_poultry",
) -> None:
    """Executes Ultralytics YOLO training with agricultural poultry augmentations."""
    from ultralytics import YOLO

    print("=" * 60)
    print(" ChickCheck Poultry Model Fine-Tuning")
    print(f" Base Model: {base_model} | Dataset: {data_yaml}")
    print(f" Epochs: {epochs} | Batch: {batch} | ImgSz: {imgsz}")
    print("=" * 60)

    model = YOLO(base_model)

    # Poultry specific hyperparameters:
    # High mosaic, mixup, and flip augmentations for dense overlapping birds
    results = model.train(
        data=data_yaml,
        epochs=epochs,
        batch=batch,
        imgsz=imgsz,
        project=output_dir,
        name="poultry_yolo11",
        patience=15,
        save=True,
        plots=True,
        mosaic=1.0,
        mixup=0.15,
        fliplr=0.5,
        flipud=0.5,
        hsv_h=0.015,
        hsv_s=0.5,
        hsv_v=0.4,
    )
    print("\n[SUCCESS] Training completed! Best weights saved to:")
    print(f"  {output_dir}/poultry_yolo11/weights/best.pt")
    print("To use these weights, set in .env:")
    print(f"  CUSTOM_WEIGHTS_PATH={output_dir}/poultry_yolo11/weights/best.pt")
    print("  CUSTOM_CLASS_NAMES=chicken")


def main():
    parser = argparse.ArgumentParser(description="ChickCheck Poultry YOLO11 Fine-Tuning & Bootstrapping")
    parser.add_argument("--data", type=str, default=None, help="Path to data.yaml dataset config")
    parser.add_argument("--model", type=str, default="yolo11n.pt", help="Base YOLO model weights")
    parser.add_argument("--epochs", type=int, default=30, help="Training epochs")
    parser.add_argument("--batch", type=int, default=8, help="Batch size")
    parser.add_argument("--imgsz", type=int, default=640, help="Inference/training image size")
    parser.add_argument("--bootstrap-from-video", type=str, default=None, help="Path to video for auto-labeling bootstrap")
    parser.add_argument("--output-dir", type=str, default="data/poultry_dataset", help="Output directory for bootstrapped dataset")

    args = parser.parse_args()

    if args.bootstrap_from_video:
        data_yaml = bootstrap_dataset_from_video(args.bootstrap_from_video, args.output_dir)
        if not args.data:
            args.data = data_yaml

    if not args.data:
        print("[ERROR] Please provide --data <path/to/data.yaml> or --bootstrap-from-video <video.mp4>")
        sys.exit(1)

    train_model(
        data_yaml=args.data,
        base_model=args.model,
        epochs=args.epochs,
        batch=args.batch,
        imgsz=args.imgsz,
    )


if __name__ == "__main__":
    main()
