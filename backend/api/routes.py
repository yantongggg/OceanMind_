"""
OceanMind API routes.

All responses use camelCase JSON matching the frontend contract in
frontend/src/data/types.ts (see backend/models.py). Mounted under /api.
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from agents import impact
from agents.pipeline import run_pipeline
from data.seed import GOLDEN_DECISION_ID, STORE
from ingest import service as ingest_service
from models import ApprovalRecord

router = APIRouter()

STREAM_PACE_S = 0.5  # ~0.5 s between streamed AgentEvents


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ── Signals / voyages ────────────────────────────────────────────────────


@router.get("/signals")
def get_signals():
    """The full intelligence picture — every ingested signal, all corridors.

    Not the pipeline's scoped subset: the globe and the feed should show a
    Hormuz blockade even though SimulationAgent cannot price a reroute for it.
    Each signal carries its own `origin`, so the client never has to guess
    whether it is looking at reporting or curated demo data.
    """
    return [s.dump() for s in ingest_service.display_signals()]


@router.get("/voyages")
def get_voyages():
    return [v.dump() for v in STORE.voyages.values()]


@router.get("/voyages/{voyage_id}")
def get_voyage(voyage_id: str):
    voyage = STORE.voyage(voyage_id)
    if not voyage:
        raise HTTPException(status_code=404, detail=f"voyage {voyage_id} not found")
    return voyage.dump()


@router.get("/disruptions")
def get_disruptions():
    return [d.dump() for d in STORE.disruptions.values()]


# ── Decisions & approvals ────────────────────────────────────────────────


@router.get("/decisions")
def get_decisions():
    return [d.dump() for d in STORE.decisions.values()]


@router.get("/decisions/{decision_id}")
def get_decision(decision_id: str):
    decision = STORE.decision(decision_id)
    if not decision:
        raise HTTPException(status_code=404, detail=f"decision {decision_id} not found")
    return decision.dump()


class ApproveBody(BaseModel):
    comment: str = "Approved via OceanMind console."
    approved_by: str = "Voyage Operations Manager"
    approver_email: str = "ops@oceanmind.ai"

    model_config = {"populate_by_name": True, "extra": "ignore"}


class OverrideBody(BaseModel):
    reason: str
    approved_by: str = "Voyage Operations Manager"
    approver_email: str = "ops@oceanmind.ai"

    model_config = {"populate_by_name": True, "extra": "ignore"}


def _apply_signoff(decision_id: str, action: str, comment: str, by: str, email: str):
    decision = STORE.decision(decision_id)
    if not decision:
        raise HTTPException(status_code=404, detail=f"decision {decision_id} not found")
    decision.approval = ApprovalRecord(
        approved_by=by,
        approver_email=email,
        action=action,  # type: ignore[arg-type]
        comment=comment,
        at=_now_iso(),
    )
    decision.status = action  # type: ignore[assignment]
    return decision


@router.post("/decisions/{decision_id}/approve")
def approve_decision(decision_id: str, body: Optional[ApproveBody] = None):
    body = body or ApproveBody()
    decision = _apply_signoff(
        decision_id, "approved", body.comment, body.approved_by, body.approver_email
    )
    # Approving the golden decision finalises its audit evidence report.
    if decision_id == GOLDEN_DECISION_ID and "RPT-2026-016" in STORE.reports:
        STORE.reports["RPT-2026-016"].status = "final"
    return decision.dump()


@router.post("/decisions/{decision_id}/override")
def override_decision(decision_id: str, body: OverrideBody):
    decision = _apply_signoff(
        decision_id, "overridden", body.reason, body.approved_by, body.approver_email
    )
    return decision.dump()


# ── Suppliers / ESG / reports ────────────────────────────────────────────


@router.get("/suppliers")
def get_suppliers():
    return [s.dump() for s in STORE.suppliers]


@router.get("/esg/summary")
def get_esg_summary():
    return STORE.esg_summary.dump()


@router.get("/reports")
def get_reports():
    return [r.dump() for r in STORE.reports.values()]


@router.get("/causal-graph")
def get_causal_graph():
    return STORE.causal_graph.dump()


# ── Pipeline: run + SSE stream ───────────────────────────────────────────


@router.post("/pipeline/run")
def post_pipeline_run():
    """Execute the real agent chain and store the run.

    Reasons over live signals when INGEST_MODE=live and they can sustain a
    cluster; falls back to the curated dataset otherwise.
    """
    run = run_pipeline(STORE, signals=ingest_service.active_signals())
    return run.dump()


# ── Event-driven impact assessment ───────────────────────────────────────


@router.get("/impact")
def get_impact():
    """Which voyages does the current news actually threaten, and what to do.

    Two tiers: deterministic rules scan every sweep for free and answer
    `anomaly: null` on a quiet feed; only a real cluster escalates to Claude
    for judgement. `reasoning` reports which tier produced the answer.

    Every number here (ETA, fuel, USD, CO2 deltas) is arithmetic over
    tool-computed RouteOption fields — the model chooses a route and explains
    it, it never states a figure.

    Served from cache: escalation takes 20-60s and the client falls back to
    offline mock data after 8. Staleness is bounded and refreshed off the
    request path.
    """
    return impact.cached_assess(
        ingest_service.display_signals(), list(STORE.voyages.values())
    )


# ── Live ingestion ───────────────────────────────────────────────────────


@router.get("/ingest/status")
def get_ingest_status():
    """What the ingestion layer is actually doing.

    Deliberately blunt: `servingGolden: true` while in live mode means the
    pipeline is running on curated data because live signals could not sustain
    a cluster. `sourceErrors` distinguishes a broken source from a quiet one —
    an empty feed is never reported as calm seas.
    """
    return ingest_service.status()


@router.post("/ingest/refresh")
def post_ingest_refresh():
    """Force one ingestion sweep now, synchronously. Takes ~30-60 s."""
    if not ingest_service.live_mode():
        raise HTTPException(
            status_code=409,
            detail="INGEST_MODE is not 'live' — set it in backend/.env to ingest",
        )
    result = ingest_service.get_engine().refresh()
    return {"ok": True, "result": result, "status": ingest_service.status()}


@router.get("/pipeline/runs/{run_id}")
def get_pipeline_run(run_id: str):
    run = STORE.pipeline_runs.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"pipeline run {run_id} not found")
    return run.dump()


@router.get("/pipeline/stream")
async def stream_pipeline():
    """SSE stream of AgentEvents, regenerated live via the agent chain.

    Frames are default `message` events (the frontend uses EventSource
    `onmessage`), paced ~0.5 s apart, terminated by `{"done": true}`.
    """
    # Run the (synchronous, CPU-light) agent chain off the event loop.
    signals = await asyncio.to_thread(ingest_service.active_signals)
    run = await asyncio.to_thread(run_pipeline, STORE, signals)

    async def event_source():
        for event in run.events:
            yield {"data": json.dumps(event.dump())}
            await asyncio.sleep(STREAM_PACE_S)
        yield {"data": json.dumps({"done": True, "runId": run.id})}

    return EventSourceResponse(event_source())
