"""Thread-safe sliding-window rate limiter for client requests."""

import time
import threading
from typing import Dict, List, Tuple
from backend.app.config import settings


class SlidingWindowRateLimiter:
    """Sliding-window in-memory rate limiter per client IP.
    
    Tracks requests on both per-minute and per-hour windows to prevent abuse
    while allowing legitimate interactive poultry farm monitoring queries.
    """

    def __init__(
        self,
        max_per_minute: int = 15,
        max_per_hour: int = 120,
    ):
        self.max_per_minute = max_per_minute
        self.max_per_hour = max_per_hour
        self._lock = threading.Lock()
        self._requests: Dict[str, List[float]] = {}
        self._last_cleanup = time.time()

    def check(self, client_ip: str) -> Tuple[bool, int, int]:
        """Check if request from client_ip is allowed under rate limits.
        
        Returns:
            Tuple of:
            - allowed: bool (True if allowed, False if rate limited)
            - remaining_minute: int (remaining requests allowed in current minute)
            - retry_after: int (seconds to wait if blocked, 0 if allowed)
        """
        now = time.time()
        one_min_ago = now - 60.0
        one_hour_ago = now - 3600.0

        with self._lock:
            # Periodic cleanup of stale IPs (every 5 minutes)
            if now - self._last_cleanup > 300:
                self._cleanup_stale(one_hour_ago)
                self._last_cleanup = now

            timestamps = self._requests.setdefault(client_ip, [])

            # Prune entries older than 1 hour
            timestamps[:] = [t for t in timestamps if t > one_hour_ago]

            # Count in last minute
            recent_minute = [t for t in timestamps if t > one_min_ago]

            # Check minute limit
            if len(recent_minute) >= self.max_per_minute:
                # Time until oldest in recent_minute expires
                retry_after = max(1, int(60.0 - (now - recent_minute[0])))
                return False, 0, retry_after

            # Check hourly limit
            if len(timestamps) >= self.max_per_hour:
                retry_after = max(1, int(3600.0 - (now - timestamps[0])))
                return False, 0, retry_after

            # Request is permitted, record timestamp
            timestamps.append(now)
            remaining_minute = max(0, self.max_per_minute - len(recent_minute) - 1)
            return True, remaining_minute, 0

    def get_status(self, client_ip: str) -> Dict[str, int]:
        """Get current usage stats for a client without incrementing."""
        now = time.time()
        one_min_ago = now - 60.0
        one_hour_ago = now - 3600.0

        with self._lock:
            timestamps = self._requests.get(client_ip, [])
            recent_minute = sum(1 for t in timestamps if t > one_min_ago)
            recent_hour = sum(1 for t in timestamps if t > one_hour_ago)

            return {
                "limit_per_minute": self.max_per_minute,
                "remaining_minute": max(0, self.max_per_minute - recent_minute),
                "limit_per_hour": self.max_per_hour,
                "remaining_hour": max(0, self.max_per_hour - recent_hour),
            }

    def _cleanup_stale(self, cutoff: float) -> None:
        """Remove IPs with no activity in the last hour."""
        to_delete = []
        for ip, times in self._requests.items():
            valid = [t for t in times if t > cutoff]
            if not valid:
                to_delete.append(ip)
            else:
                self._requests[ip] = valid
        for ip in to_delete:
            del self._requests[ip]


# Singleton instance with configurable limits
chat_rate_limiter = SlidingWindowRateLimiter(
    max_per_minute=settings.CHAT_RATE_LIMIT_PER_MINUTE,
    max_per_hour=settings.CHAT_RATE_LIMIT_PER_HOUR,
)
