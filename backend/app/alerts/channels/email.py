import asyncio
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from typing import Optional, Dict, Any

logger = logging.getLogger("chickcheck.alerts.email")


class EmailChannel:
    """Delivers alert emails with snapshot attachment via standard SMTP."""

    @classmethod
    async def send_alert(
        cls,
        host: Optional[str],
        port: int,
        user: Optional[str],
        password: Optional[str],
        from_addr: Optional[str],
        to_addr: Optional[str],
        use_tls: bool,
        subject: str,
        body_text: str,
        snapshot_bytes: Optional[bytes] = None,
    ) -> Dict[str, Any]:
        if not host or not to_addr or not from_addr:
            return {"success": False, "error": "SMTP host, from_addr, or to_addr not configured."}

        def _send() -> Dict[str, Any]:
            try:
                msg = MIMEMultipart("related")
                msg["Subject"] = subject
                msg["From"] = from_addr
                msg["To"] = to_addr

                html_content = f"""
                <html>
                  <body style="font-family: Arial, sans-serif; color: #18181b; line-height: 1.5;">
                    <div style="background-color: #f4f4f5; padding: 20px; border-radius: 8px;">
                      <h2 style="color: #ef4444; margin-top: 0;">ChickCheck Livestock Alert</h2>
                      <p>{body_text.replace(chr(10), '<br>')}</p>
                      <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 20px 0;">
                      <p style="font-size: 12px; color: #71717a;">
                        Disclaimer: Movement-based screening signal only. Not a veterinary diagnosis.
                      </p>
                    </div>
                  </body>
                </html>
                """
                msg.attach(MIMEText(html_content, "html"))

                if snapshot_bytes:
                    img_part = MIMEImage(snapshot_bytes, name="snapshot.jpg")
                    img_part.add_header("Content-Disposition", "attachment", filename="snapshot.jpg")
                    msg.attach(img_part)

                server = smtplib.SMTP(host, port, timeout=10)
                if use_tls:
                    server.starttls()
                if user and password:
                    server.login(user, password)
                server.send_message(msg)
                server.quit()

                logger.info(f"Email successfully delivered to {to_addr}")
                return {"success": True}
            except Exception as e:
                logger.error(f"Failed to send email alert: {e}")
                return {"success": False, "error": str(e)}

        return await asyncio.to_thread(_send)

