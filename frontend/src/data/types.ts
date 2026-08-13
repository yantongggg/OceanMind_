/**
 * OceanMind — shared data contract.
 *
 * This file is the single source of truth for every domain type used across
 * the frontend (and mirrored by the FastAPI backend via pydantic aliases).
 * Page builders IMPORT from here — never redefine or fork these shapes.
 *
 * Golden demo scenario: Red Sea / Bab el-Mandeb escalation → voyage
 * VYG-2026-0007 (MV OceanMind Harmony, Port Klang → Rotterdam) → decision
 * DEC-0042 recommends Cape of Good Hope reroute + slow steaming.
 */

/* ────────────────────────────────────────────────────────────────────────
 * Signals — captured maritime intelligence (news / GDELT / weather / AIS)
 * ──────────────────────────────────────────────────────────────────────── */

export type SignalCategory =
  | 'geopolitical'
  | 'weather'
  | 'port'
  | 'regulatory'
  | 'piracy';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Where a signal came from.
 *  - 'golden' — the curated synthetic demo dataset. Plausible, but authored,
 *    not reported. Never present these as real journalism.
 *  - 'live'   — ingested from a real source (GDELT / maritime RSS). Always
 *    carries `url` pointing at the originating article.
 */
export type SignalOrigin = 'golden' | 'live';

export interface Signal {
  id: string;                       // "SIG-0001"
  title: string;                    // headline as captured
  summary: string;                  // 1–2 sentence factual summary
  plainEnglish: string;             // what this means for operators, no jargon
  notImplied: string;               // explicitly what this signal does NOT imply
  category: SignalCategory;
  severity: Severity;
  lat: number;                      // WGS84 signal origin
  lon: number;
  source: string;                   // "Reuters", "Lloyd's List", "UNCTAD", "MPA Singapore"…
  publishedAt: string;              // ISO 8601
  corroboration: number;            // # of independent corroborating sources
  affectedVoyageIds: string[];      // voyages whose routes intersect this signal
  affectedChokepoint?: string;      // "Bab el-Mandeb" | "Suez Canal" | "Malacca Strait" | …
  url?: string;                     // originating article — live signals only
  origin?: SignalOrigin;            // defaults to 'golden' when absent
}

/* ────────────────────────────────────────────────────────────────────────
 * Event-driven impact assessment — GET /api/impact
 *
 * Two tiers. Rules scan every sweep for free; only a real signal cluster
 * escalates to Claude. `reasoning` says which tier answered, so the UI can be
 * honest about whether a judgement was reasoned or defaulted.
 * ──────────────────────────────────────────────────────────────────────── */

export type Urgency = 'immediate' | 'monitor' | 'informational';
export type Reasoning = 'rules' | 'claude';

/** Cost of switching routes. Arithmetic over tool-computed fields — never
 *  model output. Positive = the alternative costs more. */
export interface RouteDelta {
  etaDays: number;
  distanceNm: number;
  fuelTonnes: number;
  fuelUsd: number;
  co2Tonnes: number;
  co2Pct: number;
  riskScore: number;
}

export interface AffectedVoyage {
  voyageId: string;
  vesselName: string;
  vesselType: string;
  cargo: string;
  originPort: string;
  destinationPort: string;
  currentLat: number;
  currentLon: number;
  progressPct: number;
  status: VoyageStatus;
  why: string;                      // one sentence: the mechanism of risk
  urgency: Urgency;
  rationale: string;                // why this route, or why holding
  reasoning: Reasoning;
  currentRoute: RouteOption | null;
  suggestedRoute: RouteOption | null;   // null = hold / no alternative modelled
  delta: RouteDelta | null;             // null when there is nothing to switch to
  hasAlternatives: boolean;
  signalIds: string[];
  signals: Signal[];
}

export interface Anomaly {
  corridor: string;
  chokepoints: string[];
  peakSeverity: Severity;
  signalCount: number;
  distinctSources: number;
  signals: Signal[];
}

export interface ImpactAssessment {
  anomaly: Anomaly | null;          // null = quiet feed, nothing escalated
  escalated: boolean;
  reasoning: Reasoning;
  affected: AffectedVoyage[];
}

/* ────────────────────────────────────────────────────────────────────────
 * Vessels & voyages
 * ──────────────────────────────────────────────────────────────────────── */

export interface Vessel {
  id: string;                       // "VSL-001"
  name: string;                     // "MV OceanMind Harmony"
  imo: string;                      // IMO number
  type: string;                     // "Container", "Bulk Carrier", "LNG Carrier"…
  capacity: string;                 // "14,000 TEU", "82,000 DWT"…
  flag: string;                     // flag state
  builtYear: number;
  fuelTypes: string[];              // ["VLSFO", "MGO"] — usable bunker grades
}

export type VoyageStatus =
  | 'underway'
  | 'at_anchor'
  | 'in_port'
  | 'rerouted'
  | 'delayed'
  | 'completed';

/** One candidate routing for a voyage (e.g. Suez vs Cape of Good Hope). */
export interface RouteOption {
  id: string;                       // "RT-0007-A"
  label: string;                    // "Option A — Suez Canal (baseline)"
  /** Ordered polyline as [lon, lat] pairs — maplibre/deck-friendly. */
  waypoints: [number, number][];
  distanceNm: number;               // total nautical miles
  etaDays: number;                  // door-to-door transit days at planned speed
  fuelTonnes: number;               // projected fuel burn
  fuelUsd: number;                  // projected fuel cost, USD
  co2Tonnes: number;                // projected CO₂ (IMO factors)
  riskScore: number;                // 0–100 composite (security+congestion+weather)
  viaChokepoints: string[];         // chokepoints transited
  notes?: string;                   // human-readable caveat
  recommended?: boolean;            // flagged by the Decision Agent
}

export interface PortCall {
  port: string;                     // "Singapore"
  lat: number;
  lon: number;
  purpose: 'load' | 'discharge' | 'bunker' | 'transit' | 'canal';
  etaISO: string;                   // planned arrival
  congestionHours?: number;         // current avg waiting time at this port
}

export interface Voyage {
  id: string;                       // "VYG-2026-0007"
  vessel: Vessel;
  originPort: string;
  originLat: number;
  originLon: number;
  destinationPort: string;
  destinationLat: number;
  destinationLon: number;
  departedAt: string;               // ISO 8601
  etaOriginal: string;              // ISO 8601 — plan of record at departure
  etaCurrent: string;               // ISO 8601 — live estimate
  progressPct: number;              // 0–100 along active route
  currentLat: number;               // live AIS position
  currentLon: number;
  status: VoyageStatus;
  cargo: string;                    // "11,900 TEU mixed — electronics, apparel"
  routeOptions: RouteOption[];      // candidate routings; active one flagged
  activeRouteId: string;            // which RouteOption is being sailed
  portCalls: PortCall[];            // scheduled calls incl. bunker stops
  fuelPlan: {
    fuelType: string;               // "VLSFO"
    plannedTonnes: number;
    consumedTonnes: number;
    bunkerPort: string;             // next planned bunkering port
    supplierId: string | null;      // planned bunker supplier
  };
  co2ToDateTonnes: number;          // emitted so far this voyage
  decisionIds: string[];            // decisions raised against this voyage
  charterer: string;
}

/** A clustered disruption event derived from many correlated signals. */
export interface Disruption {
  id: string;                       // "DSR-001"
  title: string;                    // "Red Sea / Bab el-Mandeb security escalation"
  description: string;
  severity: Severity;
  region: string;                   // "Red Sea"
  chokepoint?: string;
  signalIds: string[];              // contributing signals
  affectedVoyageIds: string[];
  startedAt: string;
  status: 'active' | 'monitoring' | 'resolved';
}

/* ────────────────────────────────────────────────────────────────────────
 * Multi-agent pipeline — Detect → Explain → Simulate → Recommend → Approve
 * ──────────────────────────────────────────────────────────────────────── */

export type AgentId =
  | 'disruption'                    // Disruption Intelligence Agent
  | 'causal'                        // Causal Impact Agent
  | 'simulation'                    // Scenario Simulation Agent
  | 'decision'                      // Decision Agent
  | 'tools'                         // Deterministic Tools (carbon calc, voyage calc)
  | 'human';                        // Human Approval (Voyage Operations Manager)

export type PipelineStage =
  | 'detect'
  | 'explain'
  | 'simulate'
  | 'recommend'
  | 'approve';

export type AgentEventKind =
  | 'observation'                   // agent notes a fact from data
  | 'analysis'                      // agent reasoning step
  | 'tool_call'                     // deterministic tool invoked
  | 'tool_result'                   // tool returned numbers
  | 'handoff'                       // control passes to next agent
  | 'recommendation'                // decision emitted
  | 'gate';                         // reliability / approval gate event

/** One line of the scripted / streamed agent timeline. */
export interface AgentEvent {
  id: string;                       // "EVT-001"
  ts: string;                       // ISO 8601 timestamp
  agent: AgentId;
  stage: PipelineStage;
  kind: AgentEventKind;
  title: string;                    // short bold line, e.g. "Clustered 9 signals"
  detail: string;                   // full narration / reasoning text
  dataRefs: string[];               // ids referenced: signals, voyages, decisions…
}

export interface PipelineRun {
  id: string;                       // "RUN-2026-0042"
  decisionId: string;               // decision produced by this run
  voyageId: string;
  startedAt: string;
  finishedAt: string | null;
  status: 'running' | 'complete' | 'failed';
  events: AgentEvent[];             // full ordered timeline
}

/* ────────────────────────────────────────────────────────────────────────
 * Causal graph — root-cause DAG (event → chokepoint → route → voyage)
 * ──────────────────────────────────────────────────────────────────────── */

export type CausalNodeKind =
  | 'event'                         // external disruption trigger
  | 'chokepoint'
  | 'port'
  | 'route'
  | 'voyage'
  | 'impact';                       // terminal quantified impact

export interface CausalNode {
  id: string;                       // "CN-01"
  label: string;                    // "Bab el-Mandeb escalation"
  kind: CausalNodeKind;
  detail: string;                   // hover/expanded explanation
  severity: Severity;
  refId?: string;                   // link into signals/voyages/decisions
}

export interface CausalEdge {
  id: string;                       // "CE-01"
  source: string;                   // CausalNode id
  target: string;                   // CausalNode id
  label: string;                    // "forces reroute via"
  confidence: number;               // 0–1 causal confidence
}

/* ────────────────────────────────────────────────────────────────────────
 * Decisions — explainable recommendations with evidence + approval
 * ──────────────────────────────────────────────────────────────────────── */

/** Quantified deltas vs the voyage's plan of record. Negative = savings. */
export interface ImpactDelta {
  etaHours: number;                 // +180 = 7.5 days later
  fuelUsd: number;                  // +182_000
  fuelTonnes: number;
  co2Tonnes: number;
  co2Pct: number;                   // % vs baseline plan (e.g. +5.9)
  euEtsUsd: number;                 // change in EU ETS liability, USD
  riskScore: number;                // resulting composite risk 0–100 (lower = safer)
}

export type ReliabilityStatus =
  | 'READY'                         // evidence complete — safe to approve
  | 'REVIEW'                        // human review advised
  | 'ESCALATE'                      // conflicting evidence — escalate
  | 'INSUFFICIENT_EVIDENCE';        // do not act on this yet

export interface EvidenceItem {
  id: string;                       // "EVD-001"
  label: string;                    // "9 corroborated security signals"
  kind: 'signal' | 'calculation' | 'regulation' | 'market' | 'historical';
  detail: string;                   // what this evidence establishes
  sourceRef: string;                // signal id / tool name / regulation citation
  confidence: number;               // 0–1
}

export interface ApprovalRecord {
  approvedBy: string;               // "Voyage Operations Manager"
  approverEmail: string;
  action: 'approved' | 'overridden';
  comment: string;
  at: string;                       // ISO 8601
}

/** An alternative the Decision Agent considered and rejected. */
export interface Alternative {
  id: string;                       // "ALT-0042-A"
  label: string;                    // "Continue via Suez with armed escort"
  summary: string;
  impact: ImpactDelta;
  rejectionReason: string;          // why the agent did NOT recommend this
}

export interface Decision {
  id: string;                       // "DEC-0042"
  voyageId: string;
  disruptionId: string;
  createdAt: string;
  title: string;                    // "Reroute VYG-2026-0007 via Cape of Good Hope"
  recommendation: {
    headline: string;               // one-line recommended course of action
    actions: string[];              // ordered concrete steps
  };
  rationale: string;                // narrative explanation of WHY
  alternatives: Alternative[];      // considered-and-rejected options
  impact: ImpactDelta;              // deltas of the recommended option
  evidence: EvidenceItem[];
  reliability: ReliabilityStatus;
  reliabilityNote: string;          // gate explanation, e.g. "evidence complete"
  approval: ApprovalRecord | null;  // null = pending human sign-off
  agentTrace: {
    pipelineRunId: string;          // link to PipelineRun timeline
  };
  status: 'pending' | 'approved' | 'overridden' | 'expired';
  severity: Severity;
}

/* ────────────────────────────────────────────────────────────────────────
 * Suppliers — bunker "Supplier DNA" scoring
 * ──────────────────────────────────────────────────────────────────────── */

export interface Supplier {
  id: string;                       // "SUP-001"
  name: string;                     // "Straits Marine Energy"
  port: string;                     // home port
  lat: number;
  lon: number;
  fuelsOffered: string[];           // ["VLSFO", "MGO", "B24 biofuel"]
  /** Supplier DNA scores, 0–100. */
  reliability: number;              // on-spec on-time delivery record
  fuelQuality: number;              // lab-test conformance history
  esgScore: number;                 // emissions transparency + labour + governance
  altFuelReadiness: number;         // biofuel/methanol/LNG capability
  priceCompetitiveness: number;     // vs port benchmark
  incidents: {
    date: string;
    summary: string;
    severity: Severity;
  }[];
  certifications: string[];         // ["ISCC EU", "MPA licensed"]
  yearsActive: number;
  deliveriesYtd: number;
}

/* ────────────────────────────────────────────────────────────────────────
 * ESG / carbon summary & compliance reporting
 * ──────────────────────────────────────────────────────────────────────── */

export interface EsgSummary {
  asOf: string;                     // ISO 8601
  fleetCo2YtdTonnes: number;        // emitted year-to-date across fleet
  co2SavedVsBaselineTonnes: number; // avoided vs no-optimisation baseline
  co2SavedPct: number;
  euEtsExposureUsd: number;         // current-year projected ETS liability
  euEtsPhaseInPct: number;          // 2026 = 70 (% of emissions surrendered)
  euEtsAllowancePriceEur: number;   // €/tCO₂e used in projections
  fuelEu: {
    ghgIntensity: number;           // gCO₂e/MJ fleet average
    limit: number;                  // 2025–29 limit (89.34 gCO₂e/MJ)
    compliant: boolean;
    surplusDeficitPct: number;      // negative = under limit (good)
  };
  imoCii: {
    fleetRating: 'A' | 'B' | 'C' | 'D' | 'E';
    trend: 'improving' | 'stable' | 'degrading';
  };
  monthlyCo2: { month: string; actual: number; baseline: number }[];
  /** SDG alignment mapping for Track 6 storytelling. */
  sdgAlignment: {
    sdg: number;                    // 7 | 9 | 13 | 14
    title: string;                  // "Affordable & Clean Energy"
    contribution: string;           // how OceanMind advances it
    metric: string;                 // quantified proof point
  }[];
}

export interface ComplianceReport {
  id: string;                       // "RPT-2026-014"
  title: string;
  type: 'EU_ETS' | 'FUELEU' | 'IMO_DCS' | 'DECISION_AUDIT' | 'ESG_QUARTERLY';
  period: string;                   // "Q2 2026"
  generatedAt: string;
  status: 'final' | 'draft' | 'submitted';
  summary: string;
  decisionIds: string[];            // decisions evidenced by this report
  voyageIds: string[];
  sizeKb: number;
  preparedBy: string;               // "OceanMind Decision Engine v2.4"
}
