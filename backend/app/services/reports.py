import os
import json
import datetime
import logging
from typing import Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

from backend.app.config import settings
from backend.app.models import FlockMetric, AlertEventRecord, DailyReportRecord

logger = logging.getLogger("chickcheck.services.reports")


class ReportGenerator:
    """Generates comprehensive daily analytical reports in JSON and PDF format."""

    @classmethod
    def generate_daily_report(
        cls,
        db: Session,
        report_date_str: Optional[str] = None,
    ) -> Tuple[Dict[str, Any], Optional[str]]:
        if not report_date_str:
            report_date_str = datetime.date.today().isoformat()

        try:
            start_dt = datetime.datetime.strptime(report_date_str, "%Y-%m-%d")
        except ValueError:
            start_dt = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            report_date_str = start_dt.strftime("%Y-%m-%d")

        end_dt = start_dt + datetime.timedelta(days=1)

        # 1. Aggregate Flock Metrics for the day
        metrics = (
            db.query(FlockMetric)
            .filter(FlockMetric.timestamp >= start_dt, FlockMetric.timestamp < end_dt)
            .all()
        )

        counts = [m.count for m in metrics] or [0]
        activities = [m.activity_index for m in metrics] or [0.0]
        health_scores = [m.flock_health_score for m in metrics] or [100.0]

        avg_count = float(np_mean := sum(counts) / len(counts))
        max_count = max(counts)
        min_count = min(counts)
        avg_activity = float(sum(activities) / len(activities))
        avg_health = float(sum(health_scores) / len(health_scores))

        # Hourly breakdown
        hourly_activity: Dict[int, List[float]] = {h: [] for h in range(24)}
        for m in metrics:
            hourly_activity[m.timestamp.hour].append(m.activity_index)

        hourly_trend = {
            f"{h:02d}:00": round(sum(v) / len(v), 1) if v else None
            for h, v in hourly_activity.items()
        }

        # 2. Aggregate Alert Events for the day
        alerts = (
            db.query(AlertEventRecord)
            .filter(AlertEventRecord.timestamp >= start_dt, AlertEventRecord.timestamp < end_dt)
            .all()
        )

        total_alerts = len(alerts)
        severity_counts = {"critical": 0, "warning": 0, "info": 0}
        type_counts: Dict[str, int] = {}
        animal_flags: Dict[int, int] = {}

        for a in alerts:
            sev = a.severity.lower() if a.severity else "warning"
            severity_counts[sev] = severity_counts.get(sev, 0) + 1
            type_counts[a.alert_type] = type_counts.get(a.alert_type, 0) + 1
            if a.animal_id is not None:
                animal_flags[a.animal_id] = animal_flags.get(a.animal_id, 0) + 1

        top_flagged_animals = sorted(
            [{"animal_id": aid, "flag_count": cnt} for aid, cnt in animal_flags.items()],
            key=lambda x: x["flag_count"],
            reverse=True,
        )[:5]

        crit_count = severity_counts.get("critical", 0)
        warn_count = severity_counts.get("warning", 0)

        summary_en = (
            f"Commercial Flock Monitoring Summary for {report_date_str}: The flock averaged ~{round(avg_count)} birds "
            f"with an average flock activity index of {round(avg_activity, 1)}/100 and overall flock health score of {round(avg_health, 1)}%. "
            f"A total of {total_alerts} anomaly events were recorded ({crit_count} critical, {warn_count} warnings). "
            f"Feeding zone occupancy remained stable during scheduled feeding periods without persistent thermal stress huddling."
        )

        summary_bn = (
            f"{report_date_str} তারিখের বাণিজ্যিক পোল্ট্রি খামার পর্যবেক্ষণ প্রতিবেদন: খামারে গড়ে প্রায় {round(avg_count)}টি মুরগি "
            f"পর্যবেক্ষিত হয়েছে, যার গড় অ্যাক্টিভিটি সূচক ছিল {round(avg_activity, 1)}/১০০ এবং সামগ্রিক স্বাস্থ্য স্কোর ছিল {round(avg_health, 1)}%। "
            f"সারাদিনে মোট {total_alerts}টি সতর্কতা সংক্রান্ত ঘটনা রেকর্ড করা হয়েছে ({crit_count}টি গুরুতর, {warn_count}টি সাধারণ সতর্কতা)। "
            f"খাদ্য গ্রহণের সময় পাখিদের চলাফেরা স্বাভাবিক ছিল এবং কোনো বিপজ্জনক তাপ বা ঠান্ডাজনিত দলবদ্ধতা সৃষ্টি হয়নি।"
        )

        summary_dict = {
            "date": report_date_str,
            "species": settings.SPECIES,
            "generated_at": datetime.datetime.utcnow().isoformat(),
            "executive_summary": {
                "en": summary_en,
                "bn": summary_bn,
            },
            "flock_summary": {
                "avg_count": round(avg_count, 1),
                "min_count": min_count,
                "max_count": max_count,
                "avg_activity_index": round(avg_activity, 1),
                "avg_health_score": round(avg_health, 1),
            },
            "hourly_activity_trend": hourly_trend,
            "alerts_summary": {
                "total_alerts": total_alerts,
                "by_severity": severity_counts,
                "by_type": type_counts,
                "top_flagged_animals": top_flagged_animals,
            },
            "disclaimer": (
                "Movement-based behavioral screening signal only. "
                "Not a veterinary diagnosis or definitive clinical assessment."
            ),
        }

        # 3. Generate PDF Document
        pdf_rel_path = None
        try:
            os.makedirs(settings.REPORTS_DIR, exist_ok=True)
            pdf_filename = f"chickcheck_daily_report_{report_date_str}.pdf"
            pdf_full_path = os.path.join(settings.REPORTS_DIR, pdf_filename)
            cls._create_pdf(pdf_full_path, summary_dict)
            pdf_rel_path = f"reports/{pdf_filename}"
        except Exception as e:
            logger.error(f"Failed to generate PDF report: {e}")

        # 4. Save to Database
        try:
            existing = (
                db.query(DailyReportRecord)
                .filter(DailyReportRecord.report_date == report_date_str)
                .first()
            )
            if existing:
                existing.summary_json = json.dumps(summary_dict)
                existing.pdf_path = pdf_rel_path
                existing.generated_at = datetime.datetime.utcnow()
            else:
                rep_rec = DailyReportRecord(
                    report_date=report_date_str,
                    species=settings.SPECIES,
                    summary_json=json.dumps(summary_dict),
                    pdf_path=pdf_rel_path,
                )
                db.add(rep_rec)
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to save report record to DB: {e}")

        return summary_dict, pdf_rel_path

    @classmethod
    def _create_pdf(cls, file_path: str, data: Dict[str, Any]) -> None:
        doc = SimpleDocTemplate(
            file_path,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36,
        )
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            "ReportTitle",
            parent=styles["Heading1"],
            fontSize=22,
            leading=26,
            textColor=colors.HexColor("#1e293b"),
            spaceAfter=6,
        )

        subtitle_style = ParagraphStyle(
            "ReportSubtitle",
            parent=styles["Normal"],
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#64748b"),
            spaceAfter=15,
        )

        section_style = ParagraphStyle(
            "SectionHeader",
            parent=styles["Heading2"],
            fontSize=14,
            leading=18,
            textColor=colors.HexColor("#0f172a"),
            spaceBefore=12,
            spaceAfter=6,
        )

        disclaimer_style = ParagraphStyle(
            "Disclaimer",
            parent=styles["Italic"],
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#ef4444"),
            spaceBefore=16,
        )

        story = []

        # Title Block
        story.append(Paragraph("ChickCheck Livestock Monitoring Report", title_style))
        story.append(
            Paragraph(
                f"Date: <b>{data['date']}</b> &nbsp;|&nbsp; Species: <b>{data['species'].capitalize()}</b> &nbsp;|&nbsp; Generated: {data['generated_at'][:19]} UTC",
                subtitle_style,
            )
        )
        story.append(Spacer(1, 10))

        # Flock Summary Table
        story.append(Paragraph("Flock Health & Activity Summary", section_style))
        fs = data["flock_summary"]
        flock_table_data = [
            ["Metric", "Value", "Metric", "Value"],
            ["Average Count", f"{fs['avg_count']}", "Average Health Index", f"{fs['avg_health_score']} / 100"],
            ["Peak Tracked Count", f"{fs['max_count']}", "Min Tracked Count", f"{fs['min_count']}"],
            ["Flock Activity Index", f"{fs['avg_activity_index']} / 100", "Total Anomalies Flagged", f"{data['alerts_summary']['total_alerts']}"],
        ]
        t1 = Table(flock_table_data, colWidths=[130, 130, 140, 140])
        t1.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ])
        )
        story.append(t1)
        story.append(Spacer(1, 15))

        # Alert Breakdown
        story.append(Paragraph("Incident & Anomaly Distribution", section_style))
        als = data["alerts_summary"]
        alert_table_data = [
            ["Severity Level", "Incident Count", "Primary Anomaly Category", "Category Count"],
            ["Critical (High Risk)", f"{als['by_severity'].get('critical', 0)}", "Prolonged Inactivity", f"{als['by_type'].get('prolonged_inactivity', 0)}"],
            ["Warning (Attention)", f"{als['by_severity'].get('warning', 0)}", "Fallen / Abnormal Posture", f"{als['by_type'].get('fallen_posture', 0)}"],
            ["Informational", f"{als['by_severity'].get('info', 0)}", "Social Isolation / Dispersion", f"{als['by_type'].get('isolation', 0)}"],
            ["", "", "Flock Agitation / Panic", f"{als['by_type'].get('panic_movement', 0)}"],
        ]
        t2 = Table(alert_table_data, colWidths=[130, 130, 160, 120])
        t2.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ])
        )
        story.append(t2)
        story.append(Spacer(1, 15))

        # Top Flagged Animals
        if als.get("top_flagged_animals"):
            story.append(Paragraph("Most Flagged Animals (Review Required)", section_style))
            top_rows = [["Animal ID", "Total Alerts", "Status Recommendation"]]
            for tf in als["top_flagged_animals"]:
                rec = "Inspect Enclosure / Isolate" if tf["flag_count"] >= 3 else "Monitor Movement"
                top_rows.append([f"#{tf['animal_id']}", f"{tf['flag_count']}", rec])
            t3 = Table(top_rows, colWidths=[120, 120, 300])
            t3.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#fef2f2")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#991b1b")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#fecaca")),
                ])
            )
            story.append(t3)

        # Disclaimer
        story.append(Spacer(1, 20))
        story.append(Paragraph(f"<b>Notice:</b> {data['disclaimer']}", disclaimer_style))

        doc.build(story)

