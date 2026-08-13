"""
OceanMind backend — golden dataset seed.

`golden.json` is extracted 1:1 from the frontend's `src/data/mock.ts`
(the single source of truth for the demo story), so every id, number and
narrative string matches the frontend exactly. This module validates it
into typed pydantic models and exposes a small in-memory "database" that
the API routes mutate (approvals, overrides, new pipeline runs).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from models import (
    CausalGraph,
    ComplianceReport,
    Decision,
    Disruption,
    EsgSummary,
    PipelineRun,
    Signal,
    Supplier,
    Voyage,
)

GOLDEN_PATH = Path(__file__).resolve().parent / "golden.json"

# encoding is explicit: Python defaults to the locale codec, which on Windows
# is cp1252, and the dataset is full of em-dashes and typographic quotes. They
# survived to the API as mojibake ("Direct â€" Hormuz") before this.
with GOLDEN_PATH.open(encoding="utf-8") as fh:
    _raw: dict[str, Any] = json.load(fh)

# ── Typed, validated golden data ─────────────────────────────────────────

SIGNALS: list[Signal] = [Signal.model_validate(s) for s in _raw["signals"]]
VOYAGES: list[Voyage] = [Voyage.model_validate(v) for v in _raw["voyages"]]
DISRUPTIONS: list[Disruption] = [Disruption.model_validate(d) for d in _raw["disruptions"]]
DECISIONS: list[Decision] = [Decision.model_validate(d) for d in _raw["decisions"]]
SUPPLIERS: list[Supplier] = [Supplier.model_validate(s) for s in _raw["suppliers"]]
PIPELINE_RUN: PipelineRun = PipelineRun.model_validate(_raw["pipelineRun"])
CAUSAL_GRAPH: CausalGraph = CausalGraph.model_validate(_raw["causalGraph"])
ESG_SUMMARY: EsgSummary = EsgSummary.model_validate(_raw["esgSummary"])
REPORTS: list[ComplianceReport] = [ComplianceReport.model_validate(r) for r in _raw["reports"]]

# The golden scenario anchors
GOLDEN_VOYAGE_ID = "VYG-2026-0007"
GOLDEN_DECISION_ID = "DEC-0042"
GOLDEN_DISRUPTION_ID = "DSR-001"


class Store:
    """Mutable in-memory state for the demo session."""

    def __init__(self) -> None:
        self.signals = SIGNALS
        self.voyages = {v.id: v for v in VOYAGES}
        self.disruptions = {d.id: d for d in DISRUPTIONS}
        self.decisions = {d.id: d.model_copy(deep=True) for d in DECISIONS}
        self.suppliers = SUPPLIERS
        self.esg_summary = ESG_SUMMARY
        self.reports = {r.id: r.model_copy(deep=True) for r in REPORTS}
        self.pipeline_runs: dict[str, PipelineRun] = {PIPELINE_RUN.id: PIPELINE_RUN}
        self.causal_graph = CAUSAL_GRAPH

    # convenience lookups -------------------------------------------------
    def voyage(self, voyage_id: str) -> Voyage | None:
        return self.voyages.get(voyage_id)

    def decision(self, decision_id: str) -> Decision | None:
        return self.decisions.get(decision_id)


STORE = Store()
