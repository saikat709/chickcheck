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

        self._configure_classes()

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
            for sp in active_species:
                profile = settings.get_species_profile(sp)
                coco_name = profile.coco_class_name.lower()
                if coco_name in model_names:
                    cid = model_names[coco_name]
                    if cid not in self.target_class_ids:
                        self.target_class_ids.append(cid)
                    # Associate class id with species
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
        Runs YOLO11 inference and ByteTrack persistence on the given frame.
        Applies adaptive CLAHE / unsharp enhancement if low-resolution or degraded.
        Returns:
            Tuple of (detections_list, was_enhanced: bool)
        """
        was_enhanced = False
        input_frame = frame

        # Adaptive Low-Resolution & Contrast Enhancement
        if enhance_low_res and settings.ENHANCE_LOW_RES:
            input_frame, was_enhanced = self.enhancer.enhance(frame, target_inference_dim=imgsz)

        # Adaptive Confidence Scaling:
        # In poultry, low-res coops, or subtle contours, adaptively scale confidence threshold
        h, w = frame.shape[:2]
        effective_conf = conf
        if settings.ADAPTIVE_CONF_SCALING:
            is_poultry = any(sp in ["chicken", "duck", "bird"] for sp in settings.get_active_species_list())
            if h < settings.LOW_RES_MAX_DIM or w < 640 or was_enhanced or is_poultry:
                effective_conf = min(conf, 0.06)

        results = self.model.track(
            source=input_frame,
            persist=True,
            imgsz=imgsz,
            conf=effective_conf,
            classes=self.target_class_ids,
            tracker="bytetrack.yaml",
            device=self.device,
            verbose=False,
        )

        detections = []
        if not results or len(results) == 0:
            return detections, was_enhanced

        res = results[0]
        boxes = res.boxes
        if boxes is None or len(boxes) == 0:
            return detections, was_enhanced

        # If enhancement upscaled the image, calculate scale back to original frame
        ih, iw = input_frame.shape[:2]
        scale_x = w / float(iw)
        scale_y = h / float(ih)

        # Extract coordinates, IDs, confidences, and classes
        xyxy = boxes.xyxy.cpu().numpy()
        confs = boxes.conf.cpu().numpy()
        cls_ids = boxes.cls.cpu().numpy().astype(int)

        track_ids = None
        if boxes.id is not None:
            track_ids = boxes.id.cpu().numpy().astype(int)

        primary_species = settings.get_active_species_list()[0]

        for i in range(len(xyxy)):
            tid = int(track_ids[i]) if track_ids is not None else (i + 1)
            raw_box = xyxy[i]
            # Rescale back if enhancement upscaled input
            if scale_x != 1.0 or scale_y != 1.0:
                box = (
                    float(raw_box[0] * scale_x),
                    float(raw_box[1] * scale_y),
                    float(raw_box[2] * scale_x),
                    float(raw_box[3] * scale_y),
                )
            else:
                box = tuple(map(float, raw_box))

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
