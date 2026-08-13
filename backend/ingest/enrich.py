"""
Prose enrichment for live signals — plainEnglish and notImplied.

These two fields are the product's spine: `plainEnglish` says what a headline
means for someone running a ship, and `notImplied` fences off what it does NOT
mean. The second one is the honest half — it's what stops "missile near-miss at
Bab el-Mandeb" from being read as "the strait is closed".

Follows the same contract as agents/llm.py: Claude writes prose, tools decide
facts. The model never sets severity, geography, corroboration or fleet
exposure — those are already fixed by ingest/mapper.py before we get here. On
any failure (no key, network, quota, bad JSON) we fall back to template text
and ingestion continues. Enrichment failing must never cost us a signal.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Optional

import llm_client

logger = logging.getLogger(__name__)

# Sizing, arrived at by watching it fail:
#   - batch 20 @ 4000 tokens @ 30s → every call timed out, zero enrichment.
#   - batch 8 @ 4000 tokens → responses truncated mid-array; the JSON parser
#     correctly reported "unbalanced array", but the cause was the token
#     ceiling, not the output. 3 of 5 batches lost.
# Two prose fields per signal run ~120 tokens each, so 5 signals needs ~1.5k
# with headroom for the model being chattier than asked.
TIMEOUT_S = 120.0
BATCH_SIZE = 5
MAX_TOKENS = 8000

# Enriching all ~200 ingested signals is waste: most are never read. Only
# these get prose — the ones that reach the pipeline or that an operator would
# actually stop on. The rest keep template text until something asks for them.
PRIORITY_SEVERITIES = frozenset({"high", "critical"})
MAX_ENRICHED = 25

SYSTEM_PROMPT = (
    "You are the signal interpretation layer of OceanMind, a maritime "
    "decision-support system used by voyage operations managers.\n\n"
    "You receive a JSON array of news items, each with `id`, `title`, "
    "`summary`, `chokepoint` and `severity`. For EACH item return two fields:\n\n"
    "`plainEnglish` — 1-2 sentences: what this means operationally for someone "
    "routing ships past this chokepoint. No jargon, no hedging, no restating "
    "the headline. Say the consequence.\n\n"
    "`notImplied` — 1 sentence starting with 'Does NOT imply': the most likely "
    "WRONG inference a reader would draw from this headline, explicitly ruled "
    "out. This is a guard against overreaction — e.g. an attack near a strait "
    "does not imply the strait is closed.\n\n"
    "Rules:\n"
    "- Never invent numbers, dates, vessel names or casualties not in the input.\n"
    "- Never contradict the given `severity`.\n"
    "- If the item is vague, say so plainly rather than embellishing.\n"
    "- Return ONLY a JSON array of {id, plainEnglish, notImplied}. No markdown."
)


def enrichment_enabled() -> bool:
    """True when any LLM provider (Bedrock or Anthropic) is configured."""
    return llm_client.llm_enabled()


def template_plain_english(article: dict) -> str:
    """Deterministic fallback — honest, if flat.

    Deliberately describes the report rather than interpreting it. Without a
    model we do not know the operational consequence, and guessing one is the
    kind of confident fiction this codebase is trying to avoid.
    """
    chokepoint = article.get("chokepoint") or "the route"
    severity = article.get("severity", "low")
    source = article.get("source", "a source")
    weight = {
        "critical": "a serious, immediate",
        "high": "a significant",
        "medium": "a moderate",
        "low": "a low-level",
    }.get(severity, "a low-level")
    return (
        f"{source} reports {weight} development affecting {chokepoint}. "
        f"Operators with tonnage transiting {chokepoint} should read the source "
        f"before acting on this."
    )


def template_not_implied(article: dict) -> str:
    """Deterministic fallback for the guard field."""
    chokepoint = article.get("chokepoint") or "the corridor"
    return (
        f"Does NOT imply {chokepoint} is closed, that any OceanMind vessel is "
        f"involved, or that transits are suspended — this is a single report, "
        f"not a confirmed operational change."
    )


def extract_json_array(text: str) -> list:
    """Parse a JSON array out of model output.

    "Return ONLY a JSON array, no markdown" is a request, not a guarantee —
    models wrap output in ```json fences or prepend a sentence often enough
    that a bare json.loads() throws "Expecting value: line 1 column 1" and the
    whole batch silently degrades to templates.

    Strategy: try the raw text, then strip fences, then scan for the first
    balanced [...] span (bracket depth, string-aware so brackets inside
    headlines don't confuse it).
    """
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    fenced = re.search(r"```(?:json)?\s*(.+?)```", text, re.DOTALL)
    if fenced:
        try:
            return json.loads(fenced.group(1).strip())
        except json.JSONDecodeError:
            text = fenced.group(1).strip()

    start = text.find("[")
    if start == -1:
        raise ValueError("no JSON array in model output")

    depth, in_string, escaped = 0, False, False
    for i in range(start, len(text)):
        ch = text[i]
        if escaped:
            escaped = False
            continue
        if ch == "\\":
            escaped = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                return json.loads(text[start : i + 1])

    raise ValueError("unbalanced JSON array in model output")


def _call_claude(batch: list[dict]) -> dict[int, dict]:
    """Enrich one batch. Returns {index_in_batch: {plainEnglish, notImplied}}.

    Keyed by a small integer, deliberately. This used to key on the article
    URL, which meant the model had to echo back a 200-character Google News
    redirect (…/articles/CBMi0wFBVV95cUxNRHF5cTRVdk5td…) byte-for-byte for the
    result to match. It never did, every lookup missed, and enrichment
    silently returned templates while the logs showed five successful API
    calls. A round-trip key must be something a model can reproduce.
    """
    body = llm_client.messages_request(
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": json.dumps(
                    [
                        {
                            "id": i,
                            "title": a["title"],
                            "summary": (a.get("summary") or "")[:300],
                            "chokepoint": a.get("chokepoint"),
                            "severity": a.get("severity"),
                        }
                        for i, a in enumerate(batch)
                    ]
                ),
            }
        ],
        max_tokens=MAX_TOKENS,
        timeout=TIMEOUT_S,
    )
    stop = body.get("stop_reason")
    if stop == "refusal":
        return {}
    if stop == "max_tokens":
        # Say what actually went wrong. This surfaced as "unbalanced JSON
        # array" from the parser, which sent me looking at the parser instead
        # of at MAX_TOKENS.
        raise ValueError(
            f"response truncated at max_tokens ({MAX_TOKENS}) — "
            f"lower BATCH_SIZE (now {BATCH_SIZE}) or raise the ceiling"
        )
    parsed = extract_json_array(llm_client.response_text(body))
    out: dict[int, dict] = {}
    for item in parsed:
        if not isinstance(item, dict):
            continue
        try:
            idx = int(item["id"])
        except (KeyError, TypeError, ValueError):
            continue
        if 0 <= idx < len(batch):
            out[idx] = item
    return out


def templates(articles: list[dict]) -> dict[str, tuple[str, str]]:
    """url → template prose for every article. No network, no failure mode."""
    return {
        a["url"]: (template_plain_english(a), template_not_implied(a)) for a in articles
    }


def _priority(articles: list[dict], focus_chokepoints: Optional[set[str]]) -> list[dict]:
    """The subset worth spending a model call on, most important first.

    Ranked by: does it reach the pipeline, then how loud is it. Capped, because
    an unbounded sweep would grow model spend and wall-clock with the news
    cycle rather than with anything a user sees.
    """

    def rank(a: dict) -> tuple[int, int]:
        in_focus = bool(focus_chokepoints) and a.get("chokepoint") in focus_chokepoints
        loud = a.get("severity") in PRIORITY_SEVERITIES
        return (0 if in_focus else 1, 0 if loud else 1)

    ranked = sorted(articles, key=rank)
    return [a for a in ranked if rank(a) != (1, 1)][:MAX_ENRICHED]


def enrich(
    articles: list[dict],
    focus_chokepoints: Optional[set[str]] = None,
) -> dict[str, tuple[str, str]]:
    """url → (plainEnglish, notImplied) for every article.

    Every article gets an entry: model prose where it earned a call, template
    text otherwise. Never raises — enrichment failing must not cost a signal.
    """
    result = templates(articles)

    if not llm_client.llm_enabled() or not articles:
        return result

    targets = _priority(articles, focus_chokepoints)
    if not targets:
        return result

    logger.info(
        "enriching %d/%d signals via %s", len(targets), len(articles), llm_client.provider()
    )

    applied = 0
    for start in range(0, len(targets), BATCH_SIZE):
        batch = targets[start : start + BATCH_SIZE]
        try:
            polished = _call_claude(batch)
        except Exception as e:
            # Templates are already in `result` — nothing is lost, this batch
            # just ships the flatter prose.
            logger.warning("enrichment batch failed, using templates: %s", e)
            continue
        for idx, item in polished.items():
            plain, not_implied = item.get("plainEnglish"), item.get("notImplied")
            if plain and not_implied:
                result[batch[idx]["url"]] = (plain, not_implied)
                applied += 1

    logger.info("enrichment applied to %d/%d signals", applied, len(targets))
    return result
