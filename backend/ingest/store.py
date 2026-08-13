"""
Signal persistence — Supabase, with an in-memory fallback.

Two jobs:
  1. Durable dedup. GDELT/RSS re-serve the same article for days; without a
     persistent key the same story re-enters the feed on every poll and every
     restart. The donor implementation kept an in-process `_seen_urls` set that
     grew without bound and reset on boot — hence its news.db quietly filling
     with duplicates.
  2. Give the frontend something to subscribe to.

The store NEVER hard-fails the demo. If Supabase is unconfigured or
unreachable, it degrades to an in-memory dict, logs once, and ingestion carries
on. `backed_by` reports which mode is live so the UI can be honest about it.
"""

from __future__ import annotations

import hashlib
import logging
import os
from datetime import datetime, timezone
from typing import Optional

from models import Signal

logger = logging.getLogger(__name__)

TABLE = "signals"


def content_hash(title: str, url: str) -> str:
    """Durable dedup key. Same article → same hash, across restarts."""
    return hashlib.sha256(f"{title.strip().lower()}|{url.strip()}".encode()).hexdigest()


def _to_row(signal: Signal) -> dict:
    return {
        "id": signal.id,
        "title": signal.title,
        "summary": signal.summary,
        "plain_english": signal.plain_english,
        "not_implied": signal.not_implied,
        "category": signal.category,
        "severity": signal.severity,
        "lat": signal.lat,
        "lon": signal.lon,
        "source": signal.source,
        "published_at": signal.published_at,
        "corroboration": signal.corroboration,
        "affected_voyage_ids": signal.affected_voyage_ids,
        "affected_chokepoint": signal.affected_chokepoint,
        "url": signal.url,
        "origin": signal.origin,
        "content_hash": content_hash(signal.title, signal.url or signal.id),
        "last_seen_at": datetime.now(timezone.utc).isoformat(),
    }


def _from_row(row: dict) -> Signal:
    return Signal(
        id=row["id"],
        title=row["title"],
        summary=row.get("summary") or "",
        plain_english=row.get("plain_english") or "",
        not_implied=row.get("not_implied") or "",
        category=row["category"],
        severity=row["severity"],
        lat=row["lat"],
        lon=row["lon"],
        source=row["source"],
        published_at=row["published_at"],
        corroboration=row.get("corroboration") or 1,
        affected_voyage_ids=row.get("affected_voyage_ids") or [],
        affected_chokepoint=row.get("affected_chokepoint"),
        url=row.get("url"),
        origin=row.get("origin") or "live",
    )


class SignalStore:
    """Upsert-and-read for live signals. Supabase when configured, else memory."""

    def __init__(self) -> None:
        self._memory: dict[str, Signal] = {}
        self._client = None
        # Read and write health are tracked separately on purpose. They shared
        # one field, and a successful count() cleared the flag a failing
        # upsert had just set — so the store reported healthy=true, error=none
        # while every write was silently landing in memory instead of Postgres.
        self._error: Optional[str] = None
        self._write_error: Optional[str] = None
        self._connect()

    # ── wiring ───────────────────────────────────────────────────────────

    def _connect(self) -> None:
        url = (os.environ.get("SUPABASE_URL") or "").strip()
        key = (os.environ.get("SUPABASE_SECRET_KEY") or "").strip()

        if not url or not key or "REPLACE-ME" in url:
            self._error = "SUPABASE_URL / SUPABASE_SECRET_KEY not configured"
            logger.info("SignalStore: %s — using in-memory store", self._error)
            return

        try:
            from supabase import create_client

            self._client = create_client(url, key)
            logger.info("SignalStore: connected to Supabase")
        except Exception as e:
            self._error = f"{type(e).__name__}: {e}"
            self._client = None
            logger.warning("SignalStore: Supabase unavailable (%s) — using memory", self._error)

    @property
    def backed_by(self) -> str:
        return "supabase" if self._client else "memory"

    # ── writes ───────────────────────────────────────────────────────────

    def upsert(self, signals: list[Signal]) -> int:
        """Insert or update signals. Returns how many were persisted.

        Idempotent on content_hash: re-ingesting the same article refreshes
        last_seen_at instead of creating a duplicate row.
        """
        if not signals:
            return 0

        rows = [_to_row(s) for s in signals]

        if self._client:
            try:
                # Conflict on `id`, the primary key. Targeting content_hash
                # instead raised "duplicate key violates signals_pkey" on every
                # re-ingest: Postgres hits the PK collision before the ON
                # CONFLICT (content_hash) clause can resolve anything. Both
                # keys derive from the article, and the URL is its identity, so
                # id (= sha256(url)[:8]) is the right target.
                self._client.table(TABLE).upsert(rows, on_conflict="id").execute()
                self._write_error = None
                return len(rows)
            except Exception as e:
                # Fall through to memory rather than losing the sweep.
                self._write_error = f"upsert failed: {type(e).__name__}: {e}"
                logger.warning("SignalStore: %s — falling back to memory", self._write_error)

        for signal in signals:
            self._memory[signal.id] = signal
        return len(signals)

    # ── reads ────────────────────────────────────────────────────────────

    def recent(self, limit: int = 200) -> list[Signal]:
        """Most recently published signals, newest first."""
        if self._client:
            try:
                resp = (
                    self._client.table(TABLE)
                    .select("*")
                    .order("published_at", desc=True)
                    .limit(limit)
                    .execute()
                )
                return [_from_row(r) for r in (resp.data or [])]
            except Exception as e:
                self._error = f"read failed: {type(e).__name__}: {e}"
                logger.warning("SignalStore: %s — reading from memory", self._error)

        return sorted(
            self._memory.values(), key=lambda s: s.published_at, reverse=True
        )[:limit]

    def count(self) -> int:
        if self._client:
            try:
                resp = (
                    self._client.table(TABLE)
                    .select("id", count="exact")
                    .limit(1)
                    .execute()
                )
                self._error = None
                return resp.count or 0
            except Exception as e:
                # Record it. Swallowing this silently reported a healthy store
                # with 0 signals while the table did not exist — indistinguishable
                # from "connected and quiet", which is the exact failure this
                # codebase keeps guarding against.
                self._error = f"count failed: {type(e).__name__}: {e}"
                logger.warning("SignalStore: %s", self._error)
        return len(self._memory)

    def healthy(self) -> bool:
        """True when the configured backend is actually usable right now."""
        if not self._client:
            return False
        self.count()
        return self._error is None

    def status(self) -> dict:
        count = self.count()
        healthy = (
            self._client is not None
            and self._error is None
            and self._write_error is None
        )
        return {
            "backedBy": self.backed_by,
            "signalCount": count,
            "healthy": healthy,
            "lastError": self._error,
            # Surfaced separately: writes failing while reads succeed is the
            # quiet failure — the API keeps serving stale rows and looks fine.
            "lastWriteError": self._write_error,
        }
