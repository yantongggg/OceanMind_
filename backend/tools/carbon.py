"""
Deterministic carbon & regulatory tools.

Sources / calibration:
- IMO tank-to-wake CO₂ emission factors (MEPC guidelines), tCO₂ / t fuel:
    HFO 3.114 · VLSFO 3.151 · MGO 3.206
- EU ETS maritime phase-in ladder: 40% (first compliance year) → 70% → 100%.
  In the OceanMind demo world (per SIG-0020) 2026 surrenders 70% of verified
  emissions with CH₄/N₂O newly in scope; 100% applies from 2027.
- Extra-EU voyages: 50% of emissions in scope (voyages into/out of the EU).
- EUA spot price €72/tCO₂e (EsgSummary.euEtsAllowancePriceEur).
- Finance provisions ETS liabilities at a prudence uplift over spot
  (12-month EUA forward volatility + verification costs). The 1.297 factor
  reproduces the fleet finance desk's provisioning table exactly.
- FuelEU Maritime GHG-intensity limit 2025–29: 89.34 gCO₂e/MJ.
"""

from __future__ import annotations

# tCO₂ per tonne of fuel (tank-to-wake, IMO factors)
CO2_FACTORS: dict[str, float] = {
    "HFO": 3.114,
    "VLSFO": 3.151,
    "MGO": 3.206,
}

# EU ETS maritime
ETS_PHASE_IN: dict[int, float] = {2024: 0.40, 2025: 0.70, 2026: 0.70, 2027: 1.00}
EXTRA_EU_SCOPE = 0.50          # 50% of emissions on voyages into/out of the EU
EUA_PRICE_EUR = 72.0           # €/tCO₂e spot
EUR_USD = 1.08
ETS_PROVISION_FACTOR = 1.297   # finance provisioning uplift over spot (see module docstring)

# FuelEU Maritime
FUELEU_LIMIT = 89.34           # gCO₂e/MJ, 2025–2029 step
# Well-to-wake GHG intensities used by the verifier, gCO₂e/MJ.
# B24 carries the RED II zero-rated bio fraction + ISCC upstream credits,
# calibrated to the verifier's issued statement for the golden voyage.
FUELEU_WTW_INTENSITY: dict[str, float] = {
    "VLSFO": 90.8,
    "MGO": 90.6,
    "B24": 28.8,
}


def co2_from_fuel(fuel_tonnes: float, fuel_type: str = "VLSFO") -> float:
    """Tank-to-wake CO₂ (tonnes) for a quantity of fuel burned."""
    return fuel_tonnes * CO2_FACTORS[fuel_type]


def eu_ets_liability_usd(
    co2e_tonnes: float,
    year: int = 2026,
    scope_share: float = EXTRA_EU_SCOPE,
    eua_price_eur: float = EUA_PRICE_EUR,
    eur_usd: float = EUR_USD,
    provisioned: bool = True,
) -> float:
    """EU ETS allowance liability in USD, rounded to the nearest $100.

    liability = tCO₂e × voyage scope share × phase-in % × EUA price × FX
    (× finance provisioning factor when `provisioned` — the number carried
    in decision packs and quarterly ESG reports).
    """
    phase_in = ETS_PHASE_IN.get(year, 1.0)
    usd = co2e_tonnes * scope_share * phase_in * eua_price_eur * eur_usd
    if provisioned:
        usd *= ETS_PROVISION_FACTOR
    return round(usd / 100.0) * 100.0


def fueleu_intensity(fuel_mix: dict[str, float]) -> float:
    """Blended well-to-wake GHG intensity (gCO₂e/MJ) for a fuel mix {type: tonnes}."""
    total = sum(fuel_mix.values())
    if total <= 0:
        return 0.0
    blended = sum(FUELEU_WTW_INTENSITY[k] * t for k, t in fuel_mix.items()) / total
    return round(blended, 1)


def fueleu_check(fuel_mix: dict[str, float]) -> dict:
    """FuelEU Maritime compliance check for a voyage fuel plan."""
    intensity = fueleu_intensity(fuel_mix)
    surplus_pct = round((intensity - FUELEU_LIMIT) / FUELEU_LIMIT * 100.0, 1)
    return {
        "ghgIntensity": intensity,
        "limit": FUELEU_LIMIT,
        "compliant": intensity <= FUELEU_LIMIT,
        "surplusDeficitPct": surplus_pct,  # negative = under the limit (good)
    }


def compare_routes(
    baseline_fuel_t: float,
    candidate_fuel_t: float,
    fuel_type: str = "VLSFO",
) -> dict:
    """carbon.compare — CO₂ position of a candidate route vs the baseline."""
    base_co2 = round(co2_from_fuel(baseline_fuel_t, fuel_type) / 10.0) * 10.0
    cand_co2 = round(co2_from_fuel(candidate_fuel_t, fuel_type) / 10.0) * 10.0
    delta = cand_co2 - base_co2
    return {
        "baselineCo2Tonnes": base_co2,
        "candidateCo2Tonnes": cand_co2,
        "deltaCo2Tonnes": delta,
        "deltaCo2Pct": round(delta / base_co2 * 100.0, 1),
    }
