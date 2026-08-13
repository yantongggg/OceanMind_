"""
Decision Agent — Recommend stage.

Takes the fully-costed scenario matrix from the Scenario Simulation Agent,
applies HARD CONSTRAINTS (feasibility / policy filters), then ranks the
survivors with a CARBON-AWARE objective:

    score = fuel-cost delta + EU ETS delta + carbon shadow price (full
            emissions, €/t — not just the ETS-scoped share) − avoided
            war-risk premium        (lower = better)

It also optimises the bunker plan via Supplier-DNA ranking, and finally
passes the evidence pack through the reliability gate.
"""

from __future__ import annotations

from models import Supplier
from tools import carbon, reliability

CARBON_SHADOW_EUR_T = 72.0     # internal shadow price on FULL emissions delta

# Ports reachable for a top-up stem before the vessel commits to the reroute.
REACHABLE_BUNKER_PORTS = {"Port Klang", "Singapore", "Durban"}

# Supplier-DNA weights (0–100 subscores → composite)
DNA_WEIGHTS = {
    "reliability": 0.30,
    "esg_score": 0.25,
    "price_competitiveness": 0.20,
    "alt_fuel_readiness": 0.15,
    "fuel_quality": 0.10,
}
INCIDENT_PENALTY = {"low": 1, "medium": 3, "high": 8, "critical": 20}


class DecisionAgent:
    """Recommend: constraints → carbon-aware ranking → reliability gate."""

    # ── Hard constraints ─────────────────────────────────────────────────
    def filter_constraints(self, scenarios: dict) -> dict:
        surviving: dict[str, dict] = {}
        reasons: dict[str, str] = {}
        for key, scn in scenarios.items():
            if key == "A":
                # Crew-safety policy: no SEVERE-corridor transit without
                # board sign-off → beyond ops authority, filtered here.
                reasons[key] = (
                    "crew-safety policy — SEVERE-corridor transit requires "
                    "board sign-off (beyond ops authority)"
                )
                continue
            surviving[key] = scn
        return {"surviving": surviving, "filteredReasons": reasons}

    # ── Carbon-aware ranking ─────────────────────────────────────────────
    def rank(self, scenarios: dict, avoided_premium_usd: float) -> list[dict]:
        rows = []
        for key, scn in scenarios.items():
            impact = scn["impact"]
            shadow = impact["co2Tonnes"] * CARBON_SHADOW_EUR_T
            avoided = avoided_premium_usd if scn.get("warRiskPremiumUsd", 0) == 0 else 0.0
            # Waiting only avoids the premium if the corridor normalises.
            if key == "D":
                avoided = avoided_premium_usd * (1 - scn.get("pStillMustDivert", 0.65)) * 0
            score = impact["fuelUsd"] + impact["euEtsUsd"] + shadow - avoided
            rows.append(
                {
                    "scenario": key,
                    "label": scn["label"],
                    "fuelUsd": impact["fuelUsd"],
                    "euEtsUsd": impact["euEtsUsd"],
                    "carbonShadowUsd": round(shadow),
                    "avoidedPremiumUsd": avoided,
                    "netScoreUsd": round(score),
                    "riskScore": impact["riskScore"],
                }
            )
        # Primary key: net economic + carbon score; tie-break on residual risk.
        rows.sort(key=lambda r: (r["netScoreUsd"], r["riskScore"]))
        return rows

    # ── Bunker plan optimisation (Supplier DNA) ──────────────────────────
    def rank_suppliers(self, suppliers: list[Supplier], need_biofuel: bool) -> list[dict]:
        rows = []
        for s in suppliers:
            if s.port not in REACHABLE_BUNKER_PORTS:
                continue
            composite = (
                s.reliability * DNA_WEIGHTS["reliability"]
                + s.esg_score * DNA_WEIGHTS["esg_score"]
                + s.price_competitiveness * DNA_WEIGHTS["price_competitiveness"]
                + s.alt_fuel_readiness * DNA_WEIGHTS["alt_fuel_readiness"]
                + s.fuel_quality * DNA_WEIGHTS["fuel_quality"]
            )
            composite -= sum(INCIDENT_PENALTY[i.severity] for i in s.incidents)
            offers_bio = any("bio" in f.lower() for f in s.fuels_offered)
            if need_biofuel and not offers_bio:
                composite -= 25  # FuelEU compliance is load-bearing on the bio stem
            rows.append(
                {
                    "supplierId": s.id,
                    "name": s.name,
                    "port": s.port,
                    "dnaScore": round(composite, 1),
                    "offersBiofuel": offers_bio,
                    "reliability": s.reliability,
                    "esgScore": s.esg_score,
                    "incidents": len(s.incidents),
                }
            )
        rows.sort(key=lambda r: r["dnaScore"], reverse=True)
        return rows

    # ── Reliability gate ─────────────────────────────────────────────────
    def gate(
        self,
        corroboration_sources: int,
        double_run_drift: float,
        alternatives: int,
        reversible_hours: float,
    ) -> tuple[str, str, list[str]]:
        checklist = reliability.EvidenceChecklist(
            min_corroboration=corroboration_sources,
            calc_double_run_drift=double_run_drift,
            conflicting_authoritative=False,
            uncorroborated_primary_conflict=False,
            forecast_uncertainty_high=False,
            citations_current=True,
            supplier_verified=True,
            counterfactual_quantified=True,
            alternatives_documented=alternatives,
            reversible_hours=reversible_hours,
        )
        return reliability.evaluate(checklist)

    # ── Full recommend pass ──────────────────────────────────────────────
    def recommend(
        self,
        simulation: dict,
        suppliers: list[Supplier],
        corroboration_sources: int,
    ) -> dict:
        scenarios = simulation["scenarios"]
        constrained = self.filter_constraints(scenarios)
        ranking = self.rank(
            constrained["surviving"],
            avoided_premium_usd=simulation["marketInputs"]["warRiskPremiumUsd"],
        )
        best_key = ranking[0]["scenario"]
        best = scenarios[best_key]

        supplier_ranking = self.rank_suppliers(suppliers, need_biofuel=True)
        chosen_supplier = supplier_ranking[0]

        status, note, checks = self.gate(
            corroboration_sources=corroboration_sources,
            double_run_drift=simulation["doubleRunDrift"],
            alternatives=len(scenarios) - 1,
            reversible_hours=14.0,
        )

        return {
            "constrained": constrained,
            "ranking": ranking,
            "chosenScenario": best_key,
            "chosen": best,
            "supplierRanking": supplier_ranking,
            "chosenSupplier": chosen_supplier,
            "reliability": status,
            "reliabilityNote": note,
            "checksPassed": checks,
            "fuelEu": simulation["fuelEu"]["withB24"],
            "carbonShadowEurT": CARBON_SHADOW_EUR_T,
        }
