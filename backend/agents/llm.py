"""
Optional LLM narration for agent events.

If any LLM provider is configured (AWS Bedrock via ABSK key, or the Anthropic
API -- see llm_client.py), event narratives are polished by Claude in a single
call per pipeline run. Numbers are never delegated to the model -- they come
from the deterministic tools; the LLM only rewrites the prose. On ANY failure
(no provider, network, quota, malformed output) we fall back silently to the
template narratives, so the demo never depends on connectivity.
"""

from __future__ import annotations

import json
import logging

import llm_client

logger = logging.getLogger(__name__)

TIMEOUT_S = 30.0

SYSTEM_PROMPT = (
    "You are the narration layer of OceanMind, a maritime multi-agent decision "
    "engine. You receive a JSON array of agent timeline events, each with an id, "
    "title and detail. Rewrite ONLY the `detail` field of each event to be crisp, "
    "confident, operations-room prose. NEVER change any number, id, unit, "
    "percentage or currency figure. Return ONLY a JSON array of objects with "
    "`id` and `detail` keys -- no markdown, no commentary."
)


def narration_enabled() -> bool:
    return llm_client.llm_enabled()


def polish_details(events: list[dict]) -> dict[str, str]:
    """Return {event_id: polished_detail}. Empty dict -> keep templates."""
    if not llm_client.llm_enabled():
        return {}
    try:
        body = llm_client.messages_request(
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": json.dumps(
                        [
                            {"id": e["id"], "title": e["title"], "detail": e["detail"]}
                            for e in events
                        ]
                    ),
                }
            ],
            max_tokens=8000,
            timeout=TIMEOUT_S,
        )
        if body.get("stop_reason") == "refusal":
            return {}
        parsed = json.loads(llm_client.response_text(body))
        return {
            item["id"]: item["detail"]
            for item in parsed
            if isinstance(item, dict) and item.get("id") and item.get("detail")
        }
    except Exception:
        # Graceful fallback -- template narratives are already good.
        logger.debug("narration polish failed; keeping templates", exc_info=True)
        return {}
