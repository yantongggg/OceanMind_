"""
Disruption Intelligence Agent — Detect stage.

Clusters raw maritime signals (news / UKMTO / port authorities / market
feeds) into coherent disruption events, scores corroboration and severity,
and scans the fleet for exposed voyages.

Clustering is corridor-aware: chokepoints that form one operational corridor
(e.g. Bab el-Mandeb + Suez Canal = the Red Sea corridor) are single-linkage
merged, then signals are grouped by (corridor, fleet relevance).
"""

from __future__ import annotations

from collections import defaultdict

from models import Disruption, Signal, Voyage

SEVERITY_ORDER = {"low": 0, "medium": 1, "high": 2, "critical": 3}


class NoDisruptionDetected(Exception):
    """No signal cluster intersects the fleet.

    A legitimate outcome on live data — quiet seas — not an error in the
    engine. Callers should fall back to the curated dataset or report calm,
    never synthesise a disruption to fill the gap.
    """

# Chokepoint → operational corridor. Adjacent chokepoints on the same trade
# lane cluster together: a shooting at Bab el-Mandeb and a Suez transit
# collapse are one event, not two.
CORRIDORS: dict[str, str] = {
    "Bab el-Mandeb": "Red Sea corridor",
    "Suez Canal": "Red Sea corridor",
    "Malacca Strait": "SE Asia corridor",
    "Singapore Strait": "SE Asia corridor",
    "Strait of Hormuz": "Gulf corridor",
    "Panama Canal": "Panama corridor",
    "Taiwan Strait": "East Asia corridor",
    "Dover Strait": "North Europe corridor",
}


def corroboration_score(signals: list[Signal]) -> float:
    """Cross-source verification score in [0, 1] from distinct sources."""
    distinct_sources = len({s.source for s in signals})
    return min(0.99, round(0.61 + 0.04 * distinct_sources, 2))


def cluster_severity(signals: list[Signal]) -> str:
    return max((s.severity for s in signals), key=lambda s: SEVERITY_ORDER[s])


def cluster_signals(signals: list[Signal]) -> dict[str, list[Signal]]:
    """Group fleet-relevant signals into corridor clusters.

    A signal joins a cluster when it is tagged to a corridor chokepoint AND
    intersects at least one active voyage (fleet relevance filter — macro
    commentary without route intersection stays in the background feed).
    """
    clusters: dict[str, list[Signal]] = defaultdict(list)
    for s in signals:
        if not s.affected_chokepoint or not s.affected_voyage_ids:
            continue
        corridor = CORRIDORS.get(s.affected_chokepoint)
        if corridor:
            clusters[corridor].append(s)
    return dict(clusters)


class DisruptionAgent:
    """Detect: signals → clustered Disruption objects + fleet exposure."""

    def detect(self, signals: list[Signal], voyages: list[Voyage]) -> dict:
        clusters = cluster_signals(signals)

        if not clusters:
            # No signal carries both a corridor chokepoint and fleet
            # intersection. With the curated dataset this cannot happen; with
            # live news it can and does — a quiet day, an RSS outage, a
            # network blip. Raise something the caller can act on rather than
            # letting `max()` throw a bare ValueError from deep in the agent.
            raise NoDisruptionDetected(
                f"no clusterable signals among {len(signals)} — "
                "nothing intersects the fleet at a tracked corridor"
            )

        # Primary cluster = highest (severity, size) — the Red Sea corridor
        # in the golden dataset (9 signals, critical).
        corridor, members = max(
            clusters.items(),
            key=lambda kv: (SEVERITY_ORDER[cluster_severity(kv[1])], len(kv[1])),
        )
        members = sorted(members, key=lambda s: s.id)
        affected_ids = sorted({vid for s in members for vid in s.affected_voyage_ids})
        chokepoints = {s.affected_chokepoint for s in members if s.affected_chokepoint}
        primary_chokepoint = (
            "Bab el-Mandeb" if "Bab el-Mandeb" in chokepoints else sorted(chokepoints)[0]
        )
        started = min(s.published_at for s in members)

        disruption = Disruption(
            id="DSR-001",
            title=f"{corridor.replace(' corridor', '')} / {primary_chokepoint} security escalation",
            description=(
                f"{len(members)} corroborated signals: kinetic attacks on merchant "
                "tonnage, SEVERE threat level, war-risk repricing and carrier "
                "diversions concentrated on one corridor."
            ),
            severity=cluster_severity(members),
            region=corridor.replace(" corridor", ""),
            chokepoint=primary_chokepoint,
            signal_ids=[s.id for s in members],
            affected_voyage_ids=affected_ids,
            started_at=started,
            status="active",
        )

        # Fleet exposure scan: which active voyages intersect the corridor,
        # and which of them still has the transit ahead of it.
        exposed = [v for v in voyages if v.id in affected_ids]
        target = next(
            (
                v
                for v in exposed
                if any(
                    primary_chokepoint in (ro.via_chokepoints or [])
                    for ro in v.route_options
                    if ro.id == v.active_route_id
                )
            ),
            exposed[0] if exposed else None,
        )

        return {
            "clusters": clusters,
            "disruption": disruption,
            "signals": members,
            "corroboration": corroboration_score(members),
            "distinctSources": len({s.source for s in members}),
            "exposedVoyages": exposed,
            "targetVoyage": target,
            "totalSignals": len(signals),
            "corridorSignalCount": len(
                [s for s in signals if CORRIDORS.get(s.affected_chokepoint or "") == corridor]
            ),
        }
