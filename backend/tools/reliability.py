"""
Reliability gate — evidence-completeness scoring.

The Decision Agent never ships a recommendation without passing it through
this gate. It maps a set of named evidence checks to one of four statuses
(mirrors `ReliabilityStatus` in the shared contract):

    READY                 evidence complete — safe for one-click approval
    REVIEW                human review advised (uncertainty above threshold)
    ESCALATE              conflicting authoritative inputs — a human must rule
    INSUFFICIENT_EVIDENCE do not act — evidence bar not met
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class EvidenceChecklist:
    """Inputs gathered by the Decision Agent for the gate."""

    min_corroboration: int = 0            # min independent sources per load-bearing claim
    calc_double_run_drift: float = 0.0    # deterministic tools re-run drift (must be 0)
    conflicting_authoritative: bool = False   # e.g. charterer policy vs flag state
    uncorroborated_primary_conflict: bool = False  # single source vs primary authority
    forecast_uncertainty_high: bool = False   # e.g. typhoon ensemble spread
    citations_current: bool = True
    supplier_verified: bool = True
    counterfactual_quantified: bool = True
    alternatives_documented: int = 0
    reversible_hours: float = 0.0         # window before the decision locks in
    notes: list[str] = field(default_factory=list)


# thresholds
MIN_SOURCES = 3
MIN_ALTERNATIVES = 2


def evaluate(c: EvidenceChecklist) -> tuple[str, str, list[str]]:
    """Return (status, note, passed_checks)."""

    # Hard stops first ----------------------------------------------------
    if c.conflicting_authoritative:
        return (
            "ESCALATE",
            "Conflicting authoritative inputs — a human officer must rule. "
            "No autonomous recommendation issued.",
            [],
        )
    if c.uncorroborated_primary_conflict:
        return (
            "INSUFFICIENT_EVIDENCE",
            "Single uncorroborated secondary report vs authoritative primary "
            "source — evidence-completeness gate blocks any action recommendation.",
            [],
        )

    checks = {
        f"signal corroboration ≥{MIN_SOURCES} sources": c.min_corroboration >= MIN_SOURCES,
        "deterministic calcs double-run, zero drift": c.calc_double_run_drift == 0.0,
        "no unresolved conflicting signals": not c.conflicting_authoritative,
        "regulatory citations current": c.citations_current,
        "supplier verification current": c.supplier_verified,
        "counterfactual quantified": c.counterfactual_quantified,
        f"≥{MIN_ALTERNATIVES} alternatives documented with rejection reasons":
            c.alternatives_documented >= MIN_ALTERNATIVES,
        "decision reversible (window open)": c.reversible_hours > 0,
    }
    passed = [name for name, ok in checks.items() if ok]

    if len(passed) < len(checks):
        failed = [name for name, ok in checks.items() if not ok]
        return (
            "REVIEW",
            f"Human review advised — {len(passed)}/{len(checks)} checks passed; "
            f"open items: {', '.join(failed)}.",
            passed,
        )
    if c.forecast_uncertainty_high:
        return (
            "REVIEW",
            "Human review advised — forecast uncertainty exceeds threshold; "
            "recommendation is safe-side, review on each forecast cycle.",
            passed,
        )
    return (
        "READY",
        f"Evidence complete — {len(passed)}/{len(checks)} checks passed: "
        "signal corroboration ≥3 sources, deterministic cost/carbon calcs "
        "reproduced twice, no conflicting signals, all regulatory citations current.",
        passed,
    )
