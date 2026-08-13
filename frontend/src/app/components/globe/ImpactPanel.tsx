/**
 * ImpactPanel — the right-hand answer to "which of my ships care?"
 *
 * Reads GET /api/impact: deterministic rules watch every sweep for free and
 * report nothing on a quiet feed; only a real cluster escalates to Claude.
 * The panel says which tier answered, because a reasoned judgement and a
 * rule default are not the same claim.
 *
 * Restraint is the design. Colour is reserved for two jobs — urgency, and the
 * sign of a delta — because an operator scanning this under pressure should
 * be able to tell "act now" from "note it" without reading. Everything else
 * is the same greys as the rest of the terminal. Numbers get tabular figures
 * so columns line up; nothing blinks; nothing gradients.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Ship, ChevronRight, Radio, Cpu, ListFilter } from 'lucide-react';
import type { AffectedVoyage, ImpactAssessment, Urgency } from '../../../data/types';
import { getImpact } from '../../../lib/api';
import { PANEL, hexAlpha } from './constants';

const REFRESH_MS = 90_000;

/** The globe's escalation hues, darkened one step for the paper surface —
 *  the marker orange that reads on a dark sphere washes out on ivory.
 *  Same family, same order, so the two surfaces stay one language. */
const URGENCY: Record<Urgency, { label: string; color: string }> = {
  immediate: { label: 'Immediate', color: PANEL.bad },
  monitor: { label: 'Monitor', color: PANEL.warn },
  informational: { label: 'FYI', color: PANEL.inkMuted },
};

/** Positive delta = the alternative costs more. Red for worse, teal for better,
 *  muted for zero — the only other place colour is allowed to speak. */
function deltaColor(v: number, lowerIsBetter = true): string {
  if (v === 0) return PANEL.inkMuted;
  const worse = lowerIsBetter ? v > 0 : v < 0;
  return worse ? PANEL.bad : PANEL.good;
}

function fmtSigned(v: number, unit = '', digits = 0): string {
  const s = v > 0 ? '+' : '';
  return `${s}${v.toFixed(digits)}${unit}`;
}

function fmtUsd(v: number): string {
  const abs = Math.abs(v);
  const s = v > 0 ? '+' : v < 0 ? '−' : '';
  if (abs >= 1000) return `${s}$${(abs / 1000).toFixed(0)}k`;
  return `${s}$${abs}`;
}

const label: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: PANEL.label,
};

const mono = "'JetBrains Mono', ui-monospace, monospace";

interface Props {
  selectedVoyageId: string | null;
  onSelect: (v: AffectedVoyage | null) => void;
}

export function ImpactPanel({ selectedVoyageId, onSelect }: Props) {
  const [data, setData] = useState<ImpactAssessment | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getImpact().then((d) => {
        if (!cancelled) setData(d);
      });
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (!data) return null;

  // A quiet feed is a real answer, not an empty state to apologise for.
  if (!data.anomaly || data.affected.length === 0) {
    return (
      <Shell>
        <div style={{ padding: '18px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Radio size={13} style={{ color: PANEL.accent, marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 12, color: PANEL.inkSoft, lineHeight: 1.5 }}>
              No corridor is loud enough to escalate.
            </div>
            <div style={{ fontSize: 11, color: PANEL.inkMuted, marginTop: 4, lineHeight: 1.5 }}>
              Rules are watching every sweep. Nothing crosses the threshold, so
              no model call is made.
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  const { anomaly, affected, reasoning } = data;

  return (
    <Shell>
      {/* anomaly header — what fired */}
      <div style={{ padding: '13px 15px', borderBottom: `1px solid ${PANEL.divider}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
          <AlertTriangle size={12} style={{ color: PANEL.maroon }} />
          <span style={{ ...label, color: PANEL.ink, letterSpacing: '0.1em' }}>
            {anomaly.corridor}
          </span>
          <ReasoningChip reasoning={reasoning} />
        </div>
        <div style={{ fontSize: 11, color: PANEL.inkMuted, lineHeight: 1.55 }}>
          {anomaly.signalCount} corroborated signals across {anomaly.distinctSources}{' '}
          independent sources · peak {anomaly.peakSeverity}
        </div>
      </div>

      {/* affected list */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {affected.map((v) => (
          <VoyageRow
            key={v.voyageId}
            voyage={v}
            selected={v.voyageId === selectedVoyageId}
            onSelect={() => onSelect(v.voyageId === selectedVoyageId ? null : v)}
          />
        ))}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <motion.aside
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        width: PANEL.width,
        maxHeight: 'calc(100% - 100px)',
        display: 'flex',
        flexDirection: 'column',
        background: PANEL.surface,
        border: `1px solid ${PANEL.border}`,
        borderRadius: 10,
        overflow: 'hidden',
        zIndex: 5,
      }}
    >
      {/* accent hairline — the panel's only ornament */}
      <div style={{ height: 2, background: PANEL.edge, flexShrink: 0 }} />
      <div
        style={{
          padding: '11px 14px',
          borderBottom: `1px solid ${PANEL.divider}`,
          display: 'flex',
          alignItems: 'center',
          gap: 7,
        }}
      >
        <ListFilter size={11} style={{ color: PANEL.label }} />
        <span style={label}>Fleet impact</span>
      </div>
      {children}
    </motion.aside>
  );
}

/** Says whether a judgement was reasoned or defaulted. Not decoration —
 *  a rule fallback and a model assessment are different epistemic claims. */
function ReasoningChip({ reasoning }: { reasoning: 'rules' | 'claude' }) {
  const isClaude = reasoning === 'claude';
  const color = isClaude ? PANEL.maroon : PANEL.inkMuted;
  return (
    <span
      title={
        isClaude
          ? 'Escalated to Claude — judgement, not a default'
          : 'Rule tier only — lowest-risk alternative, no reasoning applied'
      }
      style={{
        marginLeft: 'auto',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color,
        padding: '2px 6px',
        borderRadius: 999,
        border: `1px solid ${hexAlpha(color, 0.3)}`,
        background: hexAlpha(color, 0.08),
      }}
    >
      <Cpu size={8} />
      {isClaude ? 'reasoned' : 'rules'}
    </span>
  );
}

function VoyageRow({
  voyage,
  selected,
  onSelect,
}: {
  voyage: AffectedVoyage;
  selected: boolean;
  onSelect: () => void;
}) {
  const u = URGENCY[voyage.urgency];
  const d = voyage.delta;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      style={{
        padding: '12px 15px',
        borderBottom: `1px solid ${PANEL.divider}`,
        cursor: 'pointer',
        background: selected ? PANEL.rowActive : 'transparent',
        borderLeft: `2px solid ${selected ? PANEL.accent : 'transparent'}`,
        transition: 'background 140ms ease, border-color 140ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: 999,
            background: u.color,
            flexShrink: 0,
          }}
        />
        <Ship size={11} style={{ color: PANEL.inkMuted, flexShrink: 0 }} />
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: PANEL.ink,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {voyage.vesselName}
        </span>
        <span style={{ ...label, color: u.color, marginLeft: 'auto', flexShrink: 0 }}>
          {u.label}
        </span>
        <ChevronRight
          size={12}
          style={{
            color: PANEL.inkMuted,
            flexShrink: 0,
            transform: selected ? 'rotate(90deg)' : 'none',
            transition: 'transform 160ms ease',
          }}
        />
      </div>

      <div style={{ fontSize: 10, color: PANEL.inkMuted, marginTop: 4, paddingLeft: 19 }}>
        {voyage.originPort} → {voyage.destinationPort} · {voyage.progressPct}%
      </div>

      <p
        style={{
          fontSize: 11,
          color: PANEL.inkSoft,
          lineHeight: 1.5,
          margin: '7px 0 0',
          paddingLeft: 19,
        }}
      >
        {voyage.why}
      </p>

      {d ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6,
            marginTop: 9,
            paddingLeft: 19,
          }}
        >
          <Metric label="ETA" value={fmtSigned(d.etaDays, 'd', 1)} color={deltaColor(d.etaDays)} />
          <Metric label="Fuel" value={fmtUsd(d.fuelUsd)} color={deltaColor(d.fuelUsd)} />
          <Metric label="CO₂" value={fmtSigned(d.co2Pct, '%', 1)} color={deltaColor(d.co2Pct)} />
          <Metric
            label="Risk"
            value={fmtSigned(d.riskScore)}
            color={deltaColor(d.riskScore)}
          />
        </div>
      ) : (
        <div
          style={{
            fontSize: 10,
            color: PANEL.inkMuted,
            marginTop: 8,
            paddingLeft: 19,
            fontStyle: 'italic',
          }}
        >
          No alternative route modelled — speed, timing or escort only.
        </div>
      )}
    </div>
  );
}

function Metric({ label: l, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ ...label, fontSize: 8, marginBottom: 2 }}>{l}</div>
      <div style={{ fontSize: 11, fontFamily: mono, color, fontWeight: 500 }}>{value}</div>
    </div>
  );
}
