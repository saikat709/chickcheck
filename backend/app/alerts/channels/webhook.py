import json
import hmac
import hashlib
import logging
import httpx
from typing import Optional, Dict, Any

logger = logging.getLogger("chickcheck.alerts.webhook")


class WebhookChannel:
    """Delivers JSON alert payloads with HMAC-SHA256 signatures to user endpoints."""

    @classmethod
    async def send_alert(
        cls,
        url: str,
        secret: Optional[str],
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        if not url:
            return {"success": False, "error": "Webhook URL is not configured."}

        payload_bytes = json.dumps(payload, default=str).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "ChickCheck-AlertEngine/1.0",
        }

        if secret:
            sig = hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()
            headers["X-ChickCheck-Signature"] = f"sha256={sig}"

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(url, content=payload_bytes, headers=headers)
                if 200 <= resp.status_code < 300:
                    logger.info(f"Webhook alert dispatched to {url} (HTTP {resp.status_code})")
                    return {"success": True, "status_code": resp.status_code}
                else:
                    logger.warning(f"Webhook returned HTTP {resp.status_code}: {resp.text[:200]}")
                    return {"success": False, "status_code": resp.status_code, "error": resp.text[:200]}
        except Exception as e:
            logger.error(f"Webhook dispatch failed: {e}")
            return {"success": False, "error": str(e)}

