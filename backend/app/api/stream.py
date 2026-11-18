import asyncio
import json
import logging
from fastapi import APIRouter, Request, Query
from fastapi.responses import StreamingResponse
from backend.app.services.pipeline import pipeline

logger = logging.getLogger("chickcheck.api.stream")
router = APIRouter(prefix="/api/stream", tags=["stream"])


@router.get("/video")
def get_video_stream(
    heatmap: bool = Query(False, description="Overlay density heatmap"),
    show_boxes: bool = Query(True, description="Render tracking boxes and entity ID numbers"),
    box_shape: str = Query("box", pattern="^(box|corners|solid|ellipse|reticle)$", description="Tracking box/shape style"),
    show_trails: bool = Query(False, description="Render animal motion trajectory lines"),
    show_clusters: bool = Query(False, description="Render spatial crowding cluster circles"),
    show_flow: bool = Query(False, description="Render dense optical flow motion vectors"),
    show_zones: bool = Query(False, description="Render barn zones overlay"),
):
    """
    Yields multipart MJPEG video stream of annotated livestock footage.
    """
    pipeline.toggle_heatmap_overlay(heatmap)
    pipeline.set_annotation_style(
        show_boxes=show_boxes,
        box_shape=box_shape,
        show_trails=show_trails,
        show_clusters=show_clusters,
        show_flow=show_flow,
        show_zones=show_zones,
    )

    def frame_generator():
        last_frame = None
        while pipeline.running:
            jpg_bytes = pipeline.get_latest_jpeg()
            if jpg_bytes is not None and jpg_bytes != last_frame:
                last_frame = jpg_bytes
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + jpg_bytes + b"\r\n"
                )
            # Sleep briefly to pace stream at ~30 FPS
            import time
            time.sleep(0.033)

    return StreamingResponse(
        frame_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache"},
    )


@router.get("/events")
async def get_events_sse(request: Request):
    """
    SSE stream emitting live event alerts, flock metrics ticks, and status changes.
    """
    client_queue = pipeline.subscribe_sse()

    async def event_generator():
        try:
            # Yield initial connection confirmation
            init_stats = pipeline.get_latest_stats()
            yield f"event: connected\ndata: {json.dumps(init_stats)}\n\n"

            while pipeline.running:
                if await request.is_disconnected():
                    break

                try:
                    msg = await asyncio.wait_for(client_queue.get(), timeout=2.0)
                    if msg.get("type") == "shutdown":
                        break
                    evt_type = msg.get("type", "message")
                    data_str = json.dumps(msg.get("data", {}))
                    yield f"event: {evt_type}\ndata: {data_str}\n\n"
                except asyncio.TimeoutError:
                    # Keep-alive heartbeat comment
                    yield ": ping\n\n"
        finally:
            pipeline.unsubscribe_sse(client_queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

