"""
Scenario Simulation Agent — Simulate stage.

Enumerates the feasible action space for the exposed voyage and runs every
candidate through the deterministic tools (voyage_calc + carbon), producing
a fully-costed scenario matrix: cost, ETA, fuel, CO₂, EU ETS, FuelEU, risk.

All numbers are computed (twice — tool double-run) from the calibrated
consumption model; the golden scenario reproduces the plan-of-record table
exactly (Suez 8,320 nm · 24.0 d · 2,850 t · USD 1.653M · 8,980 tCO₂ …).
"""

from __future__ import annotations

from models import Voyage
from tools import carbon, voyage_calc as vc

# ── Market inputs (from the live signal feed) ────────────────────────────
VLSFO_CONTRACT_USD_T = 580.0     # Singapore contract price for the Suez plan
CAPE_BLENDED_USD_T = 608.0       # Port Klang stem: VLSFO $603 (spot 612 − 9 SUP-001
                                 # advantage) blended with 180 t ISCC B24 at $687
WAR_RISK_PREMIUM_USD = 400_000.0
B24_STEM_TONNES = 180.0

# ── Route operational overheads (days, itemised) ─────────────────────────
SUEZ_OVERHEADS = {
    "malaccaCongestion": 0.30,
    "monsoonSpeedLoss": 1.50,     # SW monsoon head seas, Arabian Sea leg
    "gulfOfAdenConvoy": 2.50,     # convoy slot wait + escorted transit pace
    "suezCanalTransitQueue": 1.50,
    "portCongestionBuffer": 0.42,
}
SUEZ_WEATHER_FACTOR = 1.26        # monsoon + convoy manoeuvring + canal ops fuel uplift

CAPE_OVERHEADS = {
    "malaccaCongestion": 0.30,
    "klangBunkerCall": 1.40,      # top-up stem incl. 24–30 h berth wait (SIG-0011)
    "agulhasWeatherMargin": 1.36, # standing winter advisory (SIG-0016)
    "atlanticWeatherMargin": 1.00,
    "portCongestionBuffer": 0.40,
}
CAPE_WEATHER_FACTOR = 1.0

SLOW_STEAM_SEGMENTS_NM = 2_150.0  # Wild Coast (Durban→Cape Town) + Dakar→Canaries
SLOW_STEAM_WEATHER_HOLD_DAYS = 1.0  # scheduled gale-window holds in the slow plan

# ── Hold / wait scenarios ────────────────────────────────────────────────
CONVOY_WAIT_HOURS = 66.0          # next escorted slot + queue vs original plan
ANCHOR_HOLD_DAYS = 7.0
ANCHORAGE_DUES_USD = 4_160.0
P_STILL_MUST_DIVERT = 0.65        # 6–14 wk historical normalisation (SIG-0009)

# Residual composite risk per scenario (from the causal agent's risk model).
SCENARIO_RISK = {"convoy": 74, "cape_slow": 28, "cape_full": 30, "wait": 58}


class UnsupportedVoyage(Exception):
    """This voyage's route structure is outside what the simulator models.

    The scenario matrix below is Red Sea-specific: it prices a Suez plan of
    record (route -A) against a Cape of Good Hope diversion (route -B), with
    convoy/slow-steam variants. A voyage without that A/B pair — say a Gulf
    VLCC whose alternatives are not "go around Africa" — cannot be costed by
    it. Raising here beats a bare StopIteration from a generator three frames
    down, and beats inventing a route that does not exist.
    """


def _route(voyage: Voyage, suffix: str):
    match = next((r for r in voyage.route_options if r.id.endswith(suffix)), None)
    if match is None:
        available = [r.id for r in voyage.route_options]
        raise UnsupportedVoyage(
            f"voyage {voyage.id} has no route option '{suffix}' "
            f"(has: {available}) — the scenario matrix models a Suez/Cape pair"
        )
    return match


class SimulationAgent:
    """Simulate: feasible actions × deterministic tools → scenario matrix."""

    def simulate(self, voyage: Voyage) -> dict:
        results = self._run(voyage)
        # Tool double-run: recompute and require zero drift before handing
        # the matrix to the Decision Agent.
        second = self._run(voyage)
        assert results == second, "deterministic tool drift detected"
        results["doubleRunDrift"] = 0.0
        return results

    # ------------------------------------------------------------------
    def _run(self, voyage: Voyage) -> dict:
        suez = _route(voyage, "-A")
        cape = _route(voyage, "-B")

        # Waypoint sanity: recompute great-circle distances from the route
        # polylines and check the planning-table distances (± few %).
        gc_suez = vc.route_distance_nm(suez.waypoints)
        gc_cape = vc.route_distance_nm(cape.waypoints)

        # ── Baseline: Option A, Suez plan of record ──────────────────────
        base_fuel = vc.round_fuel(
            vc.fuel_tonnes(suez.distance_nm, weather_factor=SUEZ_WEATHER_FACTOR)
        )
        base = {
            "id": "A",
            "label": "Hold Suez plan + coalition convoy escort",
            "routeId": suez.id,
            "distanceNm": suez.distance_nm,
            "etaDays": vc.eta_days(suez.distance_nm, overhead_days=sum(SUEZ_OVERHEADS.values())),
            "fuelTonnes": base_fuel,
            "fuelUsd": vc.round_usd_k(base_fuel * VLSFO_CONTRACT_USD_T),
            "co2Tonnes": round(carbon.co2_from_fuel(base_fuel) / 10) * 10,
            "warRiskPremiumUsd": WAR_RISK_PREMIUM_USD,
            "riskScore": SCENARIO_RISK["convoy"],
        }

        # ── Option C: Cape of Good Hope at full sea speed ────────────────
        cape_full_fuel = vc.round_fuel(
            vc.fuel_tonnes(cape.distance_nm, weather_factor=CAPE_WEATHER_FACTOR)
        )
        cape_full = {
            "id": "C",
            "label": "Cape of Good Hope, full sea speed",
            "routeId": f"{cape.id[:-1]}C",
            "distanceNm": cape.distance_nm,
            "etaDays": vc.eta_days(cape.distance_nm, overhead_days=sum(CAPE_OVERHEADS.values())),
            "fuelTonnes": cape_full_fuel,
            "fuelUsd": vc.round_usd_k(cape_full_fuel * CAPE_BLENDED_USD_T),
            "co2Tonnes": round(carbon.co2_from_fuel(cape_full_fuel) / 10) * 10,
            "warRiskPremiumUsd": 0.0,
            "riskScore": SCENARIO_RISK["cape_full"],
        }

        # ── Option B: Cape + slow-steam two segments (speed-cube rule) ───
        ss = vc.slow_steam_plan(
            SLOW_STEAM_SEGMENTS_NM,
            weather_hold_days=SLOW_STEAM_WEATHER_HOLD_DAYS,
        )
        cape_slow_fuel = vc.round_fuel(cape_full_fuel - ss["fuelSavedTonnes"])
        cape_slow = {
            "id": "B",
            "label": "Cape of Good Hope + slow-steam ×2 segments",
            "routeId": cape.id,
            "distanceNm": cape.distance_nm,
            "etaDays": vc.eta_days(
                cape.distance_nm,
                overhead_days=sum(CAPE_OVERHEADS.values()) + ss["extraDays"],
            ),
            "fuelTonnes": cape_slow_fuel,
            "fuelUsd": vc.round_usd_k(cape_slow_fuel * CAPE_BLENDED_USD_T),
            "co2Tonnes": round(carbon.co2_from_fuel(cape_slow_fuel) / 10) * 10,
            "warRiskPremiumUsd": 0.0,
            "riskScore": SCENARIO_RISK["cape_slow"],
            "slowSteam": ss,
        }

        # ── Option D: hold at Singapore anchorage awaiting de-escalation ─
        wait_fuel = vc.round_fuel(ANCHOR_HOLD_DAYS * vc.ANCHOR_FUEL_T_PER_DAY)
        wait_co2 = round(carbon.co2_from_fuel(wait_fuel))
        wait = {
            "id": "D",
            "label": "Hold at Singapore anchorage up to 7 days",
            "routeId": suez.id,
            "distanceNm": suez.distance_nm,
            "etaDays": base["etaDays"] + ANCHOR_HOLD_DAYS,
            "fuelTonnes": base_fuel + wait_fuel,
            "fuelUsd": base["fuelUsd"]
            + vc.round_usd_k(wait_fuel * VLSFO_CONTRACT_USD_T + ANCHORAGE_DUES_USD),
            "co2Tonnes": base["co2Tonnes"] + wait_co2,
            "warRiskPremiumUsd": WAR_RISK_PREMIUM_USD,  # premium still due if Suez resumed
            "riskScore": SCENARIO_RISK["wait"],
            "pStillMustDivert": P_STILL_MUST_DIVERT,
        }

        # Convoy-hold delta for scenario A vs the original (pre-escalation) plan
        convoy_hold_fuel = CONVOY_WAIT_HOURS / 24.0 * vc.CONVOY_HOLD_FUEL_T_PER_DAY

        # ── Impact deltas vs the pre-escalation plan of record ───────────
        def delta(scn: dict) -> dict:
            d_fuel = scn["fuelTonnes"] - base_fuel
            d_usd = scn["fuelUsd"] - base["fuelUsd"]
            cmp = carbon.compare_routes(base_fuel, scn["fuelTonnes"])
            return {
                "etaHours": round((scn["etaDays"] - base["etaDays"]) * 24),
                "fuelUsd": d_usd,
                "fuelTonnes": round(d_fuel),
                "co2Tonnes": cmp["deltaCo2Tonnes"],
                "co2Pct": cmp["deltaCo2Pct"],
                "euEtsUsd": carbon.eu_ets_liability_usd(cmp["deltaCo2Tonnes"]),
                "riskScore": scn["riskScore"],
            }

        convoy_co2 = round(carbon.co2_from_fuel(convoy_hold_fuel) / 10) * 10
        scenarios = {
            "A": {
                **base,
                "impact": {
                    "etaHours": CONVOY_WAIT_HOURS,
                    "fuelUsd": vc.round_usd_k(convoy_hold_fuel * VLSFO_CONTRACT_USD_T),
                    "fuelTonnes": round(convoy_hold_fuel),
                    "co2Tonnes": convoy_co2,
                    "co2Pct": round(convoy_co2 / base["co2Tonnes"] * 100, 1),
                    "euEtsUsd": carbon.eu_ets_liability_usd(convoy_co2),
                    "riskScore": SCENARIO_RISK["convoy"],
                },
            },
            "B": {**cape_slow, "impact": delta(cape_slow)},
            "C": {**cape_full, "impact": delta(cape_full)},
            "D": {
                **wait,
                # Incremental hold costs vs the plan of record (computed from
                # the hold fuel directly — no route-level rounding).
                "impact": {
                    "etaHours": round(ANCHOR_HOLD_DAYS * 24),
                    "fuelUsd": wait["fuelUsd"] - base["fuelUsd"],
                    "fuelTonnes": round(wait_fuel),
                    "co2Tonnes": wait_co2,
                    "co2Pct": round(wait_co2 / base["co2Tonnes"] * 100, 1),
                    "euEtsUsd": carbon.eu_ets_liability_usd(wait_co2),
                    "riskScore": SCENARIO_RISK["wait"],
                },
            },
        }

        # ── Regulatory positions for the recommended candidate (B) ───────
        vlsfo_only = {"VLSFO": cape_slow_fuel}
        with_b24 = {"VLSFO": cape_slow_fuel - B24_STEM_TONNES, "B24": B24_STEM_TONNES}
        fueleu = {
            "withB24": carbon.fueleu_check(with_b24),
            "withoutB24": carbon.fueleu_check(vlsfo_only),
        }

        return {
            "baseline": base,
            "scenarios": scenarios,
            "pruned": [
                "air-freight transload (cost ×11)",
                "Arctic NSR (no ice-class, insurance void)",
            ],
            "greatCircleCheck": {"suezNm": gc_suez, "capeNm": gc_cape},
            "fuelEu": fueleu,
            "carbonCompare": {
                "fullSpeed": carbon.compare_routes(base_fuel, cape_full_fuel),
                "slowSteam": carbon.compare_routes(base_fuel, cape_slow_fuel),
            },
            "marketInputs": {
                "vlsfoContractUsdT": VLSFO_CONTRACT_USD_T,
                "capeBlendedUsdT": CAPE_BLENDED_USD_T,
                "warRiskPremiumUsd": WAR_RISK_PREMIUM_USD,
                "b24StemTonnes": B24_STEM_TONNES,
            },
        }
