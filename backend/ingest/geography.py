"""
Maritime geography — chokepoint recognition and geolocation.

This is the bridge between free-text news and the agent pipeline. A headline
says "Bab al-Mandab"; the Detect stage needs the canonical name
"Bab el-Mandeb" plus a lat/lon to place it on the globe.

CRITICAL: the canonical names here MUST match `agents/disruption.py::CORRIDORS`
exactly. That module single-linkage merges chokepoints into corridors, and it
keys off these strings. A typo here doesn't raise — it silently drops the
signal out of its corridor and the Red Sea cluster quietly stops forming.
"""

from __future__ import annotations

import re
from typing import Optional

# Canonical chokepoint → (lat, lon, aliases, query_terms).
#
# `aliases` are matched case-insensitively on word boundaries against the
# headline + summary. They include the transliterations real wire copy uses
# (Reuters writes "Bab al-Mandab", Lloyd's List writes "Bab el-Mandeb"), plus
# nearby place names that reliably imply the chokepoint — a missile "off
# Mokha" is a Bab el-Mandeb event. Aliases are for RECOGNISING a chokepoint
# in text, so they lean precise.
#
# `query_terms` are what we send to a news search, and they are a different
# job: they must be BROAD enough to actually return coverage. Searching only
# the spelling variants of "Bab el-Mandeb" returns a trickle; adding "red sea"
# and "gulf of aden" returns the real story. Where a chokepoint's name is
# already the way press refers to it (Suez, Hormuz), the two lists converge.
CHOKEPOINTS: dict[str, dict] = {
    "Bab el-Mandeb": {
        "lat": 13.47,
        "lon": 43.12,
        "aliases": [
            "bab el-mandeb", "bab al-mandab", "bab-el-mandeb", "bab el mandeb",
            "babelmandeb", "mandeb strait", "red sea", "southern red sea",
            "gulf of aden", "mokha", "mocha yemen", "hanish", "assab", "djibouti strait",
        ],
        "query_terms": ["bab el-mandeb", "bab al-mandab", "red sea", "gulf of aden"],
    },
    "Suez Canal": {
        "lat": 30.50,
        "lon": 32.35,
        "aliases": [
            "suez canal", "suez", "port said", "ismailia", "great bitter lake",
            "suez canal authority", "sumed",
        ],
        "query_terms": ["suez canal", "suez transit"],
    },
    "Malacca Strait": {
        "lat": 2.50,
        "lon": 101.50,
        "aliases": [
            "malacca strait", "strait of malacca", "straits of malacca",
            "melaka strait", "malacca", "port klang", "one fathom bank",
        ],
        "query_terms": ["strait of malacca", "malacca strait", "port klang"],
    },
    "Singapore Strait": {
        "lat": 1.23,
        "lon": 103.85,
        "aliases": [
            "singapore strait", "strait of singapore", "phillip channel",
            "singapore anchorage", "mpa singapore",
        ],
        "query_terms": ["singapore strait", "singapore port", "singapore bunker"],
    },
    "Strait of Hormuz": {
        "lat": 26.57,
        "lon": 56.25,
        "aliases": [
            "strait of hormuz", "hormuz", "persian gulf", "arabian gulf",
            "bandar abbas", "musandam", "larak", "qeshm",
        ],
        "query_terms": ["strait of hormuz", "hormuz", "persian gulf"],
    },
    "Panama Canal": {
        "lat": 9.08,
        "lon": -79.68,
        "aliases": [
            "panama canal", "gatun", "miraflores", "panama canal authority",
            "acp panama", "culebra cut",
        ],
        "query_terms": ["panama canal"],
    },
    "Taiwan Strait": {
        "lat": 24.00,
        "lon": 119.00,
        "aliases": [
            "taiwan strait", "formosa strait", "kaohsiung", "keelung",
        ],
        "query_terms": ["taiwan strait"],
    },
    "Dover Strait": {
        "lat": 51.00,
        "lon": 1.50,
        "aliases": [
            "dover strait", "strait of dover", "english channel", "pas de calais",
        ],
        "query_terms": ["dover strait", "english channel shipping"],
    },
    # Not in CORRIDORS — no corridor merging — but still geolocatable and
    # operationally meaningful (it's the Red Sea alternative, and the Gulf of
    # Guinea is the piracy hotspot the golden dataset already models).
    "Cape of Good Hope": {
        "lat": -34.36,
        "lon": 18.47,
        "aliases": [
            "cape of good hope", "cape town", "cape route", "agulhas",
            "wild coast", "durban",
        ],
        "query_terms": ["cape of good hope", "cape route diversion"],
    },
    "Gulf of Guinea": {
        "lat": 3.50,
        "lon": 5.00,
        "aliases": [
            "gulf of guinea", "bight of benin", "bight of bonny", "brass nigeria",
            "lagos anchorage", "bonny island", "niger delta",
        ],
        "query_terms": ["gulf of guinea", "nigeria piracy"],
    },
}

# Precompiled alias → canonical lookup, longest-first so "strait of malacca"
# wins over a bare "malacca" and "southern red sea" over "red sea".
_ALIAS_PATTERNS: list[tuple[re.Pattern, str]] = sorted(
    (
        (re.compile(r"\b" + re.escape(alias) + r"\b", re.IGNORECASE), canonical)
        for canonical, meta in CHOKEPOINTS.items()
        for alias in meta["aliases"]
    ),
    key=lambda pair: -len(pair[0].pattern),
)


def detect_chokepoint(*texts: str) -> Optional[str]:
    """Return the canonical chokepoint named in the text, or None.

    None means "this article isn't about a chokepoint we track" — a perfectly
    ordinary outcome, and NOT a signal of anything. Callers must not read
    meaning into a None.
    """
    haystack = " ".join(t for t in texts if t)
    if not haystack.strip():
        return None
    for pattern, canonical in _ALIAS_PATTERNS:
        if pattern.search(haystack):
            return canonical
    return None


def locate(chokepoint: Optional[str]) -> Optional[tuple[float, float]]:
    """(lat, lon) for a canonical chokepoint, or None if unknown/None."""
    if not chokepoint:
        return None
    meta = CHOKEPOINTS.get(chokepoint)
    if not meta:
        return None
    return (meta["lat"], meta["lon"])


# ANDed onto every news query. Without it "Panama" returns politics and
# "Dover" returns UK local news.
MARITIME_CONTEXT = (
    "(ship OR vessel OR shipping OR tanker OR cargo OR maritime OR port OR freight)"
)


def query_terms(chokepoint: str) -> list[str]:
    """Search terms for a chokepoint — broad by design. See CHOKEPOINTS docs."""
    meta = CHOKEPOINTS[chokepoint]
    return meta.get("query_terms") or [chokepoint.lower()]


def news_query(chokepoint: str) -> str:
    """Boolean query: any productive term for this chokepoint, in maritime context."""
    terms = " OR ".join(f'"{t}"' for t in query_terms(chokepoint))
    return f"({terms}) AND {MARITIME_CONTEXT}"


def gdelt_query(chokepoint: str) -> str:
    """Same shape as news_query; GDELT takes bare single words unquoted."""
    terms = " OR ".join(
        f'"{t}"' if " " in t else t for t in query_terms(chokepoint)
    )
    return f"({terms}) AND {MARITIME_CONTEXT}"
