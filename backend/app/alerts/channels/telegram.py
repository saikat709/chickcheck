import logging
import httpx
from typing import Optional, Dict, Any

logger = logging.getLogger("chickcheck.alerts.telegram")


class TelegramChannel:
    """Delivers alert messages and snapshot photos to a Telegram chat."""

    @classmethod
    async def send_alert(
        cls,
        bot_token: str,
        chat_id: str,
        title: str,
        description: str,
        severity: str,
        snapshot_bytes: Optional[bytes] = None,
    ) -> Dict[str, Any]:
        if not bot_token or not chat_id:
            return {"success": False, "error": "Telegram bot token or chat ID is missing."}

        icon = "🚨" if severity == "critical" else ("⚠️" if severity == "warning" else "ℹ️")
        caption = (
            f"{icon} *CHICKCHECK ALERT*\n"
            f"*Severity:* `{severity.upper()}`\n"
            f"*Issue:* {title}\n\n"
            f"{description}\n\n"
            f"_Screening signal only. Verify animal condition in person._"
        )

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                if snapshot_bytes:
                    url = f"https://api.telegram.org/bot{bot_token}/sendPhoto"
                    files = {"photo": ("snapshot.jpg", snapshot_bytes, "image/jpeg")}
                    data = {"chat_id": chat_id, "caption": caption, "parse_mode": "Markdown"}
                    resp = await client.post(url, data=data, files=files)
                else:
                    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                    data = {"chat_id": chat_id, "text": caption, "parse_mode": "Markdown"}
                    resp = await client.post(url, json=data)

                resp_data = resp.json()
                if resp.status_code == 200 and resp_data.get("ok"):
                    logger.info("Telegram notification sent successfully.")
                    return {"success": True, "message_id": resp_data.get("result", {}).get("message_id")}
                else:
                    err_msg = resp_data.get("description", resp.text)
                    logger.warning(f"Telegram API error: {err_msg}")
                    return {"success": False, "error": err_msg}
        except Exception as e:
            logger.error(f"Telegram dispatch failed: {e}")
            return {"success": False, "error": str(e)}

