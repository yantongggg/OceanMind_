# 🌊 OceanMind — AI Decision Intelligence for Sustainable Maritime Operations

OceanMind is a **causal multi-agent voyage intelligence platform** that turns fragmented disruption signals into explainable, carbon-aware routing decisions with full audit trail and human approval.

## The Problem

Global shipping moves ~90% of world trade but emits ~3% of global CO₂. When a chokepoint destabilizes (Red Sea, Suez, Strait of Hormuz), operators make million-dollar routing decisions **by instinct** with **hidden carbon cost**.

## The Solution

**Six-stage AI pipeline** with human oversight:

1. **Detect** → Cluster disruption signals from news, security, port data
2. **Explain** → Build causal root-cause graph (event → route → voyage → cost)
3. **Simulate** → Enumerate feasible actions, price with deterministic tools
4. **Recommend** → Apply hard constraints, rank by carbon + cost + risk
5. **Approve** → Human operator reviews and signs off
6. **Report** → Audit-ready ESG evidence pack

## The Golden Scenario

**Red Sea security escalation** affecting MV OceanMind Harmony (Port Klang → Rotterdam)

**Recommendation:** Cape of Good Hope + slow-steam 2 segments + shift bunkering

**Result:**
- ⏱️ ETA +7.5 days | 💰 Fuel +USD 182k | ⚠️ War-risk avoided ≈USD 400k
- 🌍 CO₂ penalty: +11.8% raw → **+5.9% after slow-steaming** | ✅ EU ETS & FuelEU compliant

---

## Quick Start

**Frontend Only** (standalone with mock data):

```bash
cd frontend
npm install
npm run dev          # → http://localhost:5173
```

**With Backend** (live agent runs + real data):

```bash
# Terminal 1: Frontend
cd frontend && npm run dev

# Terminal 2: Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 8000
```

The frontend auto-falls back to mock data if the backend is offline.

## Key Features

| Feature | Purpose |
|---------|---------|
| **AI-Driven Analysis** | Signals → events → causal graph → ranked scenarios |
| **Deterministic Pricing** | Voyage physics, carbon factors, regulatory checks—never hallucinated |
| **Human Approval** | Every decision requires explicit human sign-off |
| **Audit Trail** | Complete record of signals, analysis, calculations, decisions |
| **ESG Compliance** | Carbon tracking, EU ETS/FuelEU verification, evidence reports |
| **Real-Time Dashboard** | Intelligence globe, agent orchestration, decision tracking |

## Security

- ✅ Secret detection (pre-commit hooks)
- ✅ Static code analysis (SAST)
- ✅ API rate limiting (120 req/min per IP)
- ✅ Request validation (content checks, XSS/SQLi patterns)
- ✅ Audit logging (all approvals, overrides, timestamps)
- ✅ Security headers (CSP, HSTS, X-Content-Type-Options)

---

**Built for maritime decarbonization and operational resilience.**
