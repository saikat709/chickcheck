"""Sohayok AI (সহায়ক এআই) RAG Engine powered by Fireworks AI.

Combines live computer-vision flock telemetry, historical alert logs, and
a curated poultry veterinary knowledge base to deliver intelligent, bilingual
answers for poultry farmers.
"""

import logging
from typing import List, Dict, Any, Optional
import httpx
from sqlalchemy import desc

from backend.app.config import settings
from backend.app.db import SessionLocal
from backend.app.models import AlertEventRecord
from backend.app.services.pipeline import pipeline
from backend.app.services.knowledge_base import retrieve_relevant_knowledge

logger = logging.getLogger("chickcheck.sohayok")


def get_current_flock_context() -> Dict[str, Any]:
    """Gather live shed metrics and active alert events."""
    stats = pipeline.get_latest_stats() or {}

    # Query recent unacknowledged alerts from DB
    recent_alerts: List[str] = []
    try:
        with SessionLocal() as db:
            alerts = (
                db.query(AlertEventRecord)
                .order_by(desc(AlertEventRecord.timestamp))
                .limit(5)
                .all()
            )
            for a in alerts:
                status = "Unacked" if not a.acknowledged else "Acked"
                recent_alerts.append(
                    f"[{a.severity.upper()} - {status}] {a.title}: {a.description}"
                )
    except Exception as e:
        logger.warning(f"Could not load recent alerts for Sohayok: {e}")

    return {
        "bird_count": stats.get("count", 0),
        "active_count": stats.get("active_count", 0),
        "idle_count": stats.get("idle_count", 0),
        "flock_health_score": round(stats.get("flock_health_score", 100.0), 1),
        "flock_status": stats.get("status", "healthy"),
        "activity_index": round(stats.get("activity_index", 50.0), 1),
        "clustering_index": round(stats.get("dispersion", 0.0), 2),
        "fps": round(stats.get("fps", 0.0), 1),
        "pipeline_running": pipeline.running,
        "species": settings.SPECIES,
        "recent_alerts": recent_alerts,
    }


def build_system_prompt(
    telemetry: Dict[str, Any],
    knowledge_articles: List[Dict[str, Any]],
    user_language: str = "en",
) -> str:
    """Build a comprehensive RAG system prompt with live shed data and reference knowledge."""
    alerts_text = (
        "\n".join([f"- {a}" for a in telemetry.get("recent_alerts", [])])
        if telemetry.get("recent_alerts")
        else "No recent critical alerts. Flock is stable."
    )

    articles_text = ""
    for idx, art in enumerate(knowledge_articles, start=1):
        articles_text += (
            f"\n[REFERENCE {idx}] {art['title_en']} ({art['title_bn']})\n"
            f"English Context:\n{art['content_en']}\n"
            f"Bengali Context:\n{art['content_bn']}\n"
        )

    prompt = f"""You are "Sohayok AI" (সহায়ক এআই), the expert intelligent poultry farming assistant for the ChickCheck flock monitoring platform.

### CORE OBJECTIVES:
1. Provide accurate, practical, and compassionate guidance to poultry farmers and farm managers.
2. Integrate real-time ChickCheck computer-vision telemetry when answering questions about current flock status.
3. Use the provided Veterinary Knowledge References for disease diagnosis, brooding, vaccination, and heat stress.
4. Seamlessly support both Bengali (বাংলা) and English. If the user writes in Bengali, reply in fluent, natural Bengali. If they write in English, reply in English.
5. Keep your tone supportive, authoritative yet humble. Use clear formatting, bullet points, and actionable steps.
6. MANDATORY VETERINARY NOTICE: ChickCheck is an automated kinematic screening tool. For clinical diagnoses or prescription medication, always remind the farmer to verify with a registered veterinarian.

### REAL-TIME SHED TELEMETRY (CHICKCHECK LIVE STATUS):
- Video Pipeline: {'Active & Running' if telemetry['pipeline_running'] else 'Paused / Stopped'}
- Monitored Species: {telemetry['species']}
- Total Detected Birds: {telemetry['bird_count']} (Active: {telemetry['active_count']}, Idle/Stationary: {telemetry['idle_count']})
- Flock Health Index: {telemetry['flock_health_score']}/100 [Status: {telemetry['flock_status'].upper()}]
- Flock Activity Index: {telemetry['activity_index']}/100
- Processing Speed: {telemetry['fps']} FPS
- Recent Shed Alert Logs:
{alerts_text}

### RETRIEVED VETERINARY & MANAGEMENT KNOWLEDGE:
{articles_text}

Answer the user's inquiry directly using this live context and knowledge base.
"""
    return prompt


async def query_sohayok_ai(
    user_message: str,
    chat_history: Optional[List[Dict[str, str]]] = None,
    preferred_language: str = "en",
) -> Dict[str, Any]:
    """Execute RAG query against Fireworks AI and return response with citations."""
    if not user_message or not user_message.strip():
        return {
            "reply": "Please ask a question regarding your flock or poultry care.",
            "sources": [],
            "telemetry": {},
            "model": "none",
        }

    # 1. Fetch live telemetry & relevant knowledge articles
    telemetry = get_current_flock_context()
    knowledge_articles = retrieve_relevant_knowledge(user_message, top_k=3)

    # Prepare citation sources
    sources = [
        {
            "id": art["id"],
            "title": art["title_bn"] if preferred_language == "bn" else art["title_en"],
            "category": art["category"],
        }
        for art in knowledge_articles
    ]

    # Include live telemetry as a source if flock context was active
    sources.insert(
        0,
        {
            "id": "live_shed_telemetry",
            "title": "লাইভ শেড টেলিমেট্রি (Live Shed Telemetry)" if preferred_language == "bn" else "Live Shed Telemetry",
            "category": "live_monitoring",
        },
    )

    # 2. Build system prompt
    system_prompt = build_system_prompt(telemetry, knowledge_articles, preferred_language)

    # 3. Construct chat messages payload
    messages = [{"role": "system", "content": system_prompt}]

    # Append recent chat history if provided (limit to last 6 messages to preserve context window)
    if chat_history:
        for msg in chat_history[-6:]:
            if msg.get("role") in ["user", "assistant"] and msg.get("content"):
                messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": user_message})

    # 4. Attempt call to Fireworks AI
    headers = {
        "Authorization": f"Bearer {settings.FIREWORKS_API_KEY}",
        "Content-Type": "application/json",
    }
    url = f"{settings.FIREWORKS_BASE_URL}/chat/completions"

    candidate_models = [settings.FIREWORKS_MODEL, settings.FIREWORKS_FALLBACK_MODEL]
    reply_text = None
    model_used = None

    async with httpx.AsyncClient(timeout=30.0) as client:
        for model in candidate_models:
            try:
                payload = {
                    "model": model,
                    "messages": messages,
                    "max_tokens": 850,
                    "temperature": 0.4,
                    "top_p": 0.9,
                }
                resp = await client.post(url, headers=headers, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    choices = data.get("choices", [])
                    if choices:
                        msg_obj = choices[0].get("message", {})
                        content = msg_obj.get("content")
                        if not content and msg_obj.get("reasoning_content"):
                            # If content is empty but reasoning is present
                            content = msg_obj.get("reasoning_content")
                        if content and content.strip():
                            reply_text = content.strip()
                            model_used = model
                            break
                else:
                    logger.warning(
                        f"Fireworks model {model} returned status {resp.status_code}: {resp.text[:200]}"
                    )
            except Exception as e:
                logger.warning(f"Error querying Fireworks AI model {model}: {e}")

    # 5. Offline Fallback if Fireworks API was unreachable or failed
    if not reply_text:
        logger.info("Using local RAG offline synthesis as fallback.")
        model_used = "chickcheck-rag-offline"
        is_bengali = preferred_language == "bn" or any(
            "\u0980" <= c <= "\u09FF" for c in user_message
        )

        top_ref = knowledge_articles[0] if knowledge_articles else None
        ref_title = (top_ref["title_bn"] if is_bengali else top_ref["title_en"]) if top_ref else ""
        ref_content = (top_ref["content_bn"] if is_bengali else top_ref["content_en"]) if top_ref else ""

        if is_bengali:
            reply_text = (
                f"**সহায়ক এআই (Sohayok AI) লাইভ রিপোর্ট:**\n\n"
                f"📊 **বর্তমান শেড অবস্থা:**\n"
                f"- সনাক্তকৃত পাখি: {telemetry['bird_count']} টি (সক্রিয়: {telemetry['active_count']}, স্থির: {telemetry['idle_count']})\n"
                f"- সামগ্রিক স্বাস্থ্য স্কোর: {telemetry['flock_health_score']}/১০০ ({telemetry['flock_status'].upper()})\n"
                f"- অ্যাক্টিভিটি সূচক: {telemetry['activity_index']}/১০০\n\n"
                f"📖 **প্রাসঙ্গিক তথ্যভাণ্ডার ({ref_title}):**\n{ref_content}\n\n"
                f"⚠️ *চিকচেক একটি প্রাথমিক স্ক্রীনিং টুল। গুরুতর সমস্যায় ভেটেরিনারি চিকিৎসকের পরামর্শ নিন।*"
            )
        else:
            reply_text = (
                f"**Sohayok AI Live Report:**\n\n"
                f"📊 **Current Shed Condition:**\n"
                f"- Detected Birds: {telemetry['bird_count']} (Active: {telemetry['active_count']}, Idle: {telemetry['idle_count']})\n"
                f"- Flock Health Index: {telemetry['flock_health_score']}/100 ({telemetry['flock_status'].upper()})\n"
                f"- Activity Index: {telemetry['activity_index']}/100\n\n"
                f"📖 **Knowledge Reference ({ref_title}):**\n{ref_content}\n\n"
                f"⚠️ *ChickCheck is an automated screening aid. For clinical treatment, please consult a registered veterinarian.*"
            )

    return {
        "reply": reply_text,
        "sources": sources,
        "telemetry": telemetry,
        "model": model_used,
    }
