/**
 * ESG page — shared style tokens, chart palette and formatters.
 *
 * The categorical fuel palette below was validated (dark surface #0E1C2D)
 * for OKLCH lightness band, chroma floor, CVD adjacent-pair separation and
 * contrast — do not reorder hues per-render; color follows the fuel entity.
 */
/* ── Card / label idiom (matches scaffold pages) ─────────────────────── */

export const CARD: React.CSSProperties = {
  background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 14,
  boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
};

export const LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  color: '#5A8AB4',
};

export const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace";

/* ── Chart colors ────────────────────────────────────────────────────── */

export const CHART = {
  actual: '#2DD4BF',        // fleet actual emissions (primary accent)
  baseline: '#8BA8C8',      // no-optimisation baseline (muted reference)
  bar: '#14B8A6',           // single-series voyage bars
  grid: 'rgba(255,255,255,0.06)',
  tick: '#7FA5D3',
};

/** Fixed fuel → hue assignment (validated categorical palette). */
export const FUEL_MIX: { name: string; tonnes: number; color: string }[] = [
  { name: 'VLSFO', tonnes: 32150, color: '#0D9488' },
  { name: 'HFO (scrubber)', tonnes: 5690, color: '#B45309' },
  { name: 'MGO', tonnes: 4610, color: '#0284C7' },
  { name: 'LNG', tonnes: 2915, color: '#6366F1' },
  { name: 'Bio-blend B24', tonnes: 2140, color: '#16A34A' },
];

/* ── Status chips ────────────────────────────────────────────────────── */

export const STATUS_CHIP: Record<
  string,
  { bg: string; border: string; color: string; label: string }
> = {
  approved: { bg: 'rgba(0,212,126,0.10)', border: 'rgba(0,212,126,0.30)', color: '#00D47E', label: 'Approved' },
  pending: { bg: 'rgba(232,160,67,0.10)', border: 'rgba(232,160,67,0.30)', color: '#E8A043', label: 'Pending' },
  overridden: { bg: 'rgba(199,90,90,0.10)', border: 'rgba(199,90,90,0.32)', color: '#C75A5A', label: 'Overridden' },
  expired: { bg: 'rgba(139,168,200,0.08)', border: 'rgba(139,168,200,0.25)', color: '#8BA8C8', label: 'Expired' },
};

/* ── Formatters ──────────────────────────────────────────────────────── */

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** 3427000 → "$3.43M" · 18700 → "$18.7k" */
export function fmtUsdCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${fmtInt(abs)}`;
}

/** Signed numbers for delta cells: 530 → "+530" · -302 → "−302" */
export function fmtSigned(n: number, unit = ''): string {
  if (n === 0) return `0${unit}`;
  const sign = n > 0 ? '+' : '−';
  return `${sign}${fmtInt(Math.abs(n))}${unit}`;
}

export function fmtSignedUsd(n: number): string {
  if (n === 0) return '$0';
  const sign = n > 0 ? '+' : '−';
  return `${sign}$${fmtInt(Math.abs(n))}`;
}

/** Delta cell ink: savings (negative) green, costs (positive) amber. */
export function deltaColor(n: number): string {
  if (n < 0) return '#00D47E';
  if (n > 0) return '#E8A043';
  return '#8BA8C8';
}
