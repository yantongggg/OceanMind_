# OceanMind Backend — FastAPI Multi-Agent Decision Engine

Causal multi-agent voyage intelligence: **Detect → Explain → Simulate → Recommend → Approve**.
Serves the OceanMind frontend at `http://localhost:8000/api/*` with camelCase JSON that
mirrors `frontend/src/data/types.ts` exactly (pydantic `to_camel` aliases).

## Setup

```bash
cd backend
python3 -m venv .venv            # Python 3.11+ (3.12 recommended)
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 8000
```

Interactive docs: http://localhost:8000/docs

> The frontend works with **no backend running** (mock fallback in `src/lib/api.ts`);
> starting this server upgrades it to live data + a real agent pipeline transparently.

## Demo mode (recommended)

The demo runs entirely on golden (replayed) data with deterministic tool calculations.
No external API keys or connectivity required. All numbers come from the deterministic tools,
never from generated content. Template narratives are used throughout — the system never
depends on external services.

## Layout

```
backend/
├── main.py               FastAPI app (CORS *, /api/health, mounts routers)
├── models.py             pydantic models mirroring frontend/src/data/types.ts
├── data/
│   ├── golden.json       golden dataset (extracted 1:1 from frontend mock.ts)
│   └── seed.py           validated in-memory store (signals, voyages, decisions…)
├── agents/
│   ├── disruption.py     Disruption Intelligence — corridor-aware signal clustering
│   ├── causal.py         Causal Impact — networkx root-cause DAG + risk decomposition
│   ├── simulation.py     Scenario Simulation — feasible actions × deterministic tools
│   ├── decision.py       Decision — hard constraints, carbon-aware ranking, gate
│   ├── pipeline.py       orchestrator → AgentEvent timeline + golden consistency gate
│   └── llm.py            optional Claude narration (graceful fallback)
├── tools/
│   ├── carbon.py         IMO CO₂ factors (HFO 3.114 / VLSFO 3.151 / MGO 3.206 tCO₂/t),
│   │                     EU ETS phase-in 40/70/100% @ €72/tCO₂e, FuelEU 89.34 gCO₂e/MJ
│   ├── voyage_calc.py    haversine distance, ETA, speed-cube slow-steaming fuel model
│   └── reliability.py    evidence gate → READY / REVIEW / ESCALATE / INSUFFICIENT_EVIDENCE
└── api/routes.py         REST + SSE endpoints
```

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | liveness |
| GET | `/api/signals` | 40 captured intelligence signals |
| GET | `/api/voyages` · `/api/voyages/{id}` | fleet & voyage detail |
| GET | `/api/disruptions` | clustered disruption events |
| GET | `/api/decisions` · `/api/decisions/{id}` | decision queue / detail |
| POST | `/api/decisions/{id}/approve` | body `{comment}` → approval record |
| POST | `/api/decisions/{id}/override` | body `{reason}` → override record |
| GET | `/api/suppliers` | Supplier-DNA scored bunker suppliers |
| GET | `/api/esg/summary` | fleet carbon / EU ETS / FuelEU / CII / SDG |
| GET | `/api/reports` | compliance & evidence reports |
| GET | `/api/causal-graph` | golden root-cause DAG |
| POST | `/api/pipeline/run` | run the real agent chain → stored `PipelineRun` |
| GET | `/api/pipeline/runs/{id}` | fetch a stored run |
| GET | `/api/pipeline/stream` | SSE `AgentEvent` stream (~0.5 s pace, `{"done":true}` end) |

## The consistency gate

Every pipeline run recomputes the golden scenario from first principles
(haversine distances, speed-cube slow-steaming, IMO carbon factors, EU ETS
phase-in) and **asserts** the result matches decision `DEC-0042` exactly:

- ETA **+7.5 days** (+180 h) · fuel **+USD 182k** (+168 t)
- war-risk premium avoided **≈ USD 400k**
- CO₂ **+11.8% raw → +5.9%** after slow-steaming (+530 t)
- EU ETS delta **+USD 18.7k** · FuelEU **87.1 gCO₂e/MJ → PASS**

If the engine ever drifts from the golden numbers, `POST /api/pipeline/run` fails
loudly instead of demoing silently-wrong figures.

## Quick verification

```bash
curl -s localhost:8000/api/decisions | python3 -m json.tool | head
curl -s -X POST localhost:8000/api/pipeline/run | python3 -c 'import json,sys; r=json.load(sys.stdin); print(r["id"], len(r["events"]), "events")'
curl -N localhost:8000/api/pipeline/stream | head -5
```
