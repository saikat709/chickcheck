import time
import datetime
from typing import List, Tuple, Dict, Any, Optional
import cv2
import numpy as np
from backend.app.vision.tracker_state import AnimalTrackState
from backend.app.vision.heatmap import HeatmapAccumulator

# Colors in BGR format
COLOR_GREEN = (94, 197, 34)    # Healthy #22c55e
COLOR_YELLOW = (8, 179, 234)   # Watch #eab308
COLOR_RED = (68, 68, 239)      # Alert #ef4444
COLOR_WHITE = (255, 255, 255)
COLOR_DARK = (24, 24, 27)


class FrameAnnotator:
    """Renders aesthetic annotations, trails, bounding boxes, and HUD on frames."""

    @classmethod
    def get_status_color(cls, status: str) -> Tuple[int, int, int]:
        s = status.lower()
        if s == "alert":
            return COLOR_RED
        elif s == "watch":
            return COLOR_YELLOW
        return COLOR_GREEN

    @classmethod
    def annotate(
        cls,
        frame: np.ndarray,
        tracks: List[AnimalTrackState],
        flock_status: str,
        flock_health_score: float,
        fps: float,
        timestamp: float,
        species: str,
        heatmap: Optional[HeatmapAccumulator] = None,
        show_heatmap: bool = False,
        was_enhanced: bool = False,
        clusters: Optional[List[Dict[str, Any]]] = None,
        show_boxes: bool = True,
        show_trails: bool = False,
        show_clusters: bool = False,
        box_shape: str = "box",
        show_flow: bool = False,
        flow_analyzer: Optional[Any] = None,
        zone_manager: Optional[Any] = None,
        show_zones: bool = False,
        immobile_candidates: Optional[List[Dict[str, Any]]] = None,
        density_info: Optional[Dict[str, Any]] = None,
    ) -> np.ndarray:
        out = frame.copy()
        h, w = out.shape[:2]

        # 0. Render Barn Zones if requested
        if show_zones and zone_manager is not None:
            out = zone_manager.render_zones_overlay(out)

        # 1. Heatmap blend if requested
        if show_heatmap and heatmap is not None:
            heat_rgb, mask = heatmap.get_overlay(out.shape)
            mask_norm = (mask.astype(float) / 255.0)[:, :, None]
            out = (out * (1.0 - 0.45 * mask_norm) + heat_rgb * (0.45 * mask_norm)).astype(np.uint8)

        # 1b. Optical flow vectors if requested
        if show_flow and flow_analyzer is not None:
            out = flow_analyzer.render_flow_overlay(out, step=28)

        # 2. Render Spatial Clusters (only if explicitly enabled)
        if show_clusters and clusters:
            for cl in clusters:
                if cl.get("size", cl.get("count", 0)) >= 3:
                    cx, cy = int(cl["centroid"][0]), int(cl["centroid"][1])
                    cr = max(25, int(cl.get("radius", 40)))
                    cv2.circle(out, (cx, cy), cr, (40, 140, 255), 2, lineType=cv2.LINE_AA)
                    cl_label = f"Huddle: {cl.get('size', cl.get('count', 0))}"
                    (cl_w, cl_h), _ = cv2.getTextSize(cl_label, cv2.FONT_HERSHEY_SIMPLEX, 0.4, 1)
                    cv2.rectangle(out, (cx - cl_w // 2 - 4, cy - cr - cl_h - 4), (cx + cl_w // 2 + 4, cy - cr), (24, 24, 27), -1)
                    cv2.putText(out, cl_label, (cx - cl_w // 2, cy - cr - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (40, 200, 255), 1, cv2.LINE_AA)

        # 2b. Render Immobile Bird Candidates (Mortality/Lethargy Alert)
        if immobile_candidates:
            for cand in immobile_candidates:
                ix1, iy1, ix2, iy2 = cand["bbox"]
                dur = round(cand.get("duration_s", 0.0), 1)
                cv2.rectangle(out, (ix1, iy1), (ix2, iy2), (0, 0, 255), 3, lineType=cv2.LINE_AA)
                cand_label = f"IMMOBILE: {dur}s"
                (lw, lh), _ = cv2.getTextSize(cand_label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
                cv2.rectangle(out, (ix1, max(45, iy1 - lh - 6)), (ix1 + lw + 8, max(45, iy1)), (0, 0, 200), -1)
                cv2.putText(out, cand_label, (ix1 + 4, max(45, iy1) - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.45, COLOR_WHITE, 1, cv2.LINE_AA)

        # 3. Render Motion Trails (only if explicitly enabled)
        if show_trails:
            for t in tracks:
                trail_pts = list(t.trail)
                color = cls.get_status_color(t.status)
                n_pts = len(trail_pts)
                for idx in range(1, n_pts):
                    p1 = (int(trail_pts[idx - 1][0]), int(trail_pts[idx - 1][1]))
                    p2 = (int(trail_pts[idx][0]), int(trail_pts[idx][1]))
                    alpha = idx / float(n_pts)
                    thickness = max(1, int(2 * alpha))
                    cv2.line(out, p1, p2, color, thickness, lineType=cv2.LINE_AA)

        # 4. Render Clean Bounding Boxes and ID Tags on Chicks (without cluttering lines)
        if show_boxes:
            for t in tracks:
                x1, y1, x2, y2 = map(int, t.last_bbox)
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(w - 1, x2), min(h - 1, y2)
                bw = max(2, x2 - x1)
                bh = max(2, y2 - y1)
                color = cls.get_status_color(t.status)

                # Responsive font and box thickness
                box_thick = max(2, int(round(min(w, h) / 720.0 * 2.0)))
                font_scale = max(0.40, min(w, h) / 1080.0 * 0.45)
                font_thick = max(1, int(round(font_scale * 1.5)))

                if box_shape == "ellipse":
                    cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
                    ew, eh = max(12, bw // 2), max(12, bh // 2)
                    cv2.ellipse(out, (cx, cy), (ew, eh), 0, 0, 360, color, box_thick, lineType=cv2.LINE_AA)
                else:
                    # Clean, solid bounding box framing the chick
                    cv2.rectangle(out, (x1, y1), (x2, y2), color, box_thick, lineType=cv2.LINE_AA)

                # Entity Track ID Tag Pill (e.g. "#1")
                label = f"#{t.animal_id}"
                font = cv2.FONT_HERSHEY_SIMPLEX
                (tw, th), baseline = cv2.getTextSize(label, font, font_scale, font_thick)

                # Position label neatly above chick box
                pill_h = th + 8
                pill_w = tw + 10
                pill_y1 = max(4, y1 - pill_h - 2)
                pill_y2 = pill_y1 + pill_h
                pill_x1 = max(0, x1)
                pill_x2 = min(w - 1, pill_x1 + pill_w)

                # Pill background in status color with subtle shadow
                cv2.rectangle(out, (pill_x1, pill_y1), (pill_x2, pill_y2), color, -1)
                cv2.rectangle(out, (pill_x1, pill_y1), (pill_x2, pill_y2), COLOR_DARK, 1, lineType=cv2.LINE_AA)
                cv2.putText(
                    out,
                    label,
                    (pill_x1 + 5, pill_y2 - 5),
                    font,
                    font_scale,
                    COLOR_DARK if t.status == "watch" else COLOR_WHITE,
                    font_thick,
                    lineType=cv2.LINE_AA,
                )

        return out

