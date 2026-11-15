import os
import logging
from typing import List, Tuple, Optional, Any, Dict
import cv2
import numpy as np
import torch
from ultralytics import YOLO

from backend.app.config import settings, SPECIES_PROFILES
from backend.app.vision.enhancer import AdaptiveImageEnhancer

logger = logging.getLogger("chickcheck.vision.detector")


class LivestockDetector:
    """
    Wraps Ultralytics YOLO11 model with ByteTrack multi-object tracking.
    Supports multi-species detection concurrently and adaptive image enhancement
    for low-resolution surveillance footage.
    """

    def __init__(self):
        self.device = settings.DEVICE
        if not self.device:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"LivestockDetector initializing on device: {self.device}")

        # Choose weights: custom fine-tuned weights or default YOLO11
        model_path = settings.CUSTOM_WEIGHTS_PATH or settings.MODEL_WEIGHTS
        logger.info(f"Loading YOLO tracking model from '{model_path}'...")
        self.model = YOLO(model_path)
        self.model.to(self.device)

        # Optional Health Classifier model
        self.classifier: Optional[YOLO] = None
        if settings.HEALTH_CLASSIFIER_PATH and os.path.exists(settings.HEALTH_CLASSIFIER_PATH):
            logger.info(f"Loading Health Classifier from '{settings.HEALTH_CLASSIFIER_PATH}'...")
            self.classifier = YOLO(settings.HEALTH_CLASSIFIER_PATH)
            self.classifier.to(self.device)

        # Low-resolution adaptive preprocessor
        self.enhancer = AdaptiveImageEnhancer(
            clahe_clip_limit=settings.CLAHE_CLIP_LIMIT,
            sharpen_strength=settings.SHARPEN_FACTOR,
            low_res_threshold_h=settings.LOW_RES_MAX_DIM,
            low_res_threshold_w=640,
        )

        self._next_id: int = 1
        self._ensure_poultry_tracker_config()
        self._configure_classes()

    def _ensure_poultry_tracker_config(self) -> str:
        """Ensures custom ByteTrack configuration for dense poultry flocks exists."""
        tracker_path = os.path.join(os.path.dirname(__file__), "poultry_tracker.yaml")
        if not os.path.exists(tracker_path):
            import yaml
            cfg = {
                "tracker_type": "bytetrack",
                "track_high_thresh": 0.05,
                "track_low_thresh": 0.01,
                "new_track_thresh": 0.03,
                "track_buffer": 60,
                "match_thresh": 0.7,
                "fuse_score": True,
            }
            with open(tracker_path, "w") as f:
                yaml.dump(cfg, f)
        return tracker_path

    def _alloc_id(self, existing_ids: Optional[List[int]] = None) -> int:
        if existing_ids:
            max_id = max([i for i in existing_ids if i > 0] + [0])
            self._next_id = max(self._next_id, max_id + 1)
        tid = self._next_id
        self._next_id += 1
        if self._next_id > 10000:
            self._next_id = 1
        return tid

    def _configure_classes(self) -> None:
        """Determines target class indices and maps them to species names."""
        self.target_class_ids: List[int] = []
        self.class_id_to_species: Dict[int, str] = {}

        model_names = {v.lower(): k for k, v in self.model.names.items()}

        if settings.CUSTOM_CLASS_NAMES:
            custom_names = [c.strip().lower() for c in settings.CUSTOM_CLASS_NAMES.split(",") if c.strip()]
            for name in custom_names:
                if name in model_names:
                    cid = model_names[name]
                    self.target_class_ids.append(cid)
                    self.class_id_to_species[cid] = name
            if not self.target_class_ids:
                logger.warning(f"None of custom classes {custom_names} found in model names: {list(self.model.names.values())}")
                self.target_class_ids = None
        else:
            active_species = settings.get_active_species_list()
            is_poultry = any(sp in ["chicken", "duck", "bird"] for sp in active_species)

            if is_poultry:
                # Top-down overhead chicks and broilers are frequently categorized by COCO models
                # into visual proxies: 14 (bird), 18 (sheep/fluffy wool), 46 (banana/yellow curves),
                # 77 (teddy bear/plush), 15 (cat), 16 (dog).
                poultry_coco_proxies = [14, 18, 46, 77, 15, 16]
                for cid in poultry_coco_proxies:
                    if cid not in self.target_class_ids:
                        self.target_class_ids.append(cid)
                    self.class_id_to_species[cid] = "chicken" if "chicken" in active_species else active_species[0]
            else:
                for sp in active_species:
                    profile = settings.get_species_profile(sp)
                    coco_name = profile.coco_class_name.lower()
                    if coco_name in model_names:
                        cid = model_names[coco_name]
                        if cid not in self.target_class_ids:
                            self.target_class_ids.append(cid)
                        self.class_id_to_species[cid] = sp
                    else:
                        cid = profile.coco_class_id
                        if cid not in self.target_class_ids:
                            self.target_class_ids.append(cid)
                        self.class_id_to_species[cid] = sp

        logger.info(f"Target detection class IDs for active species {settings.get_active_species_list()}: {self.target_class_ids}")

    def track(
        self,
        frame: np.ndarray,
        imgsz: int = 640,
        conf: float = 0.25,
        enhance_low_res: bool = True,
    ) -> Tuple[List[Dict[str, Any]], bool]:
        """
        Runs YOLO11 inference, plumage contour segmentation fusion, and ByteTrack persistence.
        """
        was_enhanced = False
        input_frame = frame

        # Adaptive Low-Resolution & Contrast Enhancement
        if enhance_low_res and settings.ENHANCE_LOW_RES:
            input_frame, was_enhanced = self.enhancer.enhance(frame, target_inference_dim=imgsz)

        h, w = frame.shape[:2]
        total_area = h * w
        effective_conf = conf
        is_poultry = any(sp in ["chicken", "duck", "bird"] for sp in settings.get_active_species_list())

        if settings.ADAPTIVE_CONF_SCALING:
            if is_poultry:
                effective_conf = min(conf, 0.015)
            elif h < settings.LOW_RES_MAX_DIM or w < 640 or was_enhanced:
                effective_conf = min(conf, 0.05)

        tracker_config = self._ensure_poultry_tracker_config() if is_poultry else "bytetrack.yaml"

        results = self.model.track(
            source=input_frame,
            persist=True,
            imgsz=imgsz,
            conf=effective_conf,
            iou=0.55 if is_poultry else 0.7,
            classes=self.target_class_ids,
            tracker=tracker_config,
            device=self.device,
            verbose=False,
        )

        detections = []
        seen_boxes = []
        ih, iw = input_frame.shape[:2]
        scale_x = w / float(iw)
        scale_y = h / float(ih)
        primary_species = settings.get_active_species_list()[0]

        if results and len(results) > 0 and results[0].boxes is not None:
            boxes = results[0].boxes
            xyxy = boxes.xyxy.cpu().numpy()
            confs = boxes.conf.cpu().numpy()
            cls_ids = boxes.cls.cpu().numpy().astype(int)
            track_ids = boxes.id.cpu().numpy().astype(int) if boxes.id is not None else None

            for i in range(len(xyxy)):
                raw_box = xyxy[i]
                if scale_x != 1.0 or scale_y != 1.0:
                    box = (
                        float(raw_box[0] * scale_x),
                        float(raw_box[1] * scale_y),
                        float(raw_box[2] * scale_x),
                        float(raw_box[3] * scale_y),
                    )
                else:
                    box = tuple(map(float, raw_box))

                bw = box[2] - box[0]
                bh = box[3] - box[1]
                area = bw * bh

                # Discard giant background/feeder boxes (> 30% of entire frame) and tiny noise (< 16px)
                if area > (0.30 * total_area) or bw < 16 or bh < 16:
                    continue

                tid = int(track_ids[i]) if (track_ids is not None and track_ids[i] > 0) else self._alloc_id()
                cid = int(cls_ids[i])
                cname = self.model.names.get(cid, str(cid))
                confidence = float(confs[i])
                detected_species = self.class_id_to_species.get(cid, primary_species)

                detections.append({
                    "id": tid,
                    "bbox": box,
                    "conf": confidence,
                    "class_id": cid,
                    "class_name": cname,
                    "species": detected_species,
                })
                seen_boxes.append(box)

        # 2. Morphological Plumage Fusion:
        # Detects subtle, occluded, or touching chicks (especially around the central feeder)
        # where CNN receptive fields merge adjacent birds.
        if is_poultry:
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            # High value/luminance, low to moderate saturation matches broiler plumage against dirt bedding
            mask = cv2.inRange(hsv, np.array([0, 0, 130]), np.array([180, 110, 255]))
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
            opened = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
            contours, _ = cv2.findContours(opened, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            for c in contours:
                c_area = cv2.contourArea(c)
                if 700 < c_area < (0.25 * total_area):
                    bx, by, bw, bh = cv2.boundingRect(c)
                    if 0.3 < (bw / max(1, bh)) < 3.0:
                        blob_box = (float(bx), float(by), float(bx + bw), float(by + bh))
                        # Check IoU overlap with all existing detected boxes
                        overlapped = False
                        for sb in seen_boxes:
                            inter_x1 = max(blob_box[0], sb[0])
                            inter_y1 = max(blob_box[1], sb[1])
                            inter_x2 = min(blob_box[2], sb[2])
                            inter_y2 = min(blob_box[3], sb[3])
                            inter = max(0.0, inter_x2 - inter_x1) * max(0.0, inter_y2 - inter_y1)
                            a1 = (blob_box[2] - blob_box[0]) * (blob_box[3] - blob_box[1])
                            a2 = (sb[2] - sb[0]) * (sb[3] - sb[1])
                            iou = inter / max(1e-6, a1 + a2 - inter)
                            if iou > 0.25:
                                overlapped = True
                                break
                        if not overlapped:
                            existing_ids = [d["id"] for d in detections]
                            tid = self._alloc_id(existing_ids)
                            detections.append({
                                "id": tid,
                                "bbox": blob_box,
                                "conf": 0.40,
                                "class_id": 14,
                                "class_name": "chick",
                                "species": primary_species,
                            })
                            seen_boxes.append(blob_box)

        return detections, was_enhanced

    def classify_crop(self, crop_bgr: np.ndarray) -> Optional[float]:
        """
        Runs optional classifier on a single animal crop.
        Returns probability of 'healthy' class (0.0 to 1.0) or None if classifier not loaded.
        """
        if self.classifier is None or crop_bgr is None or crop_bgr.size == 0:
            return None

        try:
            res = self.classifier(crop_bgr, verbose=False, device=self.device)
            if res and len(res) > 0 and res[0].probs is not None:
                probs = res[0].probs.data.cpu().numpy()
                names = self.classifier.names
                healthy_idx = 0
                for idx, name in names.items():
                    if "healthy" in str(name).lower():
                        healthy_idx = idx
                        break
                return float(probs[healthy_idx])
        except Exception as e:
            logger.warning(f"Classification inference failed: {e}")
            return None

        return None
