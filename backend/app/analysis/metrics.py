import math
from typing import Dict, List, Tuple, Any
import numpy as np
from scipy.spatial.distance import pdist, squareform
from backend.app.vision.tracker_state import AnimalTrackState


def compute_flock_metrics(
    tracks: List[AnimalTrackState],
    frame_width: int = 1920,
    frame_height: int = 1080,
    inactivity_speed_norm: float = 0.05,
    cluster_dist_bl: float = 1.8,
    grid_rows: int = 4,
    grid_cols: int = 4,
) -> Dict[str, Any]:
    """
    Computes real aggregate flock-level metrics from active tracks.
    Supports multi-species breakdown and spatial density cluster detection for large flocks.
    """
    count = len(tracks)
    if count == 0:
        return {
            "count": 0,
            "species_counts": {},
            "active_count": 0,
            "idle_count": 0,
            "mean_speed_norm": 0.0,
            "activity_index": 0.0,
            "dispersion": 0.0,
            "crowding_index": 0.0,
            "max_cluster_size": 0,
            "clusters": [],
            "centroid": (frame_width / 2.0, frame_height / 2.0),
            "zone_occupancy": [[0 for _ in range(grid_cols)] for _ in range(grid_rows)],
        }

    # Species breakdown
    species_counts: Dict[str, int] = {}
    for t in tracks:
        sp = getattr(t, "species", "chicken")
        species_counts[sp] = species_counts.get(sp, 0) + 1

    speeds = [t.last_speed_norm for t in tracks]
    mean_speed = float(np.mean(speeds))

    active_tracks = [t for t in tracks if t.last_speed_norm >= inactivity_speed_norm]
    active_count = len(active_tracks)
    idle_count = count - active_count

    # Activity Index (0 to 100)
    # Composite of ratio of moving animals (50% weight) and normalized velocity scaled to nominal range (50% weight)
    active_ratio = active_count / count
    speed_factor = min(1.0, mean_speed / 0.5)  # 0.5 body lengths / s is robust active movement
    activity_index = float(np.clip((0.5 * active_ratio + 0.5 * speed_factor) * 100.0, 0.0, 100.0))

    # Spatial distribution: centroid and dispersion
    centroids = np.array([t.last_centroid for t in tracks])  # shape (N, 2)
    flock_centroid = np.mean(centroids, axis=0)  # [mean_x, mean_y]

    mean_diag = float(np.mean([t.last_diag for t in tracks]))
    if mean_diag <= 0:
        mean_diag = 100.0

    distances_to_flock_center = np.linalg.norm(centroids - flock_centroid, axis=1)
    # Dispersion normalized by mean body length
    dispersion = float(np.mean(distances_to_flock_center) / mean_diag)

    # Crowding index & Spatial clustering (Connected components on proximity graph)
    crowding_index = 0.0
    clusters: List[Dict[str, Any]] = []
    max_cluster_size = 1

    if count >= 2:
        pairwise_dists = pdist(centroids)
        close_threshold_px = 1.5 * mean_diag
        close_pairs = np.sum(pairwise_dists < close_threshold_px)
        total_pairs = len(pairwise_dists)
        crowding_index = float(close_pairs / max(1, total_pairs))

        # Build cluster adjacency matrix
        dist_matrix = squareform(pairwise_dists)
        cluster_thresh_px = cluster_dist_bl * mean_diag
        adj = dist_matrix <= cluster_thresh_px

        visited = [False] * count
        cluster_id = 1

        for i in range(count):
            if not visited[i]:
                # Breadth-first search for connected component
                comp = []
                queue = [i]
                visited[i] = True
                while queue:
                    curr = queue.pop(0)
                    comp.append(curr)
                    for nbr in range(count):
                        if adj[curr][nbr] and not visited[nbr]:
                            visited[nbr] = True
                            queue.append(nbr)

                if len(comp) >= 2:
                    cluster_centroids = centroids[comp]
                    c_center = np.mean(cluster_centroids, axis=0)
                    animal_ids = [tracks[idx].animal_id for idx in comp]
                    clusters.append({
                        "cluster_id": cluster_id,
                        "count": len(comp),
                        "size": len(comp),
                        "centroid": (float(c_center[0]), float(c_center[1])),
                        "animal_ids": animal_ids,
                    })
                    max_cluster_size = max(max_cluster_size, len(comp))
                    cluster_id += 1

    # Zone occupancy grid (normalized counts per grid cell)
    zone_occupancy = [[0 for _ in range(grid_cols)] for _ in range(grid_rows)]
    col_w = frame_width / grid_cols
    row_h = frame_height / grid_rows

    for cx, cy in centroids:
        c = int(np.clip(cx // col_w, 0, grid_cols - 1))
        r = int(np.clip(cy // row_h, 0, grid_rows - 1))
        zone_occupancy[r][c] += 1

    return {
        "count": count,
        "species_counts": species_counts,
        "active_count": active_count,
        "idle_count": idle_count,
        "mean_speed_norm": round(mean_speed, 4),
        "activity_index": round(activity_index, 1),
        "dispersion": round(dispersion, 2),
        "crowding_index": round(crowding_index, 3),
        "max_cluster_size": max_cluster_size,
        "clusters": clusters,
        "centroid": (float(flock_centroid[0]), float(flock_centroid[1])),
        "zone_occupancy": zone_occupancy,
    }
