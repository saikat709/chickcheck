"""API router for Sohayok AI (সহায়ক এআই) RAG Chatbot with rate limiting."""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Request, HTTPException, status, Response
from pydantic import BaseModel, Field

from backend.app.config import settings
from backend.app.services.rate_limiter import chat_rate_limiter
from backend.app.services.sohayok import query_sohayok_ai, get_current_flock_context

router = APIRouter()


class ChatMessage(BaseModel):
    role: str = Field(..., description="Role of the sender ('user' or 'assistant')")
    content: str = Field(..., max_length=2000, description="Message text")


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, description="User question or prompt")
    history: Optional[List[ChatMessage]] = Field(default=None, description="Recent conversation turns")
    language: Optional[str] = Field(default="en", description="Preferred language ('en' or 'bn')")


class ChatResponse(BaseModel):
    reply: str
    sources: List[Dict[str, Any]]
    telemetry: Dict[str, Any]
    model: str
    rate_limit_remaining: int


def get_client_ip(request: Request) -> str:
    """Extract real client IP considering reverse proxies (Railway, Cloudflare, Nginx)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # First IP in the comma-separated list is the client
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "127.0.0.1"


@router.post("", response_model=ChatResponse)
async def chat_with_sohayok(req: ChatRequest, request: Request, response: Response):
    """Interact with Sohayok AI with live RAG and IP rate limiting."""
    client_ip = get_client_ip(request)

    # 1. Check rate limits
    allowed, remaining, retry_after = chat_rate_limiter.check(client_ip)
    response.headers["X-RateLimit-Limit"] = str(settings.CHAT_RATE_LIMIT_PER_MINUTE)
    response.headers["X-RateLimit-Remaining"] = str(remaining)

    if not allowed:
        response.headers["Retry-After"] = str(retry_after)
        is_bn = req.language == "bn"
        error_msg = (
            f"অনুরোধের সীমা অতিক্রম করেছে। দয়া করে {retry_after} সেকেন্ড অপেক্ষা করুন।"
            if is_bn
            else f"Rate limit reached for Sohayok AI. Please wait {retry_after} seconds."
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_msg,
            headers={"Retry-After": str(retry_after)},
        )

    # 2. Convert history schema to dicts
    history_dicts = None
    if req.history:
        history_dicts = [{"role": m.role, "content": m.content} for m in req.history]

    # 3. Query Sohayok AI RAG engine
    result = await query_sohayok_ai(
        user_message=req.message,
        chat_history=history_dicts,
        preferred_language=req.language or "en",
    )

    return ChatResponse(
        reply=result["reply"],
        sources=result["sources"],
        telemetry=result["telemetry"],
        model=result["model"],
        rate_limit_remaining=remaining,
    )


@router.get("/status")
def get_chat_status(request: Request):
    """Get Sohayok AI service health and client rate limit quota."""
    client_ip = get_client_ip(request)
    usage = chat_rate_limiter.get_status(client_ip)
    telemetry = get_current_flock_context()

    return {
        "service": "Sohayok AI",
        "name_bn": "সহায়ক এআই",
        "provider": "Fireworks AI",
        "primary_model": settings.FIREWORKS_MODEL,
        "fallback_model": settings.FIREWORKS_FALLBACK_MODEL,
        "rate_limits": usage,
        "live_telemetry_connected": telemetry["pipeline_running"],
        "flock_health_score": telemetry["flock_health_score"],
        "species": telemetry["species"],
    }


@router.get("/suggestions")
def get_chat_suggestions(lang: Optional[str] = "en"):
    """Get recommended prompt suggestions for quick interaction."""
    if lang == "bn":
        return {
            "suggestions": [
                {"label": "📊 বর্তমান ফ্লকের অবস্থা", "prompt": "বর্তমান ফ্লকের অবস্থা ও স্বাস্থ্য কেমন?"},
                {"label": "🔍 কোনো পাখি কি নিস্তেজ বা অসুস্থ?", "prompt": "কোনো পাখি কি স্থির বা নিষ্ক্রিয় অবস্থায় আছে?"},
                {"label": "☀️ গরম ও হিট স্ট্রোক প্রতিকার", "prompt": "তীব্র গরমে ব্রয়লার মুরগির হিট স্ট্রোক রোধে কী করব?"},
                {"label": "💉 ব্রয়লার ভ্যাকসিন শিডিউল", "prompt": "ব্রয়লার মুরগির পূর্ণাঙ্গ টিকা দেওয়ার সময়সূচী কী?"},
                {"label": "🌡️ সঠিক ব্রুডিং তাপমাত্রা", "prompt": "১ম সপ্তাহে বাচ্চার ব্রুডিং তাপমাত্রা কত রাখা উচিত?"},
            ]
        }

    return {
        "suggestions": [
            {"label": "📊 Current Flock Status", "prompt": "How is my flock doing right now?"},
            {"label": "🔍 Check for Immobile Birds", "prompt": "Are there any sick, immobile or alerted birds?"},
            {"label": "☀️ Heat Stress Prevention", "prompt": "How can I prevent heat stress in hot weather?"},
            {"label": "💉 Vaccination Schedule", "prompt": "What is the standard broiler vaccination timeline?"},
            {"label": "🌡️ Brooding Temperature", "prompt": "What is the recommended brooding temperature for week 1?"},
        ]
    }
