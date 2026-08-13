"""
Shared RSS/Atom fetch + parse.

Both live sources are RSS underneath — the news-search source (Google News
query → RSS) and the maritime-publication source (gCaptain, Splash247, …) —
so parsing lives here once.

Ported from stock_visualizer's rss_manager.py::_fetch_feed, with two fixes:
  - `_seen_urls` there grew without bound and was mutated outside the lock.
    Dedup is not this layer's job at all now; the store owns it, durably.
  - A feed that fails to parse is reported as an error, not as an empty world.
"""

from __future__ import annotations

import html
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

import feedparser
import httpx

logger = logging.getLogger(__name__)

USER_AGENT = "OceanMind/0.1 (maritime signal ingestion; +https://github.com/yantongggg/OceanMind)"
TIMEOUT_S = 20.0
MAX_AGE_DAYS = 7

_TAG_RE = re.compile(r"<[^>]+>")


def strip_html(text: str) -> str:
    """RSS summaries are HTML fragments; signals want plain prose."""
    if not text:
        return ""
    return html.unescape(_TAG_RE.sub("", text)).strip()


def _entry_published(entry) -> Optional[datetime]:
    for attr in ("published_parsed", "updated_parsed"):
        parsed = getattr(entry, attr, None)
        if parsed:
            try:
                return datetime(*parsed[:6], tzinfo=timezone.utc)
            except Exception:
                continue
    return None


class FeedError(Exception):
    """Raised when a feed could not be fetched or parsed.

    Deliberately distinct from "feed returned zero entries" — the caller must
    be able to tell a broken source from a quiet one.
    """


def fetch_feed(url: str, source_name: str, max_age_days: int = MAX_AGE_DAYS) -> list[dict]:
    """Fetch one feed → list of raw article dicts.

    Raises FeedError if the feed is unreachable or unparseable. Returns [] only
    when the feed genuinely has no recent entries.
    """
    try:
        resp = httpx.get(
            url,
            headers={"User-Agent": USER_AGENT},
            timeout=TIMEOUT_S,
            follow_redirects=True,
        )
        resp.raise_for_status()
    except Exception as e:
        raise FeedError(f"{source_name}: fetch failed — {type(e).__name__}: {e}") from e

    parsed = feedparser.parse(resp.content)
    if parsed.bozo and not parsed.entries:
        raise FeedError(f"{source_name}: unparseable — {parsed.get('bozo_exception')}")

    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
    articles: list[dict] = []

    for entry in parsed.entries:
        link = (entry.get("link") or "").strip()
        title = strip_html(entry.get("title") or "")
        if not link or not title:
            continue  # no provenance or no headline → not a signal

        published = _entry_published(entry)
        if published and published < cutoff:
            continue

        summary = strip_html(entry.get("summary") or entry.get("description") or "")

        # Google News wraps the real publisher in the title as "Headline - Publisher"
        # and exposes it properly in entry.source; prefer the real byline.
        byline = source_name
        src = entry.get("source")
        if isinstance(src, dict) and src.get("title"):
            byline = src["title"]

        articles.append(
            {
                "title": title,
                "summary": summary,
                "url": link,
                "source": byline,
                "published_at": (published or datetime.now(timezone.utc)).isoformat(),
                "feed_name": source_name,
            }
        )

    return articles
