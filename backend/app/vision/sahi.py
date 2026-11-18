import math
from typing import List, Tuple, Dict, Any, Optional
import numpy as np
import cv2
import torch


class SlicedInferencer:
    """
    SAHI-style (Slicing Aided Hyper Inference) tiled inference engine for dense poultry flocks.
    Divides high-resolution barn camera frames into overlapping tiles, executes detection on
    both global context and local slices, and unifies predictions using Non-Maximum Suppression (NMS).
    
    This dramatically boosts recall for small, distant birds in large commercial sheds without
    requiring massive GPU memory.
    """

    def __init__(
        self,
        slice_height: int = 512,
        slice_width: int = 512,
        overlap_height_ratio: float = 0.20,
        overlap_width_ratio: float = 0.20,
        nms_iou_threshold: float = 0.45,
    ):
        self.slice_height = slice_height
        self.slice_width = slice_width
        self.overlap_height_ratio = overlap_height_ratio
        self.overlap_width_ratio = overlap_width_ratio
        self.nms_iou_threshold = nms_iou_threshold

    def calculate_slice_regions(self, image_height: int, image_width: int) -> List[Tuple[int, int, int, int]]:
        """
        Calculates overlapping (x1, y1, x2, y2) tile slices covering the full frame.
        """
        step_x = int(self.slice_width * (1.0 - self.overlap_width_ratio))
        step_y = int(self.slice_height * (1.0 - self.overlap_height_ratio))
        
        step_x = max(1, step_x)
        step_y = max(1, step_y)

        slice_regions = []

        y_starts = list(range(0, max(1, image_height - self.slice_height + 1), step_y))
        if len(y_starts) == 0 or y_starts[-1] + self.slice_height < image_height:
            y_starts.append(max(0, image_height - self.slice_height))

        x_starts = list(range(0, max(1, image_width - self.slice_width + 1), step_x))
        if len(x_starts) == 0 or x_starts[-1] + self.slice_width < image_width:
            x_starts.append(max(0, image_width - self.slice_width))

        # Remove duplicate start points
        y_starts = sorted(list(set(y_starts)))
        x_starts = sorted(list(set(x_starts)))

        for y in y_starts:
            for x in x_starts:
                x2 = min(image_width, x + self.slice_width)
                y2 = min(image_height, y + self.slice_height)
                slice_regions.append((x, y, x2, y2))

        return slice_regions

    def nms(self, boxes: np.ndarray, scores: np.ndarray, iou_threshold: float) -> List[int]:
        """
        Standard greedy Non-Maximum Suppression.
        boxes: (N, 4) in [x1, y1, x2, y2]
        scores: (N,)
        """
        if len(boxes) == 0:
            return []

        x1 = boxes[:, 0]
        y1 = boxes[:, 1]
        x2 = boxes[:, 2]
        y2 = boxes[:, 3]
        areas = (x2 - x1) * (y2 - y1)
        order = scores.argsort()[::-1]

        keep = []
        while order.size > 0:
            i = order[0]
            keep.append(int(i))

            xx1 = np.maximum(x1[i], x1[order[1:]])
            yy1 = np.maximum(y1[i], y1[order[1:]])
            xx2 = np.minimum(x2[i], x2[order[1:]])
            yy2 = np.minimum(y2[i], y2[order[1:]])

            w = np.maximum(0.0, xx2 - xx1)
            h = np.maximum(0.0, yy2 - yy1)
            inter = w * h
            iou = inter / np.maximum(1e-6, areas[i] + areas[order[1:]] - inter)

            inds = np.where(iou <= iou_threshold)[0]
            order = order[inds + 1]

        return keep

    def run_sliced_inference(
        self,
        model: Any,
        image: np.ndarray,
        conf_threshold: float = 0.02,
        classes: Optional[List[int]] = None,
        imgsz: int = 640,
        device: str = "cpu",
    ) -> List[Dict[str, Any]]:
        """
        Performs dual-scale sliced inference:
        1. Full-frame global prediction (detects large nearby birds)
        2. Tiled local slice predictions (detects small distant birds)
        3. Global coordinate re-projection and merged NMS
        """
        h, w = image.shape[:2]
        all_boxes = []
        all_scores = []
        all_class_ids = []

        # 1. Global context prediction
        global_res = model.predict(
            source=image,
            conf=conf_threshold,
            classes=classes,
            imgsz=imgsz,
            device=device,
            verbose=False,
        )
        if global_res and len(global_res) > 0 and global_res[0].boxes is not None:
            g_xyxy = global_res[0].boxes.xyxy.cpu().numpy()
            g_confs = global_res[0].boxes.conf.cpu().numpy()
            g_cls = global_res[0].boxes.cls.cpu().numpy().astype(int)
            for i in range(len(g_xyxy)):
                all_boxes.append(g_xyxy[i])
                all_scores.append(float(g_confs[i]))
                all_class_ids.append(int(g_cls[i]))

        # 2. Slices predictions if image resolution warrants slicing (e.g. >= 640x640)
        if w >= 640 or h >= 640:
            slice_regions = self.calculate_slice_regions(h, w)
            for (sx1, sy1, sx2, sy2) in slice_regions:
                slice_crop = image[sy1:sy2, sx1:sx2]
                if slice_crop.size == 0:
                    continue

                slice_res = model.predict(
                    source=slice_crop,
                    conf=conf_threshold,
                    classes=classes,
                    imgsz=min(imgsz, max(slice_crop.shape[:2])),
                    device=device,
                    verbose=False,
                )

                if slice_res and len(slice_res) > 0 and slice_res[0].boxes is not None:
                    s_xyxy = slice_res[0].boxes.xyxy.cpu().numpy()
                    s_confs = slice_res[0].boxes.conf.cpu().numpy()
                    s_cls = slice_res[0].boxes.cls.cpu().numpy().astype(int)

                    for i in range(len(s_xyxy)):
                        bx1, by1, bx2, by2 = s_xyxy[i]
                        # Re-project to full image global coordinates
                        gx1 = bx1 + sx1
                        gy1 = by1 + sy1
                        gx2 = bx2 + sx1
                        gy2 = by2 + sy1

                        all_boxes.append(np.array([gx1, gy1, gx2, gy2], dtype=np.float32))
                        all_scores.append(float(s_confs[i]))
                        all_class_ids.append(int(s_cls[i]))

        if not all_boxes:
            return []

        all_boxes_arr = np.array(all_boxes, dtype=np.float32)
        all_scores_arr = np.array(all_scores, dtype=np.float32)

        # 3. Merged Non-Maximum Suppression across global + sliced candidates
        keep_indices = self.nms(all_boxes_arr, all_scores_arr, self.nms_iou_threshold)

        merged_detections = []
        total_area = float(h * w)
        for idx in keep_indices:
            box = all_boxes_arr[idx]
            bw = box[2] - box[0]
            bh = box[3] - box[1]
            area = bw * bh

            # Filter out whole-barn bounding boxes (> 30% of total area) and microscopic noise (< 15px)
            if area > (0.30 * total_area) or bw < 15 or bh < 15:
                continue

            merged_detections.append({
                "bbox": (float(box[0]), float(box[1]), float(box[2]), float(box[3])),
                "conf": float(all_scores_arr[idx]),
                "class_id": int(all_class_ids[idx]),
                "source": "sahi",
            })

        return merged_detections
