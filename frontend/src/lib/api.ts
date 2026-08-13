/**
 * OceanMind API layer.
 *
 * Every function tries the FastAPI backend at http://localhost:8000/api/*
 * with a short timeout, then falls back to the local mock dataset so the
 * frontend demos perfectly with no backend running.
 *
 * Mutations (approve/override) are applied to a module-level copy of the
 * decisions so UI state persists for the session even in mock mode.
 */

import type {
  Signal,
  Voyage,
  Decision,
  ApprovalRecord,
  Supplier,
  EsgSummary,
  ComplianceReport,
  PipelineRun,
  AgentEvent,
  ImpactAssessment,
  AffectedVoyage,
  Urgency,
} from '../data/types';
import {
  mockSignals,
  mockVoyages,
  mockDecisions,
  mockSuppliers,
  mockEsgSummary,
  mockReports,
  mockPipelineRun,
} from '../data/mock';

/**
 * Backend origin. Overridable because port 8000 is a crowded default — any
 * other uvicorn app on the machine can take it first, and then this points at
 * a stranger's API that 404s every route. Set VITE_API_BASE in .env.local to
 * match whatever port the backend actually bound.
 */
const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:8000/api';

/**
 * Ceiling for a backend round-trip before we fall back to mock data.
 *
 * Not a "how fast is the network" budget — a dead backend refuses the
 * connection in about a millisecond, so the offline demo path never waits for
 * this regardless of its value. What it must survive is a LIVE backend
 * answering while the main thread is busy: /globe fires this fetch alongside
 * two GeoJSON loads and WebGL init, and the abort timer is queued behind all
 * of it. At 1500ms the globe silently fell back to the 40 mock signals while
 * the API was returning 219 live ones in 600ms.
 */
const FETCH_TIMEOUT_MS = 8000;

/**
 * Only attempt the local FastAPI backend when the app itself is served from
 * localhost (dev). On hosted deployments (Vercel) requests to localhost would
 * be mixed-content/blocked, so we go straight to the mock dataset.
 */
const BACKEND_ENABLED =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);

/** fetch with a hard timeout; throws on non-2xx or timeout. */
async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BACKEND_ENABLED) throw new Error('backend disabled on hosted deployment');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`API ${path} → HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/* ── Session-local mutable copy of decisions (mock mode persistence) ──── */

const localDecisions: Decision[] = mockDecisions.map((d) => ({ ...d }));

/* ── Signals ──────────────────────────────────────────────────────────── */

export async function getSignals(): Promise<Signal[]> {
  try {
    return await fetchJson<Signal[]>('/signals');
  } catch {
    return mockSignals;
  }
}

/* ── Voyages ──────────────────────────────────────────────────────────── */

export async function getVoyages(): Promise<Voyage[]> {
  try {
    return await fetchJson<Voyage[]>('/voyages');
  } catch {
    return mockVoyages;
  }
}

export async function getVoyage(id: string): Promise<Voyage | undefined> {
  try {
    return await fetchJson<Voyage>(`/voyages/${id}`);
  } catch {
    return mockVoyages.find((v) => v.id === id);
  }
}

/* ── Decisions ────────────────────────────────────────────────────────── */

export async function getDecisions(): Promise<Decision[]> {
  try {
    return await fetchJson<Decision[]>('/decisions');
  } catch {
    return localDecisions;
  }
}

export async function getDecision(id: string): Promise<Decision | undefined> {
  try {
    return await fetchJson<Decision>(`/decisions/${id}`);
  } catch {
    return localDecisions.find((d) => d.id === id);
  }
}

function applyLocalApproval(
  id: string,
  action: 'approved' | 'overridden',
  comment: string,
): Decision | undefined {
  const idx = localDecisions.findIndex((d) => d.id === id);
  if (idx === -1) return undefined;
  const record: ApprovalRecord = {
    approvedBy: 'Voyage Operations Manager',
    approverEmail: 'ops@oceanmind.ai',
    action,
    comment,
    at: new Date().toISOString(),
  };
  // Return a NEW object (never mutate in place): callers hold the previous
  // reference in React state, and an Object.is-identical value would make
  // setState bail out without re-rendering.
  const next: Decision = { ...localDecisions[idx], approval: record, status: action };
  localDecisions[idx] = next;
  return next;
}

/** Approve a decision. Returns the updated decision. */
export async function approveDecision(
  id: string,
  comment = 'Approved via OceanMind console.',
): Promise<Decision | undefined> {
  try {
    return await fetchJson<Decision>(`/decisions/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  } catch {
    return applyLocalApproval(id, 'approved', comment);
  }
}

/** Override (reject) a decision with a mandatory reason. */
export async function overrideDecision(
  id: string,
  reason: string,
): Promise<Decision | undefined> {
  try {
    return await fetchJson<Decision>(`/decisions/${id}/override`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  } catch {
    return applyLocalApproval(id, 'overridden', reason);
  }
}

/* ── Event-driven impact assessment ───────────────────────────────────── */

/**
 * Which voyages the current news actually threatens, and what to do.
 *
 * The offline fallback derives an assessment from the mock dataset rather
 * than shipping a second hand-written narrative — same code path, so the
 * demo can't drift from what the backend would say.
 */
export async function getImpact(): Promise<ImpactAssessment> {
  try {
    return await fetchJson<ImpactAssessment>('/impact');
  } catch {
    return mockImpact();
  }
}

/** Rule-only assessment over the mock dataset. Mirrors agents/impact.py's
 *  fallback tier: pick the loudest corridor, expose the voyages that transit
 *  it, recommend the lowest-risk alternative. `reasoning: 'rules'` says so. */
function mockImpact(): ImpactAssessment {
  const loud = mockSignals.filter(
    (s) =>
      (s.severity === 'critical' || s.severity === 'high') &&
      s.corroboration >= 2 &&
      s.affectedVoyageIds.length > 0 &&
      s.affectedChokepoint,
  );
  if (loud.length < 2) {
    return { anomaly: null, escalated: false, reasoning: 'rules', affected: [] };
  }

  const peak =
    loud.find((s) => s.severity === 'critical') ?? loud[0];
  const cluster = loud.filter((s) => s.affectedChokepoint === peak.affectedChokepoint);
  const exposedIds = [...new Set(cluster.flatMap((s) => s.affectedVoyageIds))];

  const affected: AffectedVoyage[] = exposedIds.flatMap((id) => {
    const v = mockVoyages.find((x) => x.id === id);
    if (!v) return [];
    const active = v.routeOptions.find((r) => r.id === v.activeRouteId) ?? null;
    const alts = v.routeOptions.filter((r) => r.id !== v.activeRouteId);
    const best = alts.length
      ? alts.reduce((a, b) => (b.riskScore < a.riskScore ? b : a))
      : null;
    const sigs = cluster.filter((s) => s.affectedVoyageIds.includes(id));
    return [
      {
        voyageId: v.id,
        vesselName: v.vessel.name,
        vesselType: v.vessel.type,
        cargo: v.cargo,
        originPort: v.originPort,
        destinationPort: v.destinationPort,
        currentLat: v.currentLat,
        currentLon: v.currentLon,
        progressPct: v.progressPct,
        status: v.status,
        why: `Route transits ${peak.affectedChokepoint}, where ${cluster.length} corroborated signals are active.`,
        urgency: peak.severity === 'critical' ? 'immediate' : 'monitor',
        rationale: best
          ? `${best.label} carries the lowest modelled risk score of the available alternatives.`
          : 'No alternative route is modelled for this voyage — the options here are speed, timing or escort, not diversion.',
        reasoning: 'rules',
        currentRoute: active,
        suggestedRoute: best,
        delta:
          active && best
            ? {
                etaDays: +(best.etaDays - active.etaDays).toFixed(1),
                distanceNm: Math.round(best.distanceNm - active.distanceNm),
                fuelTonnes: +(best.fuelTonnes - active.fuelTonnes).toFixed(1),
                fuelUsd: Math.round(best.fuelUsd - active.fuelUsd),
                co2Tonnes: +(best.co2Tonnes - active.co2Tonnes).toFixed(1),
                co2Pct: +(
                  (100 * (best.co2Tonnes - active.co2Tonnes)) /
                  active.co2Tonnes
                ).toFixed(1),
                riskScore: best.riskScore - active.riskScore,
              }
            : null,
        hasAlternatives: alts.length > 0,
        signalIds: sigs.map((s) => s.id),
        signals: sigs.slice(0, 4),
      },
    ];
  });

  const order: Record<Urgency, number> = { immediate: 0, monitor: 1, informational: 2 };
  affected.sort((a, b) => order[a.urgency] - order[b.urgency]);

  return {
    anomaly: {
      corridor: peak.affectedChokepoint ?? 'unknown',
      chokepoints: [...new Set(cluster.map((s) => s.affectedChokepoint!))],
      peakSeverity: peak.severity,
      signalCount: cluster.length,
      distinctSources: new Set(cluster.map((s) => s.source)).size,
      signals: cluster.slice(0, 6),
    },
    escalated: false,
    reasoning: 'rules',
    affected,
  };
}

/* ── Suppliers / ESG / Reports ────────────────────────────────────────── */

export async function getSuppliers(): Promise<Supplier[]> {
  try {
    return await fetchJson<Supplier[]>('/suppliers');
  } catch {
    return mockSuppliers;
  }
}

export async function getEsgSummary(): Promise<EsgSummary> {
  try {
    return await fetchJson<EsgSummary>('/esg/summary');
  } catch {
    return mockEsgSummary;
  }
}

export async function getReports(): Promise<ComplianceReport[]> {
  try {
    return await fetchJson<ComplianceReport[]>('/reports');
  } catch {
    return mockReports;
  }
}

/* ── Pipeline ─────────────────────────────────────────────────────────── */

/** Kick off a pipeline run (backend) or return the scripted run (mock). */
export async function runPipeline(): Promise<PipelineRun> {
  try {
    return await fetchJson<PipelineRun>('/pipeline/run', { method: 'POST' });
  } catch {
    return mockPipelineRun;
  }
}

export interface StreamPipelineOptions {
  /** Delay between replayed events in mock mode (default 600 ms). */
  paceMs?: number;
  /** Called once when the stream finishes (either mode). */
  onDone?: () => void;
  /** Called with the run metadata before the first event (mock mode). */
  onRun?: (run: PipelineRun) => void;
}

export interface StreamHandle {
  /** Stop the stream / cancel remaining scheduled events. */
  stop: () => void;
}

/**
 * Stream pipeline AgentEvents.
 *
 * Tries SSE at GET /api/pipeline/stream first; if the EventSource errors
 * before delivering any event, falls back to replaying the scripted
 * mockPipelineRun.events with setTimeout pacing so the orchestration page
 * always has a live show to run.
 */
export function streamPipeline(
  onEvent: (event: AgentEvent) => void,
  opts: StreamPipelineOptions = {},
): StreamHandle {
  const paceMs = opts.paceMs ?? 600;
  let stopped = false;
  let timers: ReturnType<typeof setTimeout>[] = [];
  let source: EventSource | null = null;

  const stop = () => {
    stopped = true;
    timers.forEach(clearTimeout);
    timers = [];
    if (source) {
      source.close();
      source = null;
    }
  };

  /** Replay scripted events starting at `fromIndex`; fires onDone at the end. */
  const replayScripted = (fromIndex: number) => {
    if (stopped) return;
    const remaining = mockPipelineRun.events.slice(fromIndex);
    if (remaining.length === 0) {
      opts.onDone?.();
      return;
    }
    remaining.forEach((event, i) => {
      timers.push(
        setTimeout(() => {
          if (stopped) return;
          onEvent(event);
          if (i === remaining.length - 1) opts.onDone?.();
        }, paceMs * (i + 1)),
      );
    });
  };

  const replayMock = () => {
    if (stopped) return;
    opts.onRun?.(mockPipelineRun);
    replayScripted(0);
  };

  if (!BACKEND_ENABLED) {
    replayMock();
    return { stop };
  }

  try {
    let receivedCount = 0;
    let lastEventId: string | null = null;
    source = new EventSource(`${API_BASE}/pipeline/stream`);
    source.onmessage = (msg) => {
      receivedCount += 1;
      try {
        const data = JSON.parse(msg.data);
        if (data?.done) {
          stop();
          opts.onDone?.();
          return;
        }
        const event = data as AgentEvent;
        if (typeof event?.id === 'string') lastEventId = event.id;
        onEvent(event);
      } catch {
        /* ignore malformed frames */
      }
    };
    source.onerror = () => {
      // EventSource errors fire both when there is no backend at all AND on
      // transient drops / a backend dying mid-run. Never treat a drop as a
      // clean finish — finish the show from the scripted timeline instead.
      const delivered = receivedCount;
      const lastId = lastEventId;
      source?.close();
      source = null;
      if (stopped) return;
      if (delivered === 0) {
        // No backend → full scripted replay.
        replayMock();
        return;
      }
      // Stream dropped mid-run → resume the scripted remainder, matching by
      // the last delivered event id (falling back to a count heuristic).
      const byId = lastId
        ? mockPipelineRun.events.findIndex((e) => e.id === lastId)
        : -1;
      const resumeFrom =
        byId >= 0 ? byId + 1 : Math.min(delivered, mockPipelineRun.events.length);
      replayScripted(resumeFrom);
    };
  } catch {
    replayMock();
  }

  return { stop };
}
