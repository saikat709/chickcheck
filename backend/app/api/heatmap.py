from fastapi import APIRouter, Query, Response
from fastapi.responses import JSONResponse
from backend.app.services.pipeline import pipeline

router = APIRouter(prefix="/api/heatmap", tags=["heatmap"])


@router.get("")
def get_heatmap(format: str = Query("png", regex="^(png|json)$")):
    """
    Returns rolling livestock spatial density either as a PNG color map or 2D JSON grid.
    """
    if format == "json":
        grid = pipeline.heatmap.to_grid(rows=16, cols=16)
        return JSONResponse({"rows": 16, "cols": 16, "grid": grid})

    png_bytes = pipeline.heatmap.to_png_bytes()
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"Cache-Control": "no-cache, max-age=1"},
    )

