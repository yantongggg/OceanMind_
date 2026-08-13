"""
Article → Signal.

Everything here is deterministic and inspectable. The LLM is not in this path:
it writes prose downstream (ingest/enrich.py), but category, severity,
geography and corroboration are decided by rules you can read and argue with.

The one inviolable rule, and the reason this module is careful:

    ABSENCE OF DATA IS NEVER A SIGNAL.

The donor implementation this was ported from had an AIS adapter whose
chokepoint monitor read `count=0` (i.e. "we have no API key, so no traffic
data") as `0 / 150 baseline = 0.0 < 0.3 threshold` → "disrupted" → and emitted
"Maritime Alert: Traffic disrupted at Strait of Malacca … may indicate
blockade, military operations". Three of the last twenty signals it produced
were that fiction, and they fed the risk scorer. Every function below returns
None/empty rather than inventing a finding, and every Signal that leaves here
is backed by a real article at a real URL.
"""

from __future__ import annotations

import hashlib
import re
from collections import defaultdict
from datetime import datetime
from typing import Optional

from ingest.geography import detect_chokepoint, locate
from models import Signal, Voyage

# ── Category classification ──────────────────────────────────────────────
#
# Checked in order — first match wins, so the specific sits above the generic.
# A kidnapping in the Gulf of Guinea is piracy, not geopolitics, even though
# it matches both.
CATEGORY_RULES: list[tuple[str, tuple[str, ...]]] = [
    (
        "piracy",
        (
            "pirate", "piracy", "hijack", "kidnap", "armed robbery", "boarding",
            "ransom", "abduct", "stowaway", "robbery at sea",
        ),
    ),
    (
        "weather",
        (
            "typhoon", "hurricane", "cyclone", "storm", "gale", "monsoon",
            "fog", "swell", "rough seas", "heavy weather", "tropical depression",
            "ice", "wind warning",
        ),
    ),
    (
        "regulatory",
        (
            "eu ets", "fueleu", "imo ", "regulation", "regulatory", "sanction",
            "compliance", "carbon tax", "carbon price", "emissions trading",
            "cii ", "marpol", "directive", "legislation", "ban on", "tariff",
            "customs", "flag state",
        ),
    ),
    (
        "port",
        (
            "congestion", "berth", "terminal", "port strike", "backlog",
            "queue", "anchorage", "waiting time", "dwell", "crane",
            "stevedore", "port closure", "bunker", "drought", "draft restriction",
        ),
    ),
    (
        "geopolitical",
        (
            "missile", "drone", "attack", "strike", "war", "military", "navy",
            "naval", "conflict", "escalat", "houthi", "irgc", "seiz", "blockade",
            "convoy", "warship", "security", "threat", "hostilit", "shelling",
            "ukmto", "war-risk", "war risk", "geopolit",
        ),
    ),
]

DEFAULT_CATEGORY = "geopolitical"

# ── Severity ─────────────────────────────────────────────────────────────
#
# Severity is about operational consequence, not drama. "Missile hits ship" is
# critical; "analyst says risk elevated" is not, however breathless the prose.
SEVERITY_RULES: list[tuple[str, tuple[str, ...]]] = [
    (
        "critical",
        (
            "missile", "struck", "hit by", "explosion", "sunk", "sinking",
            "killed", "casualt", "hijack", "seiz", "blockade", "closed",
            "closure", "suspend", "halt", "evacuat", "abandon ship", "mayday",
            "attack on", "attacked",
        ),
    ),
    (
        "high",
        (
            "drone", "threat level", "severe", "escalat", "warning", "alert",
            "diversion", "divert", "reroute", "war-risk", "war risk", "premium",
            "surge", "spike", "quadrupl", "tripl", "strike action", "typhoon",
            "hurricane", "cyclone", "near-miss", "near miss", "small-arms",
            "small arms", "kidnap", "convoy", "block ", "blocks ", "blocking",
            "blocked", "shut ", "toll", "fee on",
        ),
    ),
    (
        "medium",
        (
            "delay", "congestion", "backlog", "restrict", "inspect", "rate rise",
            "rates jump", "increase", "disrupt", "concern", "tension", "storm",
            "queue", "waiting",
        ),
    ),
]

DEFAULT_SEVERITY = "low"

# Hedging markers: the difference between a thing happening and a thing being
# talked about. "US reimposes blockade on Iranian ports" is critical; "Iran
# hardliner urges closure of Bab al-Mandab" contains the same trigger word and
# is not — it is a demand, not an event.
#
# Without this, every op-ed speculating about a closure reads as a closure, and
# since the Detect stage takes the MAX severity in a corridor, one hedged
# headline would escalate the whole cluster.
# Verb forms only. "threaten" hedges ("Iran threatens to close Hormuz");
# the noun "threat" does not ("UKMTO raises threat level to SEVERE" is an
# official designation being issued — an event, and a high one). Matching the
# bare noun downgraded exactly the advisories the Detect stage exists to catch.
HEDGE_MARKERS: tuple[str, ...] = (
    "urge", "threaten", "propose", "plan to", "plans to", "consider", "mull",
    "weigh", "call for", "calls for", "demand", "seek", "push for", "warn of",
    "warns of", "fears of", "feared", "risk of", "could ", "may ", "might ",
    "would ", "potential", "possible", "prepare", "vow", "pledge", "debate",
    "analysis", "opinion", "what if", "scenario", "expect", "forecast",
    "predict", "brace",
)

# Subordinate-clause introducers. Everything after one of these is context,
# not the reported event.
_SUBORDINATE_RE = re.compile(
    r"\b(as|after|amid|while|despite|though|although|since|when|following)\b|[,;—–|]"
)

_WORD_RE = re.compile(r"[a-z0-9]+")

_DOWNGRADE = {"critical": "high", "high": "medium", "medium": "low", "low": "low"}


def main_clause(headline: str) -> str:
    """The reported event, stripped of trailing context.

    "Hormuz Traffic Grinds to a Near Halt as Ceasefire Under Threat" is a
    report that traffic HAS halted; the ceasefire clause is background. Hedge
    detection must only see "Hormuz Traffic Grinds to a Near Halt", or the
    stray "Threat" downgrades a real event.
    """
    text = headline.lower().strip()
    match = _SUBORDINATE_RE.search(text)
    return text[: match.start()].strip() if match and match.start() > 0 else text


def is_hedged(headline: str) -> bool:
    """True when the headline's MAIN CLAUSE reports intent rather than event."""
    return any(marker in main_clause(headline) for marker in HEDGE_MARKERS)


def classify_category(title: str, summary: str = "") -> str:
    """Deterministic category from headline + summary text."""
    text = f"{title} {summary}".lower()
    for category, keywords in CATEGORY_RULES:
        if any(kw in text for kw in keywords):
            return category
    return DEFAULT_CATEGORY


def assess_severity(title: str, summary: str = "") -> str:
    """Deterministic severity from headline + summary text.

    Two dampers keep this from crying wolf:
      - The headline outranks the body. Wire desks put the consequence in the
        headline; summaries drag in background paragraphs ("...since the 2024
        missile attacks...") that would inflate everything to critical.
      - Hedged headlines drop one rung. Intent is not incident.
    """
    headline = title.lower()
    hedged = is_hedged(headline)

    for severity, keywords in SEVERITY_RULES:
        if any(kw in headline for kw in keywords):
            return _DOWNGRADE[severity] if hedged else severity

    body = f"{title} {summary}".lower()
    for severity, keywords in SEVERITY_RULES:
        if any(kw in body for kw in keywords):
            # Trigger only in the body — one rung down, and again if hedged.
            downgraded = _DOWNGRADE[severity]
            return _DOWNGRADE[downgraded] if hedged else downgraded

    return DEFAULT_SEVERITY


def chokepoint_matches_route(chokepoint: str, via: str) -> bool:
    """Tolerant chokepoint join.

    Voyage routes say "Taiwan Strait approaches"; signals say "Taiwan Strait".
    Exact matching silently drops the join and the voyage never registers as
    exposed — so compare on containment either way.
    """
    a, b = chokepoint.lower().strip(), via.lower().strip()
    return a == b or a in b or b in a


def affected_voyages(chokepoint: Optional[str], voyages: list[Voyage]) -> list[str]:
    """Voyage ids whose any route option transits this chokepoint.

    Empty list when the chokepoint is None or nothing transits it — which is
    a real answer ("no fleet exposure"), not a failure.
    """
    if not chokepoint:
        return []
    hits: list[str] = []
    for v in voyages:
        for route in v.route_options or []:
            if any(chokepoint_matches_route(chokepoint, via) for via in (route.via_chokepoints or [])):
                hits.append(v.id)
                break
    return sorted(set(hits))


def _title_tokens(title: str) -> frozenset[str]:
    """Content words of a headline, for near-duplicate grouping."""
    stop = {
        "the", "a", "an", "of", "in", "on", "at", "to", "for", "and", "or",
        "as", "is", "are", "was", "were", "after", "over", "with", "by",
        "says", "said", "new", "amid",
    }
    return frozenset(w for w in _WORD_RE.findall(title.lower()) if w not in stop and len(w) > 2)


def _same_story(a: frozenset[str], b: frozenset[str]) -> bool:
    """Jaccard overlap — two headlines about one event."""
    if not a or not b:
        return False
    return len(a & b) / len(a | b) >= 0.45


def compute_corroboration(articles: list[dict]) -> dict[str, int]:
    """url → number of DISTINCT sources reporting the same story.

    Corroboration is the count of independent outlets carrying an event, which
    is what makes it trustworthy. Grouped within a chokepoint by headline
    overlap. A story only one outlet carries gets 1 — never 0, and never
    inflated to imply verification that does not exist.
    """
    by_chokepoint: dict[Optional[str], list[dict]] = defaultdict(list)
    for art in articles:
        by_chokepoint[art.get("chokepoint")].append(art)

    result: dict[str, int] = {}
    for group in by_chokepoint.values():
        buckets: list[tuple[frozenset[str], set[str], list[str]]] = []
        for art in group:
            tokens = _title_tokens(art["title"])
            for btokens, sources, urls in buckets:
                if _same_story(tokens, btokens):
                    sources.add(art["source"])
                    urls.append(art["url"])
                    break
            else:
                buckets.append((tokens, {art["source"]}, [art["url"]]))
        for _, sources, urls in buckets:
            for url in urls:
                result[url] = len(sources)
    return result


def signal_id(url: str) -> str:
    """Stable id derived from the article URL.

    Deterministic, so re-ingesting the same article yields the same id and the
    store's upsert is idempotent. The SIG-L- prefix keeps live signals from
    ever colliding with the golden dataset's SIG-0001…SIG-0040.
    """
    digest = hashlib.sha256(url.encode()).hexdigest()[:8].upper()
    return f"SIG-L-{digest}"


def to_signal(
    article: dict,
    voyages: list[Voyage],
    corroboration: int,
    plain_english: str,
    not_implied: str,
) -> Optional[Signal]:
    """Build one Signal, or None if the article can't honestly be one.

    Returns None — rather than a degraded guess — when the article has no
    resolvable chokepoint. A story we cannot place is a story we cannot reason
    about; it stays out of the pipeline instead of landing at (0, 0).
    """
    chokepoint = article.get("chokepoint")
    coords = locate(chokepoint)
    if not coords:
        return None
    url = (article.get("url") or "").strip()
    if not url:
        return None  # provenance is non-negotiable for live signals

    lat, lon = coords
    return Signal(
        id=signal_id(url),
        title=article["title"][:220],
        summary=(article.get("summary") or article["title"])[:600],
        plain_english=plain_english,
        not_implied=not_implied,
        category=article.get("category") or classify_category(
            article["title"], article.get("summary", "")
        ),
        severity=article.get("severity") or assess_severity(
            article["title"], article.get("summary", "")
        ),
        lat=lat,
        lon=lon,
        source=article.get("source") or "unknown",
        published_at=article.get("published_at") or datetime.utcnow().isoformat(),
        corroboration=max(1, corroboration),
        affected_voyage_ids=affected_voyages(chokepoint, voyages),
        affected_chokepoint=chokepoint,
        url=url,
        origin="live",
    )


def enrich_articles(articles: list[dict]) -> list[dict]:
    """Annotate raw articles with chokepoint / category / severity in place.

    Articles that can't be placed at a chokepoint are dropped here — they are
    not maritime intelligence we can act on, and inventing a location for them
    would be exactly the failure mode this module exists to prevent.
    """
    out: list[dict] = []
    for art in articles:
        title = art.get("title") or ""
        summary = art.get("summary") or ""
        # A hint from a per-chokepoint query is a strong prior, but the text
        # still has to corroborate it — a "Red Sea" query returns articles
        # that only mention Suez, and those belong to Suez.
        chokepoint = detect_chokepoint(title, summary) or art.get("chokepoint_hint")
        if not chokepoint:
            continue
        art = {
            **art,
            "chokepoint": chokepoint,
            "category": classify_category(title, summary),
            "severity": assess_severity(title, summary),
        }
        out.append(art)
    return out
