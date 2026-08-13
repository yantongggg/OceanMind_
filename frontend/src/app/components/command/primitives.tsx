/**
 * Command Center primitives — shared panel chrome, status metadata and
 * formatters used across the dashboard panels. Owned by the command page.
 */
import type { CSSProperties, ReactNode } from 'react';
import type { ReliabilityStatus, Severity, VoyageStatus } from '../../../data/types';

export const MONO = "'JetBrains Mono', monospace";
export const ACCENT = '#2DD4BF';

/* ── Status metadata ─────────────────────────────────────────────────── */

export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: '#FF5A5A',
  high: '#FFB84D',
  medium: '#38BDF8',
  low: '#7A94B4',
};

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const RELIABILITY_META: Record<ReliabilityStatus, { label: string; color: string }> = {
  READY: { label: 'READY', color: '#00D47E' },
  REVIEW: { label: 'REVIEW', color: '#E8A043' },
  ESCALATE: { label: 'ESCALATE', color: '#FF5A5A' },
  INSUFFICIENT_EVIDENCE: { label: 'INSUFFICIENT EVIDENCE', color: '#7A94B4' },
};

export const VOYAGE_STATUS_META: Record<VoyageStatus, { label: string; color: string }> = {
  underway: { label: 'Underway', color: '#2DD4BF' },
  at_anchor: { label: 'At anchor', color: '#7A94B4' },
  in_port: { label: 'In port', color: '#38BDF8' },
  rerouted: { label: 'Rerouted', color: '#38BDF8' },
  delayed: { label: 'Delayed', color: '#FFB84D' },
  completed: { label: 'Completed', color: '#00D47E' },
};

/* ── Formatters ──────────────────────────────────────────────────────── */

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** Compact USD: 3427000 → "$3.43M", 182000 → "$182k". */
export function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`;
  return `${sign}$${fmtInt(abs)}`;
}

/** Signed compact USD for impact deltas: +$182k / −$34k. */
export function fmtSignedUsd(n: number): string {
  if (n === 0) return '$0';
  return `${n > 0 ? '+' : ''}${fmtUsd(n)}`;
}

/** Hours delta → "+7.5 d" / "+18 h" / "On time" / "−6 h". */
export function fmtEtaDelta(hours: number): string {
  if (hours === 0) return 'On time';
  const sign = hours > 0 ? '+' : '−';
  const abs = Math.abs(hours);
  if (abs >= 48) return `${sign}${(abs / 24).toFixed(1)} d`;
  return `${sign}${Math.round(abs)} h`;
}

/** Relative time — "4 min ago", "6 h ago", "2 d ago". */
export function timeAgo(iso: string, nowMs: number): string {
  const delta = Math.max(0, nowMs - new Date(iso).getTime());
  const min = Math.floor(delta / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.floor(hrs / 24);
  return `${days} d ago`;
}

/* ── Panel chrome ────────────────────────────────────────────────────── */

interface SectionPanelProps {
  title: string;
  icon?: ReactNode;
  /** Small muted line under / beside the title. */
  meta?: ReactNode;
  /** Right-aligned header slot (links, chips). */
  action?: ReactNode;
  children: ReactNode;
  /** Remove body padding (tables handle their own). */
  flush?: boolean;
  style?: CSSProperties;
  bodyStyle?: CSSProperties;
}

/** Matte panel with an ops-terminal header — the dashboard building block. */
export function SectionPanel({ title, icon, meta, action, children, flush, style, bodyStyle }: SectionPanelProps) {
  return (
    <section className="premium-glass-card" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, ...style }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '13px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {icon && (
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(45,212,191,0.09)',
                border: '1px solid rgba(45,212,191,0.22)',
                color: ACCENT,
                flexShrink: 0,
              }}
            >
              {icon}
            </span>
          )}
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: '#EAF4FF',
                letterSpacing: '0.01em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {title}
            </div>
            {meta && <div style={{ fontSize: 10, color: '#5A8AB4', marginTop: 1 }}>{meta}</div>}
          </div>
        </div>
        {action}
      </header>
      <div style={{ flex: 1, minHeight: 0, padding: flush ? 0 : '14px 18px', ...bodyStyle }}>{children}</div>
    </section>
  );
}

/** Tiny uppercase status pill with a leading dot. */
export function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 9px',
        borderRadius: 999,
        background: `${color}14`,
        border: `1px solid ${color}38`,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color }}>
        {label}
      </span>
    </span>
  );
}

/** Header-slot link chip: "Open globe →". */
export function PanelLink({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        color: ACCENT,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
