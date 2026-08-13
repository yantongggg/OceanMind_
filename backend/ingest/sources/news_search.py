"""
News-search source — one keyword query per chokepoint, via Google News RSS.

This is the GDELT replacement. GDELT 2.0 was the original plan (and
sources/gdelt.py is a working client for it), but it rate-limits by IP and
returns 429 from many networks regardless of request pacing. Google News RSS
takes the same shape of input — a boolean keyword query — needs no key, and
returns the real publisher byline and article URL, which is what provenance
requires.

Coverage note worth knowing: the trade press that maritime operators actually
read — Lloyd's List, TradeWinds — is paywalled and publishes no open RSS
(403/404 respectively). Their headlines surface here only when Google News
indexes them. So live coverage skews toward open sources (Reuters, Bloomberg,
gCaptain, Maritime Executive) rather than the subscription trade press.
"""

from __future__ import annotations

import logging
import time
from typing import Optional
from urllib.parse import urlencode

from ingest.geography import CHOKEPOINTS, news_query
from ingest.sources.feeds import FeedError, fetch_feed

logger = logging.getLogger(__name__)

GOOGLE_NEWS_RSS = "https://news.google.com/rss/search"
MIN_REQUEST_INTERVAL = 1.5  # polite pacing between chokepoint queries
CACHE_TTL = 300.0


class NewsSearchSource:
    """Per-chokepoint news search. No credentials required."""

    name = "news_search"

    def __init__(self) -> None:
        self._cache: dict[str, tuple[float, list[dict]]] = {}
        self._last_request = 0.0
        self._last_error: Optional[str] = None
        self._errors: dict[str, str] = {}

    @property
    def available(self) -> bool:
        """No key needed, so always worth attempting.

        Reachability is judged per-request. A failed query yields [] and sets
        an error — it never means "no maritime news exists".
        """
        return True

    def _throttle(self) -> None:
        elapsed = time.time() - self._last_request
        if elapsed < MIN_REQUEST_INTERVAL:
            time.sleep(MIN_REQUEST_INTERVAL - elapsed)
        self._last_request = time.time()

    def fetch_chokepoint(self, chokepoint: str) -> list[dict]:
        cached = self._cache.get(chokepoint)
        if cached and time.time() - cached[0] < CACHE_TTL:
            return cached[1]

        params = {
            "q": news_query(chokepoint),
            "hl": "en-US",
            "gl": "US",
            "ceid": "US:en",
        }
        url = f"{GOOGLE_NEWS_RSS}?{urlencode(params)}"

        self._throttle()
        try:
            articles = fetch_feed(url, source_name="Google News")
        except FeedError as e:
            self._errors[chokepoint] = str(e)
            self._last_error = str(e)
            logger.warning("news_search failed for %s: %s", chokepoint, e)
            return []

        for art in articles:
            art["chokepoint_hint"] = chokepoint
            art["fetched_from"] = self.name

        self._errors.pop(chokepoint, None)
        self._cache[chokepoint] = (time.time(), articles)
        logger.info("news_search %s → %d articles", chokepoint, len(articles))
        return articles

    def fetch(self) -> list[dict]:
        """Sweep every tracked chokepoint, deduplicated by URL."""
        collected: list[dict] = []
        for chokepoint in CHOKEPOINTS:
            try:
                collected.extend(self.fetch_chokepoint(chokepoint))
            except Exception:
                logger.debug("news_search sweep failed at %s", chokepoint, exc_info=True)

        seen: set[str] = set()
        unique: list[dict] = []
        for art in collected:
            if art["url"] not in seen:
                seen.add(art["url"])
                unique.append(art)

        if self._errors:
            self._last_error = f"{len(self._errors)} chokepoint queries failing"
        else:
            self._last_error = None

        logger.info("news_search sweep: %d unique articles", len(unique))
        return unique

    def status(self) -> dict:
        return {
            "name": self.name,
            "available": self.available,
            "requires_key": False,
            "chokepoints": len(CHOKEPOINTS),
            "cached_queries": len(self._cache),
            "failing_chokepoints": sorted(self._errors),
            "last_error": self._last_error,
        }
