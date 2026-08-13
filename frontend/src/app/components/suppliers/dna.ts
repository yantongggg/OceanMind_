/**
 * Supplier DNA — scoring helpers shared by the cards and the detail drawer.
 *
 * The composite DNA score is a weighted blend of the five sub-scores from
 * the shared Supplier type. Weights mirror how the Decision Agent ranks
 * bunker suppliers (reliability first, price last — this is a risk
 * platform, not a procurement auction).
 */

import type { Supplier, Severity } from '../../../data/types';

/** Weighted composite 0–100. */
export function dnaScore(s: Supplier): number {
  return Math.round(
    s.reliability * 0.3 +
      s.fuelQuality * 0.25 +
      s.esgScore * 0.2 +
      s.altFuelReadiness * 0.15 +
      s.priceCompetitiveness * 0.1,
  );
}

export interface DnaTier {
  label: string;
  color: string;
  soft: string;   // translucent fill for chips/rings
  border: string;
}

export function dnaTier(score: number): DnaTier {
  if (score >= 88)
    return { label: 'Elite', color: '#2DD4BF', soft: 'rgba(45,212,191,0.12)', border: 'rgba(45,212,191,0.35)' };
  if (score >= 78)
    return { label: 'Strong', color: '#38BDF8', soft: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.32)' };
  if (score >= 62)
    return { label: 'Watch', color: '#E8A043', soft: 'rgba(232,160,67,0.12)', border: 'rgba(232,160,67,0.32)' };
  return { label: 'Risk', color: '#C75A5A', soft: 'rgba(199,90,90,0.14)', border: 'rgba(199,90,90,0.38)' };
}

/** Sub-score display order + labels (keys of Supplier). */
export const SUB_SCORES = [
  { key: 'reliability', label: 'Reliability', hint: 'On-spec, on-time delivery record' },
  { key: 'fuelQuality', label: 'Fuel Quality', hint: 'Lab-test conformance history' },
  { key: 'esgScore', label: 'ESG', hint: 'Emissions transparency · labour · governance' },
  { key: 'altFuelReadiness', label: 'Alt-Fuel Ready', hint: 'Biofuel / methanol / LNG capability' },
  { key: 'priceCompetitiveness', label: 'Price', hint: 'vs port benchmark' },
] as const;

export type SubScoreKey = (typeof SUB_SCORES)[number]['key'];

export function severityColor(sev: Severity): string {
  switch (sev) {
    case 'critical': return '#C75A5A';
    case 'high': return '#E8795A';
    case 'medium': return '#E8A043';
    default: return '#8BA8C8';
  }
}

/* ── Deterministic 12-month trend series for the sparkline ─────────────
 * No trend data in the contract, so we derive a plausible history that
 * ends exactly at today's composite: incident-free suppliers trend up,
 * incident-heavy ones trend down, with seeded jitter so each supplier's
 * line has its own character but is stable across renders. */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface TrendPoint { month: string; score: number }

const MONTHS = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];

export function dnaTrend(s: Supplier): TrendPoint[] {
  const end = dnaScore(s);
  const drift = s.incidents.length === 0 ? -7 : 4 + s.incidents.length * 2.5; // start offset
  const start = Math.min(99, Math.max(20, end + drift));
  const rand = mulberry32(hashId(s.id));
  const pts: TrendPoint[] = [];
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const base = start + (end - start) * t;
    const jitter = i === 11 ? 0 : (rand() - 0.5) * 3.4;
    pts.push({ month: MONTHS[i], score: Math.round(Math.min(100, Math.max(0, base + jitter)) * 10) / 10 });
  }
  return pts;
}

/** True for the golden-scenario recommended supplier (DEC-0042). */
export function isGoldenSupplier(s: Supplier): boolean {
  return s.id === 'SUP-001';
}
