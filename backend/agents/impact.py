"""
Impact Assessment — the event-driven layer between a news feed and a map.

Answers one question: "something happened; which of my ships care, and what
should they do about it?"

Two tiers, deliberately:

  1. RULES (free, instant). ingest/mapper.py has already scored every signal's
     severity and placed it at a chokepoint. `find_anomaly()` is plain Python
     over that: is there a corridor with enough loud, corroborated, fleet-
     intersecting signal to be worth a human's attention? Almost every sweep
     answers no, and costs nothing.

  2. CLAUDE (only on anomaly). When the rules do fire, the model reads the
     cluster and the exposed voyages and reasons about consequence — which
     ships are genuinely affected and why, in a sentence an operator can act
     on. That is judgement, and rules cannot do it.

The split matters for cost (a quiet news day never calls the model) and for
honesty (the model never invents the tier-1 facts it reasons over).

NUMBERS ARE NOT THE MODEL'S JOB. Every figure below — distance, ETA, fuel,
USD, CO2 — is read from RouteOption fields that the deterministic tools
produced. The model picks WHICH route to recommend and says WHY; the delta is
arithmetic on data it never touches.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from typing import Optional

import llm_client
from agents.disruption import CORRIDORS, SEVERITY_ORDER
from models import RouteOption, Signal, Voyage

logger = logging.getLogger(__name__)

TIMEOUT_S = 60.0
MAX_TOKENS = 4000

# Tier-1 thresholds. An anomaly is not "a bad headline" — it is enough loud,
# independently-reported signal in one corridor that a human should look.
MIN_LOUD_SIGNALS = 2
MIN_CORROBORATION = 2
LOUD = frozenset({"high", "critical"})


# ── Tier 1: rules ────────────────────────────────────────────────────────


def find_anomaly(signals: list[Signal], voyages: list[Voyage]) -> Optional[dict]:
    """The loudest corridor worth escalating, or None.

    None is the normal answer and means exactly "nothing here" — never
    "we failed to look". Callers must not read a disruption into it.
    """
    by_corridor: dict[str, list[Signal]] = {}
    for s in signals:
        if not s.affected_chokepoint or not s.affected_voyage_ids:
            continue
        corridor = CORRIDORS.get(s.affected_chokepoint)
        if not corridor:
            continue
        by_corridor.setdefault(corridor, []).append(s)

    best: Optional[dict] = None
    for corridor, members in by_corridor.items():
        loud = [
            s for s in members
            if s.severity in LOUD and s.corroboration >= MIN_CORROBORATION
        ]
        if len(loud) < MIN_LOUD_SIGNALS:
            continue
        peak = max(loud, key=lambda s: (SEVERITY_ORDER[s.severity], s.corroboration))
        exposed_ids = sorted({vid for s in loud for vid in s.affected_voyage_ids})
        exposed = [v for v in voyages if v.id in exposed_ids]
        if not exposed:
            continue
        score = (SEVERITY_ORDER[peak.severity], len(loud))
        if best is None or score > best["_score"]:
            best = {
                "_score": score,
                "corridor": corridor,
                "signals": sorted(loud, key=lambda s: -s.corroboration),
                "peakSeverity": peak.severity,
                "chokepoints": sorted({s.affected_chokepoint for s in loud if s.affected_chokepoint}),
                "exposedVoyages": exposed,
                "distinctSources": len({s.source for s in loud}),
            }
    if best:
        best.pop("_score", None)
    return best


# ── Route arithmetic (deterministic) ─────────────────────────────────────


def _route(voyage: Voyage, route_id: str) -> Optional[RouteOption]:
    return next((r for r in voyage.route_options if r.id == route_id), None)


def route_delta(active: RouteOption, alt: RouteOption) -> dict:
    """Cost of switching. Pure subtraction over tool-computed fields."""
    return {
        "etaDays": round(alt.eta_days - active.eta_days, 1),
        "distanceNm": round(alt.distance_nm - active.distance_nm),
        "fuelTonnes": round(alt.fuel_tonnes - active.fuel_tonnes, 1),
        "fuelUsd": round(alt.fuel_usd - active.fuel_usd),
        "co2Tonnes": round(alt.co2_tonnes - active.co2_tonnes, 1),
        "co2Pct": round(
            100.0 * (alt.co2_tonnes - active.co2_tonnes) / active.co2_tonnes, 1
        )
        if active.co2_tonnes
        else 0.0,
        "riskScore": alt.risk_score - active.risk_score,
    }


def alternatives_for(voyage: Voyage) -> list[RouteOption]:
    """Route options other than the one currently being sailed."""
    return [r for r in voyage.route_options if r.id != voyage.active_route_id]


# ── Tier 2: Claude ───────────────────────────────────────────────────────

SYSTEM_PROMPT = (
    "You are the impact assessment layer of OceanMind, a maritime decision "
    "support system. A disruption has been detected and the affected fleet has "
    "already been identified by deterministic rules.\n\n"
    "For EACH voyage you are given, judge:\n"
    "  `affected` (bool) — is this voyage genuinely at risk from THIS "
    "disruption? A ship whose route crosses the corridor but has already "
    "passed it, or is thousands of miles away and inbound weeks from now, may "
    "not be.\n"
    "  `why` — ONE sentence an operations manager can act on. Name the "
    "mechanism (transit timing, cargo class, insurance, congestion). No "
    "restating the headline.\n"
    "  `recommendRouteId` — the route id you would switch to, chosen from the "
    "alternatives given, or null to hold the current plan.\n"
    "  `rationale` — ONE sentence on why that route, or why holding is right.\n"
    "  `urgency` — one of: immediate, monitor, informational.\n\n"
    "Rules:\n"
    "- NEVER state a number. Distances, ETAs, fuel, cost and CO2 are computed "
    "elsewhere and will be attached to your answer. Numbers you invent will be "
    "wrong.\n"
    "- Only choose a recommendRouteId from the alternatives listed for that "
    "voyage. If a voyage has no alternatives, recommendRouteId MUST be null "
    "and you should say what else the operator can do.\n"
    "- If the disruption does not really touch a voyage, say affected=false. "
    "Being conservative is correct; crying wolf costs trust.\n"
    "- Return ONLY a JSON array of {voyageId, affected, why, "
    "recommendRouteId, rationale, urgency}. No markdown."
)


def _claude_payload(anomaly: dict) -> dict:
    voyages_brief = []
    for v in anomaly["exposedVoyages"]:
        active = _route(v, v.active_route_id)
        voyages_brief.append(
            {
                "voyageId": v.id,
                "vessel": v.vessel.name,
                "type": v.vessel.type,
                "cargo": v.cargo,
                "route": f"{v.origin_port} → {v.destination_port}",
                "progressPct": v.progress_pct,
                "status": v.status,
                "currentRoute": {
                    "id": active.id,
                    "label": active.label,
                    "viaChokepoints": active.via_chokepoints,
                }
                if active
                else None,
                "alternatives": [
                    {"id": r.id, "label": r.label, "viaChokepoints": r.via_chokepoints}
                    for r in alternatives_for(v)
                ],
            }
        )

    context = {
        "corridor": anomaly["corridor"],
        "chokepoints": anomaly["chokepoints"],
        "peakSeverity": anomaly["peakSeverity"],
        "distinctSources": anomaly["distinctSources"],
        "signals": [
            {
                "title": s.title,
                "severity": s.severity,
                "corroboration": s.corroboration,
                "chokepoint": s.affected_chokepoint,
                "plainEnglish": s.plain_english[:220],
            }
            for s in anomaly["signals"][:8]
        ],
        "voyages": voyages_brief,
    }

    return {
        "max_tokens": MAX_TOKENS,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": json.dumps(context)}],
    }


def _extract_json_array(text: str) -> list:
    """Same tolerance as ingest/enrich.py — models fence their JSON."""
    from ingest.enrich import extract_json_array

    return extract_json_array(text)


def assess_with_claude(anomaly: dict) -> dict[str, dict]:
    """voyageId → model judgement. Empty dict on any failure."""
    if not llm_client.llm_enabled():
        return {}
    try:
        payload = _claude_payload(anomaly)
        body = llm_client.messages_request(
            system=payload["system"],
            messages=payload["messages"],
            max_tokens=payload["max_tokens"],
            timeout=TIMEOUT_S,
        )
        if body.get("stop_reason") in ("refusal", "max_tokens"):
            logger.warning("impact assessment stopped: %s", body.get("stop_reason"))
            return {}
        parsed = _extract_json_array(llm_client.response_text(body))
        return {
            item["voyageId"]: item
            for item in parsed
            if isinstance(item, dict) and item.get("voyageId")
        }
    except Exception as e:
        logger.warning("impact assessment failed, using rule fallback: %s", e)
        return {}


# ── Fallback judgement (no key / model failed) ───────────────────────────


def rule_judgement(voyage: Voyage, anomaly: dict) -> dict:
    """Deterministic stand-in. Honest about being shallow.

    Picks the lowest-risk alternative — a defensible default, and visibly not
    a reasoned one. Never claims insight it does not have.
    """
    alts = alternatives_for(voyage)
    best = min(alts, key=lambda r: r.risk_score) if alts else None
    chokepoints = ", ".join(anomaly["chokepoints"])
    return {
        "voyageId": voyage.id,
        "affected": True,
        "why": (
            f"Route transits {chokepoints}, where {len(anomaly['signals'])} "
            f"corroborated signals are active."
        ),
        "recommendRouteId": best.id if best else None,
        "rationale": (
            f"{best.label} carries the lowest modelled risk score of the "
            f"available alternatives."
            if best
            else "No alternative route is modelled for this voyage — the "
            "options here are speed, timing or escort, not diversion."
        ),
        "urgency": "immediate" if anomaly["peakSeverity"] == "critical" else "monitor",
        "reasoning": "rules",
    }


# ── Public entry point ───────────────────────────────────────────────────


def assess(signals: list[Signal], voyages: list[Voyage]) -> dict:
    """Full event-driven assessment. Returns {} shaped for the UI.

    `anomaly: null` means the rules found nothing worth escalating — a normal,
    common outcome, and NOT a failure. No model call is made in that case.
    """
    anomaly = find_anomaly(signals, voyages)
    if not anomaly:
        return {
            "anomaly": None,
            "escalated": False,
            "reasoning": "rules",
            "affected": [],
        }

    judgements = assess_with_claude(anomaly)
    escalated = bool(judgements)

    affected: list[dict] = []
    for voyage in anomaly["exposedVoyages"]:
        j = judgements.get(voyage.id) or rule_judgement(voyage, anomaly)
        if not j.get("affected", True):
            continue

        active = _route(voyage, voyage.active_route_id)
        rec_id = j.get("recommendRouteId")
        rec = _route(voyage, rec_id) if rec_id else None
        # The model may name a route that does not exist — never trust an id.
        if rec_id and not rec:
            logger.warning("model named unknown route %s on %s", rec_id, voyage.id)
            rec = None

        voyage_signals = [
            s for s in anomaly["signals"] if voyage.id in s.affected_voyage_ids
        ]

        affected.append(
            {
                "voyageId": voyage.id,
                "vesselName": voyage.vessel.name,
                "vesselType": voyage.vessel.type,
                "cargo": voyage.cargo,
                "originPort": voyage.origin_port,
                "destinationPort": voyage.destination_port,
                "currentLat": voyage.current_lat,
                "currentLon": voyage.current_lon,
                "progressPct": voyage.progress_pct,
                "status": voyage.status,
                "why": j.get("why", ""),
                "urgency": j.get("urgency", "monitor"),
                "rationale": j.get("rationale", ""),
                "reasoning": j.get("reasoning", "claude" if escalated else "rules"),
                "currentRoute": active.dump() if active else None,
                "suggestedRoute": rec.dump() if rec else None,
                "delta": route_delta(active, rec) if (active and rec) else None,
                "hasAlternatives": bool(alternatives_for(voyage)),
                "signalIds": [s.id for s in voyage_signals],
                "signals": [s.dump() for s in voyage_signals[:4]],
            }
        )

    order = {"immediate": 0, "monitor": 1, "informational": 2}
    affected.sort(key=lambda a: (order.get(a["urgency"], 3), -(a["delta"] or {}).get("riskScore", 0)))

    return {
        "anomaly": {
            "corridor": anomaly["corridor"],
            "chokepoints": anomaly["chokepoints"],
            "peakSeverity": anomaly["peakSeverity"],
            "signalCount": len(anomaly["signals"]),
            "distinctSources": anomaly["distinctSources"],
            "signals": [s.dump() for s in anomaly["signals"][:6]],
        },
        "escalated": escalated,
        "reasoning": "claude" if escalated else "rules",
        "affected": affected,
    }


# ── Cached read path ─────────────────────────────────────────────────────
#
# assess() escalates to Claude, which takes 20-60s. That cannot sit in a GET:
# the frontend gives a backend 8s before falling back to its offline mock, so
# a synchronous /api/impact always lost the race and the UI showed a rule-tier
# answer while the model was still thinking. Serve the last good assessment
# instantly; refresh it off the request path.

_CACHE_TTL_S = 600.0

_cache: Optional[dict] = None
_cache_at = 0.0
_lock = threading.Lock()
_refreshing = False


def cached_assess(signals: list[Signal], voyages: list[Voyage]) -> dict:
    """Last computed assessment, refreshed in the background when stale.

    First call computes inline — there is nothing to serve yet, and a rule-tier
    answer now beats an empty one. After that, reads are instant and staleness
    is bounded by _CACHE_TTL_S.
    """
    global _cache, _cache_at, _refreshing

    with _lock:
        fresh = _cache is not None and (time.time() - _cache_at) < _CACHE_TTL_S
        if fresh:
            return _cache
        first_run = _cache is None
        already_refreshing = _refreshing
        if not first_run and not already_refreshing:
            _refreshing = True

    if first_run:
        result = assess(signals, voyages)
        with _lock:
            _cache, _cache_at = result, time.time()
        return result

    if not already_refreshing:
        def refresh() -> None:
            global _cache, _cache_at, _refreshing
            try:
                result = assess(signals, voyages)
                with _lock:
                    _cache, _cache_at = result, time.time()
            except Exception:
                logger.exception("impact refresh failed; serving previous assessment")
            finally:
                with _lock:
                    _refreshing = False

        threading.Thread(target=refresh, name="impact-refresh", daemon=True).start()

    return _cache  # stale but real, and about to be replaced


def invalidate() -> None:
    """Drop the cache so the next assess() recomputes. Called after a sweep
    brings in new signals — the old judgement is about a world that moved."""
    global _cache_at
    with _lock:
        _cache_at = 0.0


def cache_status() -> dict:
    with _lock:
        return {
            "cached": _cache is not None,
            "ageSec": round(time.time() - _cache_at) if _cache else None,
            "refreshing": _refreshing,
            "ttlSec": _CACHE_TTL_S,
        }
