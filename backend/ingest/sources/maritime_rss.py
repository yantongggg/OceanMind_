"""
Maritime trade-press RSS source.

Ported from stock_visualizer's rss_manager.py. What survived: the category →
interval threading idea and the per-feed try/except isolation. What changed:
the feed list is maritime instead of gold/finance, and dedup moved out (the
store owns it durably, rather than an unbounded in-process set mutated outside
its lock — a real bug in the original).

Every feed below was probed live before being listed here. Feeds that look
obvious but do NOT work, so nobody re-adds them:
  - Lloyd's List   → HTTP 403, subscription-only, no open RSS
  - TradeWinds     → HTTP 404, no public feed
  - ShippingWatch  → serves HTML, not RSS
Those three are exactly the bylines the golden demo dataset invents, which is
worth knowing: their real coverage cannot be ingested without a subscription.
"""

from __future__ import annotations

import logging
from typing import Optional

from ingest.sources.feeds import FeedError, fetch_feed

logger = logging.getLogger(__name__)

# name → url. All verified reachable and returning parseable items.
FEEDS: dict[str, str] = {
    "gCaptain": "https://gcaptain.com/feed/",
    "Splash 247": "https://splash247.com/feed/",
    "The Maritime Executive": "https://maritime-executive.com/articles.rss",
    "Seatrade Maritime": "https://www.seatrade-maritime.com/rss.xml",
    "Marine Insight": "https://www.marineinsight.com/feed/",
    "Offshore Energy": "https://www.offshore-energy.biz/feed/",
}


class MaritimeRssSource:
    """Polls the open maritime trade press. No credentials required."""

    name = "maritime_rss"

    def __init__(self, feeds: Optional[dict[str, str]] = None) -> None:
        self._feeds = feeds or FEEDS
        self._errors: dict[str, str] = {}
        self._last_error: Optional[str] = None

    @property
    def available(self) -> bool:
        return True

    def fetch(self) -> list[dict]:
        """Poll every feed. One broken feed never sinks the sweep."""
        collected: list[dict] = []
        for name, url in self._feeds.items():
            try:
                articles = fetch_feed(url, source_name=name)
            except FeedError as e:
                self._errors[name] = str(e)
                logger.warning("maritime_rss: %s", e)
                continue
            except Exception as e:
                self._errors[name] = f"{type(e).__name__}: {e}"
                logger.debug("maritime_rss unexpected failure at %s", name, exc_info=True)
                continue

            for art in articles:
                art["fetched_from"] = self.name
            collected.extend(articles)
            self._errors.pop(name, None)

        seen: set[str] = set()
        unique: list[dict] = []
        for art in collected:
            if art["url"] not in seen:
                seen.add(art["url"])
                unique.append(art)

        self._last_error = (
            f"{len(self._errors)}/{len(self._feeds)} feeds failing" if self._errors else None
        )
        logger.info(
            "maritime_rss sweep: %d unique from %d/%d feeds",
            len(unique),
            len(self._feeds) - len(self._errors),
            len(self._feeds),
        )
        return unique

    def status(self) -> dict:
        return {
            "name": self.name,
            "available": self.available,
            "requires_key": False,
            "feeds": len(self._feeds),
            "failing_feeds": sorted(self._errors),
            "last_error": self._last_error,
        }
