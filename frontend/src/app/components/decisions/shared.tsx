/**
 * Shared visual vocabulary for the Decisions area — status/reliability/
 * severity metadata, delta formatting and tiny presentational atoms.
 * Pure presentation: all domain types come from src/data/types.ts.
 */

import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ShieldCheck,
  Eye,
  AlertTriangle,
  HelpCircle,
  Hourglass,
  CheckCircle2,
  PenLine,
  Archive,
  RadioTower,
  Calculator,
  Scale,
  TrendingUp,
  History,
} from 'lucide-react';
import type { ReliabilityStatus, Decision, EvidenceItem } from '../../../data/types';

/* ── Palette (mirrors src/styles/theme.css tokens) ─────────────────────── */

export const C = {
  text: '#EAF4FF',
  textSecondary: '#BFD7F7',
  muted: '#8BA8C8',
  faint: '#5A8AB4',
  teal: '#2DD4BF',
  green: '#00D47E',
  amber: '#E8A043',
  red: '#C75A5A',
  slate: '#7E8BA3',
  sky: '#38BDF8',
  cardBg: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
  cardBorder: '1px solid rgba(255,255,255,0.09)',
  mono: "'JetBrains Mono', 'SF Mono', ui-monospace, monospace",
} as const;

/* ── Reliability gate meta ─────────────────────────────────────────────── */

export const RELIABILITY_META: Record<
  ReliabilityStatus,
  { label: string; color: string; bg: string; border: string; icon: LucideIcon }
> = {
  READY: {
    label: 'READY',
    color: '#00D47E',
    bg: 'rgba(0,212,126,0.08)',
    border: 'rgba(0,212,126,0.30)',
    icon: ShieldCheck,
  },
  REVIEW: {
    label: 'REVIEW',
    color: '#E8A043',
    bg: 'rgba(232,160,67,0.08)',
    border: 'rgba(232,160,67,0.30)',
    icon: Eye,
  },
  ESCALATE: {
    label: 'ESCALATE',
    color: '#C75A5A',
    bg: 'rgba(199,90,90,0.10)',
    border: 'rgba(199,90,90,0.35)',
    icon: AlertTriangle,
  },
  INSUFFICIENT_EVIDENCE: {
    label: 'INSUFFICIENT EVIDENCE',
    color: '#7E8BA3',
    bg: 'rgba(126,139,163,0.08)',
    border: 'rgba(126,139,163,0.30)',
    icon: HelpCircle,
  },
};

/* ── Decision status meta ──────────────────────────────────────────────── */

export const STATUS_META: Record<
  Decision['status'],
  { label: string; color: string; bg: string; border: string; icon: LucideIcon }
> = {
  pending: {
    label: 'Pending',
    color: '#E8A043',
    bg: 'rgba(232,160,67,0.08)',
    border: 'rgba(232,160,67,0.28)',
    icon: Hourglass,
  },
  approved: {
    label: 'Approved',
    color: '#00D47E',
    bg: 'rgba(0,212,126,0.08)',
    border: 'rgba(0,212,126,0.28)',
    icon: CheckCircle2,
  },
  overridden: {
    label: 'Overridden',
    color: '#38BDF8',
    bg: 'rgba(56,189,248,0.08)',
    border: 'rgba(56,189,248,0.28)',
    icon: PenLine,
  },
  expired: {
    label: 'Expired',
    color: '#7E8BA3',
    bg: 'rgba(126,139,163,0.08)',
    border: 'rgba(126,139,163,0.26)',
    icon: Archive,
  },
};

/* ── Severity accent colors ────────────────────────────────────────────── */

export const SEVERITY_COLOR: Record<Decision['severity'], string> = {
  low: '#7E8BA3',
  medium: '#38BDF8',
  high: '#E8A043',
  critical: '#C75A5A',
};

/* ── Evidence kind meta ────────────────────────────────────────────────── */

export const EVIDENCE_KIND_META: Record<
  EvidenceItem['kind'],
  { label: string; color: string; icon: LucideIcon }
> = {
  signal: { label: 'Signal', color: '#38BDF8', icon: RadioTower },
  calculation: { label: 'Deterministic calc', color: '#2DD4BF', icon: Calculator },
  regulation: { label: 'Regulation', color: '#E8A043', icon: Scale },
  market: { label: 'Market', color: '#5EEAD4', icon: TrendingUp },
  historical: { label: 'Historical', color: '#8BA8C8', icon: History },
};

/* ── Formatters ────────────────────────────────────────────────────────── */

/** +180 h → "+7.5 d" · -12 → "−0.5 d" · 0 → "on schedule" */
export function fmtEtaDelta(hours: number): string {
  if (hours === 0) return '±0 d';
  const days = hours / 24;
  const val = Math.abs(days) >= 1 ? days.toFixed(1) : days.toFixed(2);
  return `${days > 0 ? '+' : '−'}${Math.abs(Number(val))} d`;
}

/** 182000 → "+$182k" · -58000 → "−$58k" */
export function fmtUsdDelta(usd: number): string {
  if (usd === 0) return '$0';
  const abs = Math.abs(usd);
  const s =
    abs >= 1_000_000
      ? `$${(abs / 1_000_000).toFixed(1)}M`
      : abs >= 1_000
        ? `$${Math.round(abs / 1_000)}k`
        : `$${abs}`;
  return `${usd > 0 ? '+' : '−'}${s}`;
}

/** 5.9 → "+5.9%" */
export function fmtPctDelta(pct: number): string {
  if (pct === 0) return '±0%';
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%`;
}

/** 530 → "+530 t" */
export function fmtTonnesDelta(t: number): string {
  if (t === 0) return '±0 t';
  return `${t > 0 ? '+' : '−'}${Math.abs(t).toLocaleString()} t`;
}

/** Color for a cost-like delta: positive = red-ish cost, negative = green saving. */
export function deltaColor(value: number): string {
  if (value > 0) return C.red;
  if (value < 0) return C.green;
  return C.muted;
}

export function fmtUtc(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  return `${day} · ${time} UTC`;
}

export function fmtAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Deterministic hash-like id for the signed audit line (demo-grade). */
export function auditHash(seed: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const a = (h >>> 0).toString(16).padStart(8, '0');
  let h2 = 0x1505;
  for (let i = 0; i < seed.length; i++) h2 = (Math.imul(h2, 33) ^ seed.charCodeAt(i)) >>> 0;
  const b = h2.toString(16).padStart(8, '0');
  return `0x${a}${b}`;
}

/* ── Tiny atoms ────────────────────────────────────────────────────────── */

const pillBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '3px 9px',
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

export function ReliabilityBadge({ status, compact }: { status: ReliabilityStatus; compact?: boolean }) {
  const meta = RELIABILITY_META[status];
  const Icon = meta.icon;
  return (
    <span
      style={{
        ...pillBase,
        color: meta.color,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
      }}
    >
      <Icon size={11} strokeWidth={2.2} />
      {compact && status === 'INSUFFICIENT_EVIDENCE' ? 'INSUFFICIENT' : meta.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: Decision['status'] }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      style={{
        ...pillBase,
        color: meta.color,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
      }}
    >
      <Icon size={11} strokeWidth={2.2} />
      {meta.label}
    </span>
  );
}

/** Small metric chip used on queue rows: icon + value, tinted by sign. */
export function ImpactChip({
  icon: Icon,
  value,
  title,
  tone = 'neutral',
}: {
  icon: LucideIcon;
  value: string;
  title: string;
  tone?: 'good' | 'bad' | 'neutral';
}) {
  const color = tone === 'good' ? C.green : tone === 'bad' ? C.red : C.muted;
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 8px',
        borderRadius: 7,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: C.mono,
        color,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={11} strokeWidth={2} style={{ color: C.faint }} />
      {value}
    </span>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        color: C.faint,
        textTransform: 'uppercase',
        letterSpacing: '0.16em',
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}
