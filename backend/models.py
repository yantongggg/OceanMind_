"""
OceanMind backend — shared pydantic models.

These mirror frontend/src/data/types.ts EXACTLY. Field names are snake_case in
Python and serialized to camelCase JSON via pydantic's `to_camel` alias
generator, so the wire format matches the TypeScript contract byte-for-byte.

Do not fork or redefine these shapes elsewhere — import from here.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base model: camelCase aliases on the wire, snake_case in Python."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    def dump(self) -> dict:
        """Serialize with camelCase keys (what the frontend expects)."""
        return self.model_dump(by_alias=True)


# ── Signals ──────────────────────────────────────────────────────────────

SignalCategory = Literal["geopolitical", "weather", "port", "regulatory", "piracy"]
Severity = Literal["low", "medium", "high", "critical"]

# Where a signal came from. `golden` = the curated synthetic demo dataset;
# `live` = ingested from a real source (GDELT / RSS) and carries a url.
# Kept explicit so synthetic demo data can never be mistaken for real reporting.
SignalOrigin = Literal["golden", "live"]


class Signal(CamelModel):
    id: str
    title: str
    summary: str
    plain_english: str
    not_implied: str
    category: SignalCategory
    severity: Severity
    lat: float
    lon: float
    source: str
    published_at: str
    corroboration: int
    affected_voyage_ids: list[str]
    affected_chokepoint: Optional[str] = None
    # Provenance. Live-ingested signals carry the originating article URL;
    # golden-dataset signals have none, which is what makes them visibly
    # distinguishable from real reporting in the UI.
    url: Optional[str] = None
    origin: SignalOrigin = "golden"


# ── Vessels & voyages ────────────────────────────────────────────────────


class Vessel(CamelModel):
    id: str
    name: str
    imo: str
    type: str
    capacity: str
    flag: str
    built_year: int
    fuel_types: list[str]


VoyageStatus = Literal[
    "underway", "at_anchor", "in_port", "rerouted", "delayed", "completed"
]


class RouteOption(CamelModel):
    id: str
    label: str
    waypoints: list[tuple[float, float]]  # [lon, lat] pairs
    distance_nm: float
    eta_days: float
    fuel_tonnes: float
    fuel_usd: float
    co2_tonnes: float
    risk_score: float
    via_chokepoints: list[str]
    notes: Optional[str] = None
    recommended: Optional[bool] = None


class PortCall(CamelModel):
    port: str
    lat: float
    lon: float
    purpose: Literal["load", "discharge", "bunker", "transit", "canal"]
    eta_iso: str = Field(alias="etaISO")  # to_camel would give "etaIso"
    congestion_hours: Optional[float] = None


class FuelPlan(CamelModel):
    fuel_type: str
    planned_tonnes: float
    consumed_tonnes: float
    bunker_port: str
    supplier_id: Optional[str] = None


class Voyage(CamelModel):
    id: str
    vessel: Vessel
    origin_port: str
    origin_lat: float
    origin_lon: float
    destination_port: str
    destination_lat: float
    destination_lon: float
    departed_at: str
    eta_original: str
    eta_current: str
    progress_pct: float
    current_lat: float
    current_lon: float
    status: VoyageStatus
    cargo: str
    route_options: list[RouteOption]
    active_route_id: str
    port_calls: list[PortCall]
    fuel_plan: FuelPlan
    co2_to_date_tonnes: float
    decision_ids: list[str]
    charterer: str


class Disruption(CamelModel):
    id: str
    title: str
    description: str
    severity: Severity
    region: str
    chokepoint: Optional[str] = None
    signal_ids: list[str]
    affected_voyage_ids: list[str]
    started_at: str
    status: Literal["active", "monitoring", "resolved"]


# ── Multi-agent pipeline ─────────────────────────────────────────────────

AgentId = Literal["disruption", "causal", "simulation", "decision", "tools", "human"]
PipelineStage = Literal["detect", "explain", "simulate", "recommend", "approve"]
AgentEventKind = Literal[
    "observation",
    "analysis",
    "tool_call",
    "tool_result",
    "handoff",
    "recommendation",
    "gate",
]


class AgentEvent(CamelModel):
    id: str
    ts: str
    agent: AgentId
    stage: PipelineStage
    kind: AgentEventKind
    title: str
    detail: str
    data_refs: list[str]


class PipelineRun(CamelModel):
    id: str
    decision_id: str
    voyage_id: str
    started_at: str
    finished_at: Optional[str] = None
    status: Literal["running", "complete", "failed"]
    events: list[AgentEvent]


# ── Causal graph ─────────────────────────────────────────────────────────

CausalNodeKind = Literal["event", "chokepoint", "port", "route", "voyage", "impact"]


class CausalNode(CamelModel):
    id: str
    label: str
    kind: CausalNodeKind
    detail: str
    severity: Severity
    ref_id: Optional[str] = None


class CausalEdge(CamelModel):
    id: str
    source: str
    target: str
    label: str
    confidence: float


class CausalGraph(CamelModel):
    nodes: list[CausalNode]
    edges: list[CausalEdge]


# ── Decisions ────────────────────────────────────────────────────────────


class ImpactDelta(CamelModel):
    eta_hours: float
    fuel_usd: float
    fuel_tonnes: float
    co2_tonnes: float
    co2_pct: float
    eu_ets_usd: float
    risk_score: float


ReliabilityStatus = Literal["READY", "REVIEW", "ESCALATE", "INSUFFICIENT_EVIDENCE"]


class EvidenceItem(CamelModel):
    id: str
    label: str
    kind: Literal["signal", "calculation", "regulation", "market", "historical"]
    detail: str
    source_ref: str
    confidence: float


class ApprovalRecord(CamelModel):
    approved_by: str
    approver_email: str
    action: Literal["approved", "overridden"]
    comment: str
    at: str


class Alternative(CamelModel):
    id: str
    label: str
    summary: str
    impact: ImpactDelta
    rejection_reason: str


class Recommendation(CamelModel):
    headline: str
    actions: list[str]


class AgentTrace(CamelModel):
    pipeline_run_id: str


class Decision(CamelModel):
    id: str
    voyage_id: str
    disruption_id: str
    created_at: str
    title: str
    recommendation: Recommendation
    rationale: str
    alternatives: list[Alternative]
    impact: ImpactDelta
    evidence: list[EvidenceItem]
    reliability: ReliabilityStatus
    reliability_note: str
    approval: Optional[ApprovalRecord] = None
    agent_trace: AgentTrace
    status: Literal["pending", "approved", "overridden", "expired"]
    severity: Severity


# ── Suppliers ────────────────────────────────────────────────────────────


class SupplierIncident(CamelModel):
    date: str
    summary: str
    severity: Severity


class Supplier(CamelModel):
    id: str
    name: str
    port: str
    lat: float
    lon: float
    fuels_offered: list[str]
    reliability: float
    fuel_quality: float
    esg_score: float
    alt_fuel_readiness: float
    price_competitiveness: float
    incidents: list[SupplierIncident]
    certifications: list[str]
    years_active: int
    deliveries_ytd: int


# ── ESG / compliance ─────────────────────────────────────────────────────


class FuelEuPosition(CamelModel):
    ghg_intensity: float
    limit: float
    compliant: bool
    surplus_deficit_pct: float


class ImoCii(CamelModel):
    fleet_rating: Literal["A", "B", "C", "D", "E"]
    trend: Literal["improving", "stable", "degrading"]


class MonthlyCo2(CamelModel):
    month: str
    actual: float
    baseline: float


class SdgAlignment(CamelModel):
    sdg: int
    title: str
    contribution: str
    metric: str


class EsgSummary(CamelModel):
    as_of: str
    fleet_co2_ytd_tonnes: float
    co2_saved_vs_baseline_tonnes: float
    co2_saved_pct: float
    eu_ets_exposure_usd: float
    eu_ets_phase_in_pct: float
    eu_ets_allowance_price_eur: float
    fuel_eu: FuelEuPosition
    imo_cii: ImoCii
    monthly_co2: list[MonthlyCo2]
    sdg_alignment: list[SdgAlignment]


class ComplianceReport(CamelModel):
    id: str
    title: str
    type: Literal["EU_ETS", "FUELEU", "IMO_DCS", "DECISION_AUDIT", "ESG_QUARTERLY"]
    period: str
    generated_at: str
    status: Literal["final", "draft", "submitted"]
    summary: str
    decision_ids: list[str]
    voyage_ids: list[str]
    size_kb: float
    prepared_by: str
