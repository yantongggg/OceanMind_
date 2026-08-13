"""
Deterministic voyage calculations: distance, ETA, fuel.

Physics used:
- Great-circle (haversine) distance over route waypoints.
- Fuel per nautical mile at speed v scales with v² (daily consumption
  follows the classic cubic speed–fuel law; per-mile = daily / (24·v) ∝ v²).
- Slow-steaming a segment from service speed to a lower speed therefore
  saves fuel at (v_slow / v_service)² per mile while adding time.

Calibration constants come from the 14,000 TEU class consumption curve
used across the golden dataset (Suez plan of record: 8,320 nm · 24.0 d ·
2,850 t VLSFO) and are documented inline.
"""

from __future__ import annotations

import math

EARTH_RADIUS_NM = 3440.065

SERVICE_SPEED_KN = 19.5          # design service speed, 14,000 TEU class
SLOW_STEAM_SPEED_KN = 16.0       # eco setting used by the Decision Agent
BASE_RATE_T_PER_NM = 0.27184     # t VLSFO / nm at 19.5 kn, calm water
HOLD_FUEL_T_PER_DAY = 23.0       # aux + boilers + low-power manoeuvring during weather holds
ANCHOR_FUEL_T_PER_DAY = 14.0     # aux load at anchorage
CONVOY_HOLD_FUEL_T_PER_DAY = 15.0  # holding/station-keeping awaiting a convoy slot


def haversine_nm(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Great-circle distance in nautical miles between two [lon, lat] points."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_NM * math.asin(math.sqrt(a))


def route_distance_nm(waypoints: list[tuple[float, float]]) -> float:
    """Total great-circle distance along an ordered [lon, lat] polyline."""
    total = 0.0
    for (lon1, lat1), (lon2, lat2) in zip(waypoints, waypoints[1:]):
        total += haversine_nm(lon1, lat1, lon2, lat2)
    return round(total)


def sea_days(distance_nm: float, speed_kn: float = SERVICE_SPEED_KN) -> float:
    """Pure steaming time in days at a given speed."""
    return distance_nm / (speed_kn * 24.0)


def eta_days(
    distance_nm: float,
    speed_kn: float = SERVICE_SPEED_KN,
    overhead_days: float = 0.0,
) -> float:
    """Door-to-door transit days: steaming time + operational overheads
    (port/berth congestion, canal transit & queue, weather speed loss,
    pilotage, bunker calls). Rounded to the planning-table precision (0.1 d)."""
    return round(sea_days(distance_nm, speed_kn) + overhead_days, 1)


def fuel_tonnes(
    distance_nm: float,
    speed_kn: float = SERVICE_SPEED_KN,
    weather_factor: float = 1.0,
) -> float:
    """Propulsion fuel for a leg. `weather_factor` captures added resistance
    (monsoon head seas, convoy manoeuvring, canal ops) vs calm water."""
    per_nm = BASE_RATE_T_PER_NM * (speed_kn / SERVICE_SPEED_KN) ** 2
    return distance_nm * per_nm * weather_factor


def slow_steam_plan(
    segment_nm: float,
    slow_speed_kn: float = SLOW_STEAM_SPEED_KN,
    weather_hold_days: float = 0.0,
) -> dict:
    """Effect of slow-steaming `segment_nm` of a route from service speed,
    optionally including scheduled weather-window holds (Agulhas gale timing).

    Returns extra time and net fuel saved vs running the same miles at
    service speed. Speed-cube rule: daily consumption ratio =
    (v_slow / v_service)³ → per-mile ratio = (v_slow / v_service)².
    """
    ratio_daily = (slow_speed_kn / SERVICE_SPEED_KN) ** 3
    fuel_full = fuel_tonnes(segment_nm, SERVICE_SPEED_KN)
    fuel_slow = fuel_tonnes(segment_nm, slow_speed_kn)
    hold_fuel = weather_hold_days * HOLD_FUEL_T_PER_DAY
    extra_days = (
        sea_days(segment_nm, slow_speed_kn)
        - sea_days(segment_nm, SERVICE_SPEED_KN)
        + weather_hold_days
    )
    return {
        "consumptionRatioDaily": round(ratio_daily, 2),   # e.g. (16/19.5)³ = 0.55
        "extraDays": extra_days,
        "fuelSavedTonnes": fuel_full - fuel_slow - hold_fuel,
        "holdFuelTonnes": hold_fuel,
    }


def round_fuel(t: float) -> float:
    """Planning-table precision for fuel figures (whole tonnes)."""
    return float(round(t))


def round_usd_k(usd: float) -> float:
    """Planning-table precision for cost figures (nearest USD 1,000)."""
    return round(usd / 1000.0) * 1000.0
