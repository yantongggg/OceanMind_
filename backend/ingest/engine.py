"""
Ingestion engine — the orchestrator.

    sources → mapper → enrichment → store

Skeleton ported from stock_visualizer's news_intelligence/engine.py: background
thread, fixed interval, per-source try/except isolation, dedup, persist. Sound
design, kept.

What was fixed on the way over — the donor's `_do_refresh()` called
`self.ais_stream.to_articles()` with no `available` guard, unlike the guarded
ACLED/FIRMS calls. With no API key the AIS adapter had no traffic data, read
`count=0` against a `baseline=150` as a 100% drop, and emitted "Maritime Alert:
Traffic disrupted at Strait of Malacca … may indicate blockade, military
operations". Those fabrications went straight into the sentiment scorer; 3 of
the last 20 signals it produced were pure fiction.

So here, `_sweep_source()` checks `available` for every source, and a source
that errors is recorded as an ERROR — never as an empty world. A quiet sea and
a broken pipe look nothing alike, and the difference is visible in status().
"""

from __future__ import annotations

import logging
import os
import threading
import time
from datetime import datetime, timezone
from typing import Optional, Protocol

from ingest import enrich as enrich_mod
from ingest.mapper import compute_corroboration, enrich_articles, to_signal
from ingest.sources.maritime_rss import MaritimeRssSource
from ingest.sources.news_search import NewsSearchSource
from ingest.store import SignalStore
from models import Signal, Voyage

logger = logging.getLogger(__name__)

DEFAULT_INTERVAL_SEC = 300


class Source(Protocol):
    name: str

    @property
    def available(self) -> bool: ...

    def fetch(self) -> list[dict]: ...

    def status(self) -> dict: ...


class IngestEngine:
    """Polls live sources on an interval and persists mapped signals."""

    def __init__(
        self,
        voyages: list[Voyage],
        sources: Optional[list[Source]] = None,
        store: Optional[SignalStore] = None,
        interval_sec: Optional[int] = None,
    ) -> None:
        self._voyages = voyages
        self._sources: list[Source] = sources or [
            NewsSearchSource(),
            MaritimeRssSource(),
        ]
        self._store = store or SignalStore()
        self._interval = interval_sec or int(
            os.environ.get("INGEST_INTERVAL_SEC", DEFAULT_INTERVAL_SEC)
        )

        self._thread: Optional[threading.Thread] = None
        self._running = False
        self._lock = threading.Lock()

        self._refresh_count = 0
        self._last_refresh: Optional[str] = None
        self._last_result: dict = {}
        self._source_errors: dict[str, str] = {}

    # ── lifecycle ────────────────────────────────────────────────────────

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._loop, name="ingest", daemon=True)
        self._thread.start()
        logger.info("IngestEngine started — interval=%ss, sources=%s",
                    self._interval, [s.name for s in self._sources])

    def stop(self) -> None:
        self._running = False
        if self._thread:
            self._thread.join(timeout=15)
            self._thread = None

    def _loop(self) -> None:
        while self._running:
            try:
                self.refresh()
            except Exception:
                logger.exception("IngestEngine refresh crashed — continuing")
            # Sleep in slices so stop() is responsive.
            for _ in range(self._interval):
                if not self._running:
                    return
                time.sleep(1)

    # ── the sweep ────────────────────────────────────────────────────────

    def _sweep_source(self, source: Source) -> list[dict]:
        """Fetch one source. Errors are recorded, never interpreted.

        Returns [] both when a source is genuinely quiet and when it failed —
        but only the failure sets _source_errors, and callers/status() can tell
        them apart. Nothing downstream may treat [] as evidence of calm.
        """
        if not source.available:
            self._source_errors[source.name] = "unavailable (missing credentials or disabled)"
            logger.info("skipping %s — unavailable", source.name)
            return []
        try:
            articles = source.fetch()
            self._source_errors.pop(source.name, None)
            return articles
        except Exception as e:
            self._source_errors[source.name] = f"{type(e).__name__}: {e}"
            logger.warning("source %s failed: %s", source.name, e)
            return []

    def refresh(self) -> dict:
        """One full ingestion cycle. Returns a summary of what happened."""
        started = time.time()

        raw: list[dict] = []
        for source in self._sources:
            raw.extend(self._sweep_source(source))

        # Deduplicate by URL across sources — the same Reuters piece arrives
        # via both the news search and a syndicating feed.
        seen: set[str] = set()
        unique: list[dict] = []
        for art in raw:
            url = (art.get("url") or "").strip()
            if url and url not in seen:
                seen.add(url)
                unique.append(art)

        # Place at a chokepoint + classify. Unplaceable articles are dropped
        # here rather than given a fabricated location.
        placed = enrich_articles(unique)

        corroboration = compute_corroboration(placed)

        def build(prose: dict[str, tuple[str, str]]) -> list[Signal]:
            out: list[Signal] = []
            for art in placed:
                plain, not_implied = prose.get(art["url"], ("", ""))
                signal = to_signal(
                    art,
                    self._voyages,
                    corroboration.get(art["url"], 1),
                    plain,
                    not_implied,
                )
                if signal:
                    out.append(signal)
            return out

        # Land the signals FIRST, with template prose. Enrichment used to run
        # inline and pushed a 25s sweep to 380s — longer than the 300s poll
        # interval, so sweeps overlapped and nothing was visible until the last
        # model call returned. Signals are useful without polished prose;
        # prose is not useful without signals.
        signals = build(enrich_mod.templates(placed))
        persisted = self._store.upsert(signals)

        # Now upgrade the prose on the subset worth a model call and write
        # again. Imported lazily — service imports this module.
        from ingest.service import focus_chokepoints

        if enrich_mod.enrichment_enabled():
            try:
                prose = enrich_mod.enrich(placed, focus_chokepoints=focus_chokepoints())
                enriched = build(prose)
                self._store.upsert(enriched)
                signals = enriched
            except Exception:
                # Templates are already persisted — this costs polish, not data.
                logger.exception("enrichment pass failed; templates stand")

        with self._lock:
            self._refresh_count += 1
            self._last_refresh = datetime.now(timezone.utc).isoformat()
            self._last_result = {
                "rawArticles": len(raw),
                "uniqueArticles": len(unique),
                "placedAtChokepoint": len(placed),
                "signalsBuilt": len(signals),
                "signalsPersisted": persisted,
                "fleetRelevant": len([s for s in signals if s.affected_voyage_ids]),
                "enrichedByLlm": enrich_mod.enrichment_enabled(),
                "durationSec": round(time.time() - started, 1),
                "sourceErrors": dict(self._source_errors),
            }

        logger.info(
            "ingest refresh: %d raw → %d unique → %d placed → %d signals (%d persisted) in %.1fs",
            len(raw), len(unique), len(placed), len(signals), persisted,
            time.time() - started,
        )

        # New signals mean the impact assessment is stale. Warm it here, on the
        # sweep thread, so /api/impact is hot before anyone asks — escalation
        # costs 20-60s and must never happen inside a GET.
        self._warm_impact()

        return self._last_result

    def _warm_impact(self) -> None:
        """Recompute the cached impact assessment. Never raises."""
        try:
            from agents import impact

            impact.invalidate()
            impact.cached_assess(self._store.recent(limit=400), self._voyages)
        except Exception:
            logger.exception("impact warm failed; previous assessment stands")

    # ── reads ────────────────────────────────────────────────────────────

    def signals(self, limit: int = 200) -> list[Signal]:
        return self._store.recent(limit=limit)

    def status(self) -> dict:
        with self._lock:
            return {
                "running": self._running,
                "intervalSec": self._interval,
                "refreshCount": self._refresh_count,
                "lastRefresh": self._last_refresh,
                "lastResult": self._last_result,
                "store": self._store.status(),
                "sources": [s.status() for s in self._sources],
                # Explicit: a source in here produced no data because it BROKE,
                # not because the world is quiet.
                "sourceErrors": dict(self._source_errors),
            }
