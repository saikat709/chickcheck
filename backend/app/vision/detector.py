import os
import logging
from typing import List, Tuple, Optional, Any, Dict

import cv2
import numpy as np
import torch
import yaml
from ultralytics import YOLO

from backend.app.config import settings
from backend.app.vision.enhancer import AdaptiveImageEnhancer

logger = logging.getLogger("chickcheck.vision.detector")

POULTRY_SPECIES = {"chicken", "duck"}

# Class-name aliases used to find a species in a custom (non-COCO) model.
CUSTOM_ALIASES: Dict[str, List[str]] = {
    "chicken": ["chicken", "chick", "hen", "rooster", "broiler", "poultry"],
    "duck": ["duck", "duckling"],
    "cow": ["cow", "cattle"],
    "sheep": ["sheep"],
    "goat": ["goat"],
}


def _iomin(a: Tuple[float, ...], b: Tuple[float, ...]) -> float:
    """Intersection over the SMALLER box. Catches a small box sitting inside a big one."""
    ix = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    smaller = min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1]))
    return (ix * iy) / max(1e-6, smaller)


class LivestockDetector:
    """
    Wraps Ultralytics YOLO with ByteTrack. Returns detections as dicts.
    `id` is the ByteTrack id, or None when the tracker did not assign one.
    Detections without an id are matched to tracks by TrackerPool (never given invented ids here).
    """

    def __init__(self):
        self.device = settings.DEVICE or ("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"LivestockDetector initializing on device: {self.device}")

        model_path = settings.CUSTOM_WEIGHTS_PATH or settings.MODEL_WEIGHTS
        logger.info(f"Loading YOLO tracking model from '{model_path}'...")
        self.model = YOLO(model_path)
        self.model.to(self.device)

        self.classifier: Optional[YOLO] = None
        if settings.HEALTH_CLASSIFIER_PATH and os.path.exists(settings.HEALTH_CLASSIFIER_PATH):
            logger.info(f"Loading Health Classifier from '{settings.HEALTH_CLASSIFIER_PATH}'...")
            self.classifier = YOLO(settings.HEALTH_CLASSIFIER_PATH)
            self.classifier.to(self.device)

        self.enhancer = AdaptiveImageEnhancer(
            clahe_clip_limit=settings.CLAHE_CLIP_LIMIT,
            sharpen_strength=settings.SHARPEN_FACTOR,
            low_res_threshold_h=settings.LOW_RES_MAX_DIM,
            low_res_threshold_w=640,
        )

        self._configure_classes()
        self._tracker_cfg = self._write_tracker_config()

    # ------------------------------------------------------------------ setup
    def _write_tracker_config(self) -> str:
        """ByteTrack config whose thresholds match the confidence we actually run at.
        (Old config had thresholds far below the confidence filter and created ghost tracks.)"""
        template = os.path.join(os.path.dirname(__file__), "poultry_tracker.yaml")
        with open(template) as f:
            cfg = yaml.safe_load(f)
        base = max(0.01, min(float(settings.ADAPTIVE_CONF_FLOOR), float(settings.CONF_THRESHOLD)))
        cfg["track_high_thresh"] = base
        cfg["new_track_thresh"] = base
        cfg["track_low_thresh"] = max(0.01, base * 0.5)
        os.makedirs(settings.DATA_DIR, exist_ok=True)
        path = os.path.join(settings.DATA_DIR, "bytetrack_chickcheck.yaml")
        with open(path, "w") as f:
            yaml.safe_dump(cfg, f)
        return path

    @staticmethod
    def _is_coco_like(names: Dict[str, int]) -> bool:
        return {"person", "bird", "cow", "sheep"}.issubset(names.keys())

    def _configure_classes(self) -> None:
        """Pick which model classes to keep and which species each one means.
        Never filters with hard-coded COCO ids unless the model really is COCO."""
        self.class_id_to_species: Dict[int, str] = {}
        ids: List[int] = []
        names = {str(v).lower(): int(k) for k, v in self.model.names.items()}
        active = settings.get_active_species_list()

        def add(cid: int, sp: str) -> None:
            if cid not in self.class_id_to_species:  # first claim wins; real classes are added before proxies
                self.class_id_to_species[cid] = sp
                ids.append(cid)

        if settings.CUSTOM_CLASS_NAMES:
            for n in [c.strip().lower() for c in settings.CUSTOM_CLASS_NAMES.split(",") if c.strip()]:
                if n in names:
                    add(names[n], n)
        elif self._is_coco_like(names):
            for sp in active:  # real classes first (bird, cow, sheep)
                cid = names.get(settings.get_species_profile(sp).coco_class_name.lower())
                if cid is not None:
                    add(cid, sp)
            poultry = [sp for sp in active if sp in POULTRY_SPECIES]
            if poultry:  # proxies only fill classes no real species has claimed
                for n in [c.strip().lower() for c in settings.POULTRY_PROXY_CLASSES.split(",") if c.strip()]:
                    if n in names:
                        add(names[n], poultry[0])
        else:  # custom model, no CUSTOM_CLASS_NAMES: look the species up by name
            for sp in active:
                for alias in CUSTOM_ALIASES.get(sp, [sp]):
                    if alias in names:
                        add(names[alias], sp)

        if ids:
            self.target_class_ids: Optional[List[int]] = ids
        else:
            logger.warning(
                f"No model class matched species {active} (model classes: {list(names)}). "
                "Detecting ALL classes. Set CUSTOM_CLASS_NAMES to fix this."
            )
            self.target_class_ids = None
        logger.info(f"Target class ids for {active}: {self.target_class_ids} -> {self.class_id_to_species}")

    # -------------------------------------------------------------- inference
    def _effective_conf(self, conf: float, h: int, w: int, was_enhanced: bool, is_poultry: bool) -> float:
        """Adaptive scaling may LOWER the user's confidence, but never below ADAPTIVE_CONF_FLOOR
        and never above what the user set. (Old code forced 0.015 for all poultry.)"""
        if not settings.ADAPTIVE_CONF_SCALING:
            return conf
        if is_poultry or h < settings.LOW_RES_MAX_DIM or w < 640 or was_enhanced:
            return min(conf, max(float(settings.ADAPTIVE_CONF_FLOOR), conf * 0.6))
        return conf

    def track(
        self,
        frame: np.ndarray,
        imgsz: int = 640,
        conf: float = 0.25,
        enhance_low_res: bool = True,
    ) -> Tuple[List[Dict[str, Any]], bool]:
        was_enhanced = False
        input_frame = frame
        if enhance_low_res and settings.ENHANCE_LOW_RES:
            input_frame, was_enhanced = self.enhancer.enhance(frame, target_inference_dim=imgsz)

        h, w = frame.shape[:2]
        total_area = h * w
        active = settings.get_active_species_list()
        is_poultry = any(sp in POULTRY_SPECIES for sp in active)
        effective_conf = self._effective_conf(conf, h, w, was_enhanced, is_poultry)

        results = self.model.track(
            source=input_frame,
            persist=True,
            imgsz=imgsz,
            conf=effective_conf,
            iou=0.55 if is_poultry else 0.7,
            classes=self.target_class_ids,
            tracker=self._tracker_cfg,
            device=self.device,
            agnostic_nms=True,  # one box per animal even if two classes (bird/sheep) fire on it
            verbose=False,
        )

        detections: List[Dict[str, Any]] = []
        ih, iw = input_frame.shape[:2]
        scale_x, scale_y = w / float(iw), h / float(ih)
        primary_species = active[0]
        min_side = max(6.0, settings.MIN_BOX_FRACTION * min(h, w))
        max_area = settings.MAX_BOX_AREA_FRACTION * total_area

        if results and len(results) > 0 and results[0].boxes is not None and len(results[0].boxes) > 0:
            boxes = results[0].boxes
            xyxy = boxes.xyxy.cpu().numpy()
            confs = boxes.conf.cpu().numpy()
            cls_ids = boxes.cls.cpu().numpy().astype(int)
            track_ids = boxes.id.cpu().numpy().astype(int) if boxes.id is not None else None

            for i in range(len(xyxy)):
                x1, y1, x2, y2 = (float(xyxy[i][0]) * scale_x, float(xyxy[i][1]) * scale_y,
                                  float(xyxy[i][2]) * scale_x, float(xyxy[i][3]) * scale_y)
                bw, bh = x2 - x1, y2 - y1
                if bw * bh > max_area or bw < min_side or bh < min_side:
                    continue
                cid = int(cls_ids[i])
                tid = int(track_ids[i]) if (track_ids is not None and track_ids[i] > 0) else None
                detections.append({
                    "id": tid,
                    "bbox": (x1, y1, x2, y2),
                    "conf": float(confs[i]),
                    "class_id": cid,
                    "class_name": self.model.names.get(cid, str(cid)),
                    "species": self.class_id_to_species.get(cid, primary_species),
                })

        if is_poultry and settings.POULTRY_COLOR_FUSION:
            detections.extend(self._color_fusion(frame, [d["bbox"] for d in detections], primary_species))

        return detections, was_enhanced

    def _color_fusion(self, frame: np.ndarray, seen: List[Tuple[float, ...]], species: str) -> List[Dict[str, Any]]:
        """Experimental: add pale blobs YOLO missed. Hardened vs. the old version:
        needs >=3 YOLO boxes to calibrate size, keeps only chick-sized, compact blobs,
        and skips blobs overlapping an existing box (IoMin, not IoU)."""
        if len(seen) < 3:
            return []
        areas = [(b[2] - b[0]) * (b[3] - b[1]) for b in seen]
        med = float(np.median(areas))
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, np.array([0, 0, 130]), np.array([180, 110, 255]))
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        out: List[Dict[str, Any]] = []
        for c in contours:
            area = cv2.contourArea(c)
            if not (0.4 * med <= area <= 2.0 * med):
                continue
            hull = cv2.contourArea(cv2.convexHull(c))
            if hull <= 0 or area / hull < 0.85:  # compact blobs only (walls/beams are ragged)
                continue
            bx, by, bw, bh = cv2.boundingRect(c)
            if not (0.4 < bw / max(1, bh) < 2.5):
                continue
            box = (float(bx), float(by), float(bx + bw), float(by + bh))
            if any(_iomin(box, s) > 0.3 for s in seen):
                continue
            seen.append(box)
            out.append({"id": None, "bbox": box, "conf": 0.30, "class_id": -1,
                        "class_name": "chick", "species": species})
        return out

    # ------------------------------------------------------------- classifier
    def classify_crop(self, crop_bgr: np.ndarray) -> Optional[float]:
        """Probability of the 'healthy' class, or None if unknown. Never guesses class 0."""
        if self.classifier is None or crop_bgr is None or crop_bgr.size == 0:
            return None
        try:
            res = self.classifier(crop_bgr, verbose=False, device=self.device)
            if res and len(res) > 0 and res[0].probs is not None:
                probs = res[0].probs.data.cpu().numpy()
                names = self.classifier.names
                items = names.items() if isinstance(names, dict) else enumerate(names)
                for idx, name in items:
                    if any(k in str(name).lower() for k in ("healthy", "normal")):
                        return float(probs[int(idx)])
                logger.warning(f"Health classifier has no 'healthy'/'normal' class: {names}")
        except Exception as e:
            logger.warning(f"Classification inference failed: {e}")
        return None
