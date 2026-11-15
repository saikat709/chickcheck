import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.db import get_db
from backend.app.models import DailyReportRecord
from backend.app.services.reports import ReportGenerator

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/daily")
def get_daily_report(
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    format: str = Query("json", pattern="^(json|pdf)$"),
    db: Session = Depends(get_db),
):
    """
    Returns daily livestock activity & anomaly report either as structured JSON or compiled PDF.
    """
    summary, pdf_rel_path = ReportGenerator.generate_daily_report(db, date)

    if format == "pdf":
        if not pdf_rel_path:
            raise HTTPException(status_code=500, detail="Failed to compile PDF report.")
        full_path = os.path.join(settings.DATA_DIR, pdf_rel_path)
        if not os.path.exists(full_path):
            raise HTTPException(status_code=404, detail="PDF report file not found on disk.")
        return FileResponse(
            full_path,
            media_type="application/pdf",
            filename=f"chickcheck_report_{summary['date']}.pdf",
        )

    return JSONResponse(summary)


@router.post("/generate")
def generate_report_now(
    date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Triggers immediate calculation and PDF generation of daily summary."""
    summary, pdf_path = ReportGenerator.generate_daily_report(db, date)
    return {
        "success": True,
        "date": summary["date"],
        "pdf_path": pdf_path,
        "summary": summary,
    }

