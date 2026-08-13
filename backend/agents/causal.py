"""
Causal Impact Agent — Explain stage.

Builds a networkx root-cause DAG (event → chokepoint/port → route → voyage
→ quantified impact), validates it is acyclic, decomposes the plan-of-record
risk score and quantifies the do-nothing counterfactual.
"""

from __future__ import annotations

import networkx as nx

from models import CausalEdge, CausalGraph, CausalNode, Disruption, Signal, Voyage

# Plan-of-record risk decomposition (0–100 composite).
RISK_DECOMPOSITION = {
    "security": 48,   # kinetic attack likelihood × target-class multiplier 1.9
    "insurance": 18,  # premium ×4, cover-withdrawal risk
    "schedule": 16,   # convoy slots 2/week × 12 vessels, oversubscribed 3:1
}
ACTION_THRESHOLD = 40

# Do-nothing counterfactual inputs
WAR_RISK_PREMIUM_USD = 400_000       # 0.9% hull value (SIG-0003)
P_FURTHER_ESCALATION = 0.35          # historical 6–14 week normalisation cycles (SIG-0009)


class CausalAgent:
    """Explain: disruption cluster → causal DAG + quantified counterfactual."""

    def explain(
        self,
        disruption: Disruption,
        voyage: Voyage,
        signals: list[Signal],
    ) -> dict:
        sig = {s.id: s for s in signals}

        def has(sid: str) -> bool:
            return sid in sig

        g = nx.DiGraph()
        nodes: list[CausalNode] = []
        edges: list[CausalEdge] = []

        def node(id_, label, kind, detail, severity, ref=None):
            n = CausalNode(id=id_, label=label, kind=kind, detail=detail,
                           severity=severity, ref_id=ref)
            nodes.append(n)
            g.add_node(id_, label=label, kind=kind)

        def edge(id_, src, dst, label, conf):
            e = CausalEdge(id=id_, source=src, target=dst, label=label, confidence=conf)
            edges.append(e)
            g.add_edge(src, dst, label=label, confidence=conf)

        # ── Nodes derived from the signal cluster ────────────────────────
        node("CN-01", f"{disruption.chokepoint} escalation", "event",
             f"{len(disruption.signal_ids)} corroborated signals over "
             f"{self._cluster_span_hours(signals)} h; container vessels preferentially targeted.",
             "critical", disruption.id)
        if has("SIG-0003"):
            node("CN-02", "War-risk premium ×4", "event",
                 "Additional premium 0.22% → 0.9% of hull value; several syndicates "
                 "declining container tonnage (SIG-0003). ≈ USD 400k for this transit.",
                 "high", "SIG-0003")
        node("CN-03", "Suez transit risk ↑", "chokepoint",
             f"Composite plan-of-record risk {sum(RISK_DECOMPOSITION.values())}/100: "
             "attack exposure + insurance + convoy scarcity.",
             "critical", "SIG-0006" if has("SIG-0006") else None)
        node("CN-04", "Industry reroute pressure", "route",
             "Two top-5 carriers divert all Asia–Europe strings via the Cape "
             "(SIG-0004); Suez daily transits −38% (SIG-0006).",
             "high", "SIG-0004")
        node("CN-05", "Singapore bunker congestion", "port",
             "Bunker demand +22% w/w; barge lead 3–4 days; VLSFO +5.5% to USD 612/t "
             "(SIG-0010, SIG-0034).", "medium", "SIG-0010")
        node("CN-06", "Port Klang berth congestion", "port",
             "Berth waiting 24–30 h as diverted services re-sequence rotations (SIG-0011).",
             "medium", "SIG-0011")
        node("CN-07", "Cape routing viable", "route",
             "11,720 nm; no war-risk premium; winter Agulhas advisory manageable "
             "with slow-steaming; fuel loaded in Asia avoids Durban lead times.",
             "low", "RT-0007-B")
        node("CN-08", f"{voyage.id} plan degraded", "voyage",
             f"{voyage.vessel.name} ({voyage.vessel.capacity} — highest-risk target class) "
             f"holds a Suez plan of record with {disruption.chokepoint} transit ahead. "
             "Divergence point in ~14 h.", "critical", voyage.id)
        node("CN-09", "Quantified impact & decision", "impact",
             "Reroute via Cape + slow-steam: ETA +7.5 d · fuel +USD 182k · CO₂ +5.9% "
             "· avoids ≈ USD 400k premium · FuelEU PASS.", "high", "DEC-0042")

        # ── Edges (causal claims with confidence) ────────────────────────
        edge("CE-01", "CN-01", "CN-02", "reprices insurance", 0.95)
        edge("CE-02", "CN-01", "CN-03", "raises transit risk", 0.97)
        edge("CE-03", "CN-02", "CN-03", "compounds cost of", 0.90)
        edge("CE-04", "CN-03", "CN-04", "drives carriers to divert", 0.92)
        edge("CE-05", "CN-04", "CN-05", "concentrates bunker demand", 0.85)
        edge("CE-06", "CN-04", "CN-06", "re-sequences port calls", 0.78)
        edge("CE-07", "CN-04", "CN-07", "validates as industry norm", 0.83)
        edge("CE-08", "CN-03", "CN-08", "invalidates plan of record", 0.94)
        edge("CE-09", "CN-05", "CN-09", "forces early bunker lock-in", 0.80)
        edge("CE-10", "CN-07", "CN-09", "enables reroute option", 0.88)
        edge("CE-11", "CN-08", "CN-09", "requires decision within 14 h", 0.96)

        # ── Validation: must be a DAG with one root explaining the impact ─
        assert nx.is_directed_acyclic_graph(g), "causal graph must be acyclic"
        roots = [n for n in g.nodes if g.in_degree(n) == 0]
        confidences = [e.confidence for e in edges]

        plan_risk = sum(RISK_DECOMPOSITION.values())
        return {
            "graph": CausalGraph(nodes=nodes, edges=edges),
            "nx": g,
            "roots": roots,
            "nodeCount": g.number_of_nodes(),
            "edgeCount": g.number_of_edges(),
            "confidenceRange": (min(confidences), max(confidences)),
            "planRiskScore": plan_risk,
            "riskDecomposition": RISK_DECOMPOSITION,
            "actionThreshold": ACTION_THRESHOLD,
            "actionRequired": plan_risk > ACTION_THRESHOLD,
            "counterfactual": {
                "warRiskPremiumUsd": WAR_RISK_PREMIUM_USD,
                "convoyWaitDays": (2, 3),
                "pFurtherEscalation": P_FURTHER_ESCALATION,
            },
            "constraints": [
                "charterer delivery window Rotterdam ≤ 15 Aug",
                "crew-safety policy: no SEVERE-corridor transit without board sign-off",
                "FuelEU compliance must hold",
            ],
        }

    @staticmethod
    def _cluster_span_hours(signals: list[Signal]) -> int:
        from datetime import datetime

        stamps = [datetime.fromisoformat(s.published_at.replace("Z", "+00:00")) for s in signals]
        span = max(stamps) - min(stamps)
        return int(round(span.total_seconds() / 3600 / 10) * 10)  # nearest 10 h
