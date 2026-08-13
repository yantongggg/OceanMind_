"""
LLM gateway — one door to Claude, two providers behind it.

Every model call in this codebase (signal enrichment, impact assessment,
narration polish) goes through `messages_request()`. The provider is picked
from the environment:

  AWS_BEDROCK_API_KEY set (ABSK bearer token)  →  Amazon Bedrock
  else ANTHROPIC_API_KEY set                    →  api.anthropic.com

Bedrock wins when both are present — deliberately. This exists because the
Anthropic key on hand belongs to an account with no credit while the hackathon
issued a funded Bedrock key; preferring the configured Bedrock key means a
dead Anthropic key left in .env cannot silently shadow the working provider.

Both providers speak the same Messages shape: same `messages`/`system` in,
same `content`/`stop_reason` out. The differences are transport-level only —
Bedrock puts the anthropic_version in the body ("bedrock-2023-05-31") instead
of a header, takes the model id in the URL path, and authenticates with a
bearer token — so callers never need to know which provider answered.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional
from urllib.parse import quote

import httpx

logger = logging.getLogger(__name__)

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
ANTHROPIC_MODEL = "claude-sonnet-5"

BEDROCK_ANTHROPIC_VERSION = "bedrock-2023-05-31"
DEFAULT_TIMEOUT_S = 90.0


def _bedrock_config() -> Optional[dict]:
    key = (os.environ.get("AWS_BEDROCK_API_KEY") or "").strip()
    region = (os.environ.get("AWS_BEDROCK_REGION") or "").strip()
    model = (os.environ.get("AWS_BEDROCK_MODEL_ID") or "").strip()
    if key.startswith("ABSK") and region and model:
        return {"key": key, "region": region, "model": model}
    return None


def _anthropic_key() -> Optional[str]:
    key = (os.environ.get("ANTHROPIC_API_KEY") or "").strip()
    return key if key.startswith("sk-ant") else None


def provider() -> Optional[str]:
    """'bedrock' | 'anthropic' | None. Bedrock preferred — see module docs."""
    if _bedrock_config():
        return "bedrock"
    if _anthropic_key():
        return "anthropic"
    return None


def llm_enabled() -> bool:
    return provider() is not None


def messages_request(
    system: str,
    messages: list[dict],
    max_tokens: int,
    timeout: float = DEFAULT_TIMEOUT_S,
) -> dict[str, Any]:
    """One Messages call. Returns the parsed response body (Messages shape).

    Raises on transport errors and non-2xx — callers already have
    fall-back-to-template paths and decide what a failure costs. Error bodies
    are included in the exception text; a bare status code once cost an hour
    of debugging against a "Bad Request" that was actually an empty account.
    """
    which = provider()
    if which is None:
        raise RuntimeError("no LLM provider configured (need ABSK or sk-ant key)")

    if which == "bedrock":
        cfg = _bedrock_config()
        assert cfg is not None
        url = (
            f"https://bedrock-runtime.{cfg['region']}.amazonaws.com"
            f"/model/{quote(cfg['model'], safe='')}/invoke"
        )
        resp = httpx.post(
            url,
            headers={
                "Authorization": f"Bearer {cfg['key']}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            json={
                "anthropic_version": BEDROCK_ANTHROPIC_VERSION,
                "max_tokens": max_tokens,
                "system": system,
                "messages": messages,
            },
            timeout=timeout,
        )
    else:
        resp = httpx.post(
            ANTHROPIC_API_URL,
            headers={
                "x-api-key": _anthropic_key(),
                "anthropic-version": ANTHROPIC_VERSION,
                "content-type": "application/json",
            },
            json={
                "model": ANTHROPIC_MODEL,
                "max_tokens": max_tokens,
                "system": system,
                "messages": messages,
            },
            timeout=timeout,
        )

    if resp.status_code >= 400:
        raise ValueError(f"{which} HTTP {resp.status_code}: {resp.text[:300]}")
    return resp.json()


def response_text(body: dict[str, Any]) -> str:
    """Concatenated text blocks from a Messages response body."""
    return "".join(
        block.get("text", "")
        for block in body.get("content", [])
        if block.get("type") == "text"
    )
