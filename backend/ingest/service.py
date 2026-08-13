"""
Ingestion service — the seam between live signals and the agent pipeline.

Owns the engine singleton and the INGEST_MODE switch:

    INGEST_MODE=golden  (default) — serve the curated demo dataset.
    INGEST_MODE=live              — serve real ingested signals, with golden
                                    as the automatic fallback.

Why the fallback is not optional. The Detect stage
(agents/disruption.py::detect) picks its primary cluster with

    max(clusters.items(), key=...)

which raises ValueError on an empty dict. A cluster only forms from signals
that have BOTH a chokepoint AND fleet intersection. Live news is lumpy — a
quiet news day, a network blip, or an RSS outage can legitimately produce zero
clusterable signals, and the whole pipeline would 500 in front of an audience.

So `active_signals()` returns live signals only when they can actually sustain
the Detect stage, and golden otherwise. The mode is reported honestly in
`status()` — `servingGolden: true` while in live mode means "we fell back",
and the UI should say so rather than pass curated data off as reporting.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from agents.disruption import CORRIDORS
from data.seed import STORE
from ingest.engine import IngestEngine
from models import Signal

logger = logging.getLogger(__name__)

# A corridor needs at least this many fleet-relevant signals before we trust
# live data to drive the pipeline. One stray headline is not a disruption.
MIN_CLUSTER_SIZE = 2

# Corridors the WHOLE chain can act on, not just Detect.
#
# Detect and Explain are generic — they cluster and build a causal DAG for any
# corridor. Simulate is not: agents/simulation.py prices a Suez plan of record
# (route -A) against a Cape of Good Hope diversion (route -B), with hardcoded
# convoy/slow-steam variants and Red Sea weather factors. Only voyages with
# that A/B route pair can be costed by it.
#
# This matters in live mode because the real world does not follow the demo
# script. The largest live cluster right now is the Gulf corridor (Hormuz),
# which targets a VLCC with no Cape alternative — Detect handles it fine and
# Simulate then raises UnsupportedVoyage.
#
# So live signals are scoped to corridors the full chain supports. Signals from
# other corridors are still ingested, stored and shown in the feed; they just
# don't get to pick the voyage the pipeline simulates. Widening this set means
# generalising SimulationAgent first — not editing this list.
SIMULATABLE_CORRIDORS = {"Red Sea corridor"}

_engine: Optional[IngestEngine] = None


def mode() -> str:
    return (os.environ.get("INGEST_MODE") or "golden").strip().lower()


def live_mode() -> bool:
    return mode() == "live"


def get_engine() -> IngestEngine:
    """The ingestion engine singleton. Created on first use."""
    global _engine
    if _engine is None:
        _engine = IngestEngine(voyages=list(STORE.voyages.values()))
    return _engine


def start() -> None:
    """Start background ingestion — only in live mode."""
    if not live_mode():
        logger.info("INGEST_MODE=%s — live ingestion not started", mode())
        return
    get_engine().start()


def stop() -> None:
    global _engine
    if _engine is not None:
        _engine.stop()


def _clusterable(signals: list[Signal]) -> dict[str, int]:
    """Corridor → count of signals that would actually cluster there.

    Mirrors agents/disruption.py::cluster_signals — a signal counts only with
    both a corridor chokepoint and fleet intersection.
    """
    counts: dict[str, int] = {}
    for s in signals:
        if not s.affected_chokepoint or not s.affected_voyage_ids:
            continue
        corridor = CORRIDORS.get(s.affected_chokepoint)
        if corridor:
            counts[corridor] = counts.get(corridor, 0) + 1
    return counts


def pipeline_ready(signals: list[Signal]) -> bool:
    """Can these signals drive the FULL chain — not just Detect?

    Requires a simulatable corridor to hold the largest cluster, since Detect
    picks its primary cluster by (severity, size) and hands that voyage to
    Simulate.
    """
    counts = _clusterable(signals)
    if not counts:
        return False
    corridor, size = max(counts.items(), key=lambda kv: kv[1])
    return corridor in SIMULATABLE_CORRIDORS and size >= MIN_CLUSTER_SIZE


def focus_chokepoints() -> set[str]:
    """Chokepoints whose signals reach the pipeline — worth enriching."""
    return {cp for cp, corridor in CORRIDORS.items() if corridor in SIMULATABLE_CORRIDORS}


def simulatable_signals(signals: list[Signal]) -> list[Signal]:
    """Live signals scoped to corridors the full chain can act on.

    Everything else stays in the store and the feed — it is real intelligence
    and the operator should see it — but it does not get to select the voyage
    the simulator prices.
    """
    return [
        s
        for s in signals
        if CORRIDORS.get(s.affected_chokepoint or "") in SIMULATABLE_CORRIDORS
    ]


def display_signals() -> list[Signal]:
    """Every signal an operator should SEE — the whole intelligence picture.

    Distinct from active_signals(), and deliberately so. The pipeline is scoped
    to corridors the simulator can price; the globe and the feed are not. A
    Hormuz blockade or a Panama drought is real intelligence whether or not
    SimulationAgent can cost a reroute for it, and hiding it because of a
    downstream limitation would misrepresent the world.
    """
    if not live_mode():
        return STORE.signals
    try:
        live = get_engine().signals(limit=400)
    except Exception:
        logger.exception("live signal read failed — showing golden")
        return STORE.signals
    return live or STORE.signals


def active_signals() -> list[Signal]:
    """The signals the pipeline should reason over, right now.

    Live when live can drive the whole chain; golden otherwise. Never raises,
    never hands the pipeline something it will choke on.
    """
    if not live_mode():
        return STORE.signals

    try:
        live = get_engine().signals(limit=400)
    except Exception:
        logger.exception("live signal read failed — serving golden")
        return STORE.signals

    scoped = simulatable_signals(live)
    if not pipeline_ready(scoped):
        logger.warning(
            "live signals cannot drive the full chain (%d live, %d in simulatable "
            "corridors) — serving golden",
            len(live),
            len(scoped),
        )
        return STORE.signals

    return scoped


def serving_golden() -> bool:
    """True when the pipeline is reasoning over curated data, not reporting."""
    if not live_mode():
        return True
    try:
        return not pipeline_ready(simulatable_signals(get_engine().signals(limit=400)))
    except Exception:
        return True


def status() -> dict:
    base = {
        "mode": mode(),
        "liveMode": live_mode(),
        "servingGolden": serving_golden(),
        "minClusterSize": MIN_CLUSTER_SIZE,
        "simulatableCorridors": sorted(SIMULATABLE_CORRIDORS),
    }
    if _engine is None:
        base["engine"] = {"running": False, "note": "not started"}
        return base

    signals = _engine.signals(limit=400)
    base["engine"] = _engine.status()
    base["clusterableByCorridor"] = _clusterable(signals)
    base["driveable"] = pipeline_ready(simulatable_signals(signals))
    return base
