"""
GDELT 2.0 DOC API adapter.

Public API, no key, no account. Self-imposed 5s throttle and a 300s TTL cache
keep us well inside what GDELT tolerates.

Ported from stock_visualizer's app/news_intelligence/sources/gdelt_adapter.py.
Changed: queries are built per maritime chokepoint (see ingest/geography.py)
rather than per gold-market category; `available` is exposed so the engine can
skip this source instead of inferring from silence.
"""

from __future__ import annotations

import hashlib
import logging
import threading
import time
from datetime import datetime
from typing import Any, Optional

import httpx

from ingest.geography import CHOKEPOINTS, gdelt_query

logger = logging.getLogger(__name__)

GDELT_BASE = "https://api.gdeltproject.org/api/v2/doc/doc"

MIN_REQUEST_INTERVAL = 5.0  # seconds between requests — GDELT is generous but not free
CACHE_TTL = 300.0           # 5 min; GDELT itself only updates every 15 min
TIMEOUT_S = 15.0


def _parse_gdelt_date(date_str: str) -> Optional[datetime]:
    """GDELT stamps are YYYYMMDDHHMMSS, sometimes truncated to YYYYMMDD."""
    if not date_str:
        return None
    for fmt, width in (("%Y%m%d%H%M%S", 14), ("%Y%m%d", 8)):
        try:
            return datetime.strptime(date_str[:width], fmt)
        except (ValueError, TypeError):
            continue
    return None


class GdeltSource:
    """Fetches maritime articles from GDELT, one query per chokepoint."""

    name = "gdelt"

    def __init__(self, max_records: int = 30, timeout: float = TIMEOUT_S) -> None:
        self._max_records = max_records
        self._timeout = timeout
        self._lock = threading.Lock()
        self._last_request = 0.0
        self._cache: dict[str, tuple[float, list[dict]]] = {}
        self._last_error: Optional[str] = None

    @property
    def available(self) -> bool:
        """GDELT needs no credentials, so it is always worth attempting.

        Reachability is decided per-request; a failed fetch returns [] and is
        reported as an error, never as an absence of maritime activity.
        """
        return True

    def _throttle(self) -> None:
        elapsed = time.time() - self._last_request
        if elapsed < MIN_REQUEST_INTERVAL:
            time.sleep(MIN_REQUEST_INTERVAL - elapsed)
        self._last_request = time.time()

    @staticmethod
    def _cache_key(chokepoint: str, timespan: str) -> str:
        return hashlib.md5(f"{chokepoint}:{timespan}".encode()).hexdigest()

    def fetch_chokepoint(self, chokepoint: str, timespan: str = "24h") -> list[dict]:
        """Articles mentioning one chokepoint in a maritime context."""
        ck = self._cache_key(chokepoint, timespan)
        cached = self._cache.get(ck)
        if cached and time.time() - cached[0] < CACHE_TTL:
            return cached[1]

        params = {
            "query": gdelt_query(chokepoint),
            "mode": "artlist",
            "maxrecords": str(self._max_records),
            "timespan": timespan,
            "format": "json",
            "sort": "datedesc",
        }

        with self._lock:
            self._throttle()
            try:
                resp = httpx.get(GDELT_BASE, params=params, timeout=self._timeout)
                resp.raise_for_status()
                data: dict[str, Any] = resp.json()
            except Exception as e:
                # Distinguish "we failed to ask" from "there is no news".
                # Both yield [], but only the former sets _last_error, and the
                # engine surfaces that rather than treating it as quiet seas.
                self._last_error = f"{type(e).__name__}: {e}"
                logger.warning("GDELT fetch failed for %s: %s", chokepoint, e)
                return []

        articles: list[dict] = []
        for raw in data.get("articles", []):
            url = (raw.get("url") or "").strip()
            title = (raw.get("title") or "").strip()
            if not url or not title:
                continue  # no provenance → not a signal
            pub = _parse_gdelt_date(raw.get("seendate", ""))
            articles.append(
                {
                    "title": title,
                    "summary": "",  # GDELT artlist gives no body; RSS fills this in
                    "url": url,
                    "source": raw.get("domain") or raw.get("source") or "unknown",
                    "source_country": raw.get("sourcecountry", ""),
                    "language": raw.get("language", "English"),
                    "published_at": pub.isoformat() if pub else "",
                    "image_url": raw.get("socialimage", ""),
                    "chokepoint_hint": chokepoint,
                    "fetched_from": self.name,
                }
            )

        self._last_error = None
        self._cache[ck] = (time.time(), articles)
        logger.info("GDELT %s/%s → %d articles", chokepoint, timespan, len(articles))
        return articles

    def fetch(self, timespan: str = "24h") -> list[dict]:
        """Sweep every tracked chokepoint. Deduplicated by URL."""
        collected: list[dict] = []
        for chokepoint in CHOKEPOINTS:
            try:
                collected.extend(self.fetch_chokepoint(chokepoint, timespan=timespan))
            except Exception:
                logger.debug("GDELT sweep failed at %s", chokepoint, exc_info=True)

        seen: set[str] = set()
        unique: list[dict] = []
        for art in collected:
            url = art["url"]
            if url not in seen:
                seen.add(url)
                unique.append(art)

        logger.info("GDELT sweep: %d unique across %d chokepoints", len(unique), len(CHOKEPOINTS))
        return unique

    def status(self) -> dict:
        return {
            "name": self.name,
            "available": self.available,
            "requires_key": False,
            "chokepoints": len(CHOKEPOINTS),
            "cached_queries": len(self._cache),
            "last_error": self._last_error,
        }

    def clear_cache(self) -> None:
        self._cache.clear()
