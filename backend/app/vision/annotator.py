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
        box_shape: str = "corners",
    ) -> np.ndarray:
        out = frame.copy()
        h, w = out.shape[:2]

        # 1. Heatmap blend if requested
        if show_heatmap and heatmap is not None:
            heat_rgb, mask = heatmap.get_overlay(out.shape)
            mask_norm = (mask.astype(float) / 255.0)[:, :, None]
            out = (out * (1.0 - 0.45 * mask_norm) + heat_rgb * (0.45 * mask_norm)).astype(np.uint8)

        # 2. Render Spatial Clusters / Huddles (in dense crowd scenarios)
        if clusters:
            for cl in clusters:
                if cl.get("size", cl.get("count", 0)) >= 3:
                    cx, cy = int(cl["centroid"][0]), int(cl["centroid"][1])
                    cr = max(25, int(cl.get("radius", 40)))
                    cv2.circle(out, (cx, cy), cr, (40, 140, 255), 2, lineType=cv2.LINE_AA)
                    cl_label = f"Huddle: {cl.get('size', cl.get('count', 0))}"
                    (cl_w, cl_h), _ = cv2.getTextSize(cl_label, cv2.FONT_HERSHEY_SIMPLEX, 0.4, 1)
                    cv2.rectangle(out, (cx - cl_w // 2 - 4, cy - cr - cl_h - 4), (cx + cl_w // 2 + 4, cy - cr), (24, 24, 27), -1)
                    cv2.putText(out, cl_label, (cx - cl_w // 2, cy - cr - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (40, 200, 255), 1, cv2.LINE_AA)

        # 3. Render Motion Trails (drawn behind boxes)
        for t in tracks:
            trail_pts = list(t.trail)
            color = cls.get_status_color(t.status)
            n_pts = len(trail_pts)
            for idx in range(1, n_pts):
                p1 = (int(trail_pts[idx - 1][0]), int(trail_pts[idx - 1][1]))
                p2 = (int(trail_pts[idx][0]), int(trail_pts[idx][1]))
                alpha = idx / float(n_pts)
                thickness = max(1, int(3 * alpha))
                cv2.line(out, p1, p2, color, thickness, lineType=cv2.LINE_AA)

            # Dot at current centroid
            if trail_pts:
                last_pt = (int(trail_pts[-1][0]), int(trail_pts[-1][1]))
                cv2.circle(out, last_pt, 4, color, -1, lineType=cv2.LINE_AA)

        # 4. Render Tracking Boxes, Shapes, and ID Badges on Detected Entities
        if show_boxes:
            for t in tracks:
                x1, y1, x2, y2 = map(int, t.last_bbox)
                # Keep coordinates within frame boundaries
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(w - 1, x2), min(h - 1, y2)
                bw = max(2, x2 - x1)
                bh = max(2, y2 - y1)
                cx = (x1 + x2) // 2
                cy = (y1 + y2) // 2
                color = cls.get_status_color(t.status)

                # Render tracking shape according to selected shape style
                if box_shape == "solid":
                    # Full bounding box with corner accents
                    cv2.rectangle(out, (x1, y1), (x2, y2), color, 2, lineType=cv2.LINE_AA)
                    cv2.drawMarker(out, (cx, cy), color, cv2.MARKER_CROSS, markerSize=8, thickness=1, line_type=cv2.LINE_AA)
                elif box_shape == "ellipse":
                    # Smooth bounding ellipse surrounding entity contour
                    ew = max(12, bw // 2)
                    eh = max(12, bh // 2)
                    cv2.ellipse(out, (cx, cy), (ew, eh), 0, 0, 360, color, 2, lineType=cv2.LINE_AA)
                    cv2.drawMarker(out, (cx, cy), color, cv2.MARKER_CROSS, markerSize=8, thickness=1, line_type=cv2.LINE_AA)
                elif box_shape == "reticle":
                    # Target reticle circle around entity center with targeting crosshairs
                    rad = max(14, min(bw, bh) // 2)
                    cv2.circle(out, (cx, cy), rad, color, 2, lineType=cv2.LINE_AA)
                    cv2.line(out, (cx - rad - 5, cy), (cx + rad + 5, cy), color, 1, cv2.LINE_AA)
                    cv2.line(out, (cx, cy - rad - 5), (cx, cy + rad + 5), color, 1, cv2.LINE_AA)
                    cv2.circle(out, (cx, cy), 3, color, -1, lineType=cv2.LINE_AA)
                else:  # "corners" (default modern HUD style)
                    # Thin box border with bold corner brackets
                    cv2.rectangle(out, (x1, y1), (x2, y2), color, 1, lineType=cv2.LINE_AA)
                    corner_len = min(20, max(8, bw // 4, bh // 4))
                    if corner_len > 3:
                        # Top-left corner
                        cv2.line(out, (x1, y1), (x1 + corner_len, y1), color, 3, cv2.LINE_AA)
                        cv2.line(out, (x1, y1), (x1, y1 + corner_len), color, 3, cv2.LINE_AA)
                        # Top-right corner
                        cv2.line(out, (x2, y1), (x2 - corner_len, y1), color, 3, cv2.LINE_AA)
                        cv2.line(out, (x2, y1), (x2, y1 + corner_len), color, 3, cv2.LINE_AA)
                        # Bottom-left corner
                        cv2.line(out, (x1, y2), (x1 + corner_len, y2), color, 3, cv2.LINE_AA)
                        cv2.line(out, (x1, y2), (x1, y2 - corner_len), color, 3, cv2.LINE_AA)
                        # Bottom-right corner
                        cv2.line(out, (x2, y2), (x2 - corner_len, y2), color, 3, cv2.LINE_AA)
                        cv2.line(out, (x2, y2), (x2, y2 - corner_len), color, 3, cv2.LINE_AA)
                    cv2.drawMarker(out, (cx, cy), color, cv2.MARKER_CROSS, markerSize=8, thickness=1, line_type=cv2.LINE_AA)

                # Entity Track ID Tag: e.g. "ID: #12 [88]" or "ID: #12 Duck [88]"
                spec_tag = f" {t.species.capitalize()}" if (t.species and t.species != "chicken") else ""
                label = f"ID: #{t.animal_id}{spec_tag} [{int(t.health_score)}]"
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 0.44
                thickness = 1
                (tw, th), baseline = cv2.getTextSize(label, font, font_scale, thickness)

                # Position label directly above top-left of box
                pill_y1 = max(45, y1 - th - 8)
                pill_y2 = pill_y1 + th + 8
                pill_x1 = max(0, x1)
                pill_x2 = min(w - 1, pill_x1 + tw + 10)

                # Pill background with solid status color
                cv2.rectangle(out, (pill_x1, pill_y1), (pill_x2, pill_y2), color, -1)
                # Subtle dark outline on pill
                cv2.rectangle(out, (pill_x1, pill_y1), (pill_x2, pill_y2), COLOR_DARK, 1, lineType=cv2.LINE_AA)
                cv2.putText(
                    out,
                    label,
                    (pill_x1 + 5, pill_y2 - 5),
                    font,
                    font_scale,
                    COLOR_DARK if t.status == "watch" else COLOR_WHITE,
                    thickness,
                    lineType=cv2.LINE_AA,
                )

        # 5. Render HUD Header
        hud_h = 42
        hud_overlay = out.copy()
        cv2.rectangle(hud_overlay, (0, 0), (w, hud_h), COLOR_DARK, -1)
        cv2.addWeighted(hud_overlay, 0.85, out, 0.15, 0, out)

        status_color = cls.get_status_color(flock_status)
        time_str = datetime.datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M:%S")

        # Left HUD: Title & Status pill
        font = cv2.FONT_HERSHEY_SIMPLEX
        cv2.putText(out, "CHICKCHECK", (15, 27), font, 0.65, COLOR_WHITE, 2, cv2.LINE_AA)
        cv2.putText(out, f"| {species.upper()}", (145, 27), font, 0.55, (200, 200, 200), 1, cv2.LINE_AA)

        # Enhanced badge if CLAHE/adaptive enhancement was active
        curr_x = 245
        if was_enhanced:
            enh_text = "ENHANCED (CLAHE)"
            (ew, eh), _ = cv2.getTextSize(enh_text, font, 0.4, 1)
            cv2.rectangle(out, (curr_x, 10), (curr_x + ew + 10, 32), (180, 100, 20), -1)
            cv2.putText(out, enh_text, (curr_x + 5, 25), font, 0.4, COLOR_WHITE, 1, cv2.LINE_AA)
            curr_x += ew + 18

        # Status badge
        badge_text = f"FLOCK: {flock_status.upper()} ({int(flock_health_score)})"
        (bw, bh), _ = cv2.getTextSize(badge_text, font, 0.5, 1)
        cv2.rectangle(out, (curr_x, 8), (curr_x + bw + 14, 34), status_color, -1)
        cv2.putText(
            out,
            badge_text,
            (curr_x + 7, 26),
            font,
            0.5,
            COLOR_DARK if flock_status == "watch" else COLOR_WHITE,
            1,
            cv2.LINE_AA,
        )

        # Right HUD: Count, FPS, Time
        right_info = f"Tracked: {len(tracks)}   FPS: {fps:.1f}   {time_str}"
        (rw, rh), _ = cv2.getTextSize(right_info, font, 0.5, 1)
        cv2.putText(out, right_info, (max(curr_x + bw + 20, w - rw - 15), 26), font, 0.5, COLOR_WHITE, 1, cv2.LINE_AA)

        return out

