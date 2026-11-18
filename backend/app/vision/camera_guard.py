from typing import Dict, Any, Optional
import numpy as np
import cv2


class CameraGuard:
    """
    Guards computer vision pipeline against physical farm camera faults:
    1. Blackout / Lighting failure (loss of barn lighting or camera night mode failure).
    2. Lens obstruction / Dirt / Spider webs / Steam buildup (drastic drop in edge variance).
    3. Camera bump / Tilt displacement (large coherent optical flow translation across whole frame).
    
    When a camera fault occurs, raises an operational maintenance alert rather than
    corrupting flock health statistics with false animal warnings.
    """

    def __init__(
        self,
        min_luminance: float = 12.0,
        max_luminance: float = 245.0,
        min_edge_variance: float = 15.0,
        max_camera_shift_px: float = 35.0,
    ):
        self.min_luminance = min_luminance
        self.max_luminance = max_luminance
        self.min_edge_variance = min_edge_variance
        self.max_camera_shift_px = max_camera_shift_px

    def check(self, frame_bgr: np.ndarray, optical_flow_data: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """Convenience alias for check_frame."""
        res = self.check_frame(frame_bgr, optical_flow_data)
        if res:
            res["type"] = res.get("fault_type", "camera_fault")
            res["description"] = res.get("message", "Camera fault detected")
        return res

    def check_frame(self, frame_bgr: np.ndarray, optical_flow_data: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """
        Inspects frame for operational hardware faults.
        Returns None if normal, or Dict describing the camera fault.
        """
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        mean_lum = float(np.mean(gray))

        # 1. Blackout or Blinding Glare check
        if mean_lum < self.min_luminance:
            return {
                "fault_type": "blackout_or_lighting_failure",
                "severity": "critical",
                "message": f"Barn illumination failure or camera blackout (mean luminance: {mean_lum:.1f})",
                "metric_value": mean_lum,
                "threshold": self.min_luminance,
            }
        elif mean_lum > self.max_luminance:
            return {
                "fault_type": "camera_glare_or_overexposure",
                "severity": "warning",
                "message": f"Severe camera overexposure or direct light glare (mean luminance: {mean_lum:.1f})",
                "metric_value": mean_lum,
                "threshold": self.max_luminance,
            }

        # 2. Lens Obstruction / Dust / Spiderweb / Defocus check
        # High-frequency edge definition via Laplacian variance
        lap = cv2.Laplacian(gray, cv2.CV_64F)
        edge_var = float(lap.var())

        if edge_var < self.min_edge_variance:
            return {
                "fault_type": "lens_obstruction_or_defocus",
                "severity": "warning",
                "message": f"Camera lens obstructed, dust-coated, or defocused (edge variance: {edge_var:.1f})",
                "metric_value": edge_var,
                "threshold": self.min_edge_variance,
            }

        # 3. Camera Physical Shift / Bump check (global translation spike)
        if optical_flow_data:
            flow_mag = optical_flow_data.get("mean_magnitude", 0.0)
            if flow_mag > self.max_camera_shift_px:
                return {
                    "fault_type": "camera_physical_shift",
                    "severity": "warning",
                    "message": f"Camera mounting bumped or tilted (global motion shift: {flow_mag:.1f}px)",
                    "metric_value": flow_mag,
                    "threshold": self.max_camera_shift_px,
                }

        return None
