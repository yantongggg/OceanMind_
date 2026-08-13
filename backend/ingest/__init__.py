"""
OceanMind live signal ingestion.

Turns real maritime reporting into `Signal` objects that the Detect stage
(agents/disruption.py) clusters into disruption events.

Design rules, learned the hard way from the donor implementation:

1. **No data is not a signal.** A source returning nothing means we know
   nothing — never an inference. Every adapter reports `available` and the
   engine skips unavailable sources rather than reading meaning into silence.
2. **Every live signal carries its `url`.** If it can't be traced to a real
   article, it doesn't ship. Provenance is the whole point.
3. **Golden data stays labelled.** Synthetic demo signals keep origin='golden'
   and never acquire a url, so they can't be mistaken for real reporting.
4. **Tools calculate, models narrate.** The LLM writes plainEnglish /
   notImplied prose; severity, geography and corroboration are deterministic.
"""
