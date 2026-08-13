/**
 * VoyageFocusPanel — one ship, one decision, in one screen.
 *
 * Replaces the impact list when a voyage is picked. The globe has already
 * flown to the vessel and drawn both routes; this panel carries everything
 * the geometry can't say — why it matters, what switching costs, and the
 * reporting the judgement rests on.
 *
 * Layout is a deliberate argument order: the mechanism of risk, then the
 * proposal, then its price, then the evidence. An operator who stops reading
 * after the first two lines has still got the decision.
 *
 * Colour does exactly two jobs, as in the list: urgency, and whether a number
 * is worse or better. The route swatches borrow the same greys and teal the
 * globe draws with, so the panel and the sphere are visibly one system —
 * muted line = what you're doing, teal line = what's proposed.
 */

import { motion } from 'motion/react';
import {
  ArrowLeft,
  Ship,
  Route as RouteIcon,
  Newspaper,
  ArrowUpRight,
  Cpu,
} from 'lucide-react';
import type { AffectedVoyage, Urgency } from '../../../data/types';
import { PANEL, hexAlpha } from './constants';

/** Globe escalation hues, darkened for the ivory surface — see ImpactPanel. */
const URGENCY: Record<Urgency, { label: string; color: string }> = {
  immediate: { label: 'Immediate', color: PANEL.bad },
  monitor: { label: 'Monitor', color: PANEL.warn },
  informational: { label: 'FYI', color: PANEL.inkMuted },
};

const CURRENT_LINE = '#8BA8C8';
/* On the dark surface the swatch can match the globe's proposal line exactly
 * — same teal, no translation needed. (It was darkened for the ivory panel
 * iteration, where bright teal had no contrast.) */
const SUGGESTED_SWATCH = '#2DD4BF';
const mono = "'JetBrains Mono', ui-monospace, monospace";

const label: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: PANEL.label,
};

function deltaColor(v: number): string {
  if (v === 0) return PANEL.inkMuted;
  return v > 0 ? PANEL.bad : PANEL.good;
}

function fmtUsd(v: number): string {
  const abs = Math.abs(v);
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return abs >= 1000 ? `${sign}$${(abs / 1000).toFixed(0)}k` : `${sign}$${abs}`;
}

interface Props {
  voyage: AffectedVoyage;
  onBack: () => void;
}

export function VoyageFocusPanel({ voyage, onBack }: Props) {
  const u = URGENCY[voyage.urgency];
  const d = voyage.delta;

  return (
    <motion.aside
      initial={{ opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
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
        zIndex: 6,
      }}
    >
      <div style={{ height: 2, background: PANEL.edge, flexShrink: 0 }} />

      {/* header */}
      <div style={{ padding: '11px 14px', borderBottom: `1px solid ${PANEL.divider}` }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            ...label,
            color: PANEL.label,
          }}
        >
          <ArrowLeft size={11} />
          Fleet impact
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {/* vessel identity */}
        <div style={{ padding: '13px 14px', borderBottom: `1px solid ${PANEL.divider}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Ship size={13} style={{ color: PANEL.accent }} />
            <span style={{ fontSize: 14, fontWeight: 500, color: PANEL.ink }}>
              {voyage.vesselName}
            </span>
            <span style={{ ...label, color: u.color, marginLeft: 'auto' }}>{u.label}</span>
          </div>
          <div style={{ fontSize: 10, color: PANEL.inkMuted, marginTop: 5 }}>
            {voyage.vesselType} · {voyage.cargo}
          </div>
          <div style={{ fontSize: 11, color: PANEL.inkSoft, marginTop: 6 }}>
            {voyage.originPort} → {voyage.destinationPort}
            <span style={{ color: PANEL.inkMuted }}> · {voyage.progressPct}% complete</span>
          </div>
        </div>

        {/* why — the mechanism */}
        <Section icon={<Cpu size={10} />} title="Why this ship">
          <p style={{ fontSize: 12, color: PANEL.inkSoft, lineHeight: 1.6, margin: 0 }}>
            {voyage.why}
          </p>
          <div
            style={{
              fontSize: 9,
              color: PANEL.maroon,
              marginTop: 7,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {voyage.reasoning === 'claude'
              ? 'Assessed by Claude'
              : 'Rule tier — no reasoning applied'}
          </div>
        </Section>

        {/* routes */}
        <Section icon={<RouteIcon size={10} />} title="Routing">
          <RouteRow
            swatch={CURRENT_LINE}
            dashed={false}
            caption="Current"
            label={voyage.currentRoute?.label ?? '—'}
            via={voyage.currentRoute?.viaChokepoints ?? []}
          />
          {voyage.suggestedRoute ? (
            <div style={{ marginTop: 10 }}>
              <RouteRow
                swatch={SUGGESTED_SWATCH}
                dashed
                caption="Suggested"
                label={voyage.suggestedRoute.label}
                via={voyage.suggestedRoute.viaChokepoints}
              />
            </div>
          ) : (
            voyage.hasAlternatives && (
              <p
                style={{
                  fontSize: 11,
                  color: PANEL.inkMuted,
                  lineHeight: 1.55,
                  margin: '10px 0 0',
                  fontStyle: 'italic',
                }}
              >
                Holding the current plan is the recommendation.
              </p>
            )
          )}
          {/* `rationale` already explains a no-alternatives voyage — printing a
              second sentence to the same effect just made the panel repeat itself. */}
          <p style={{ fontSize: 11, color: PANEL.inkSoft, lineHeight: 1.55, margin: '10px 0 0' }}>
            {voyage.rationale}
          </p>
        </Section>

        {/* the price of switching */}
        {d && (
          <Section icon={<RouteIcon size={10} />} title="Cost to switch">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Figure label="ETA" value={`${d.etaDays > 0 ? '+' : ''}${d.etaDays.toFixed(1)} d`} color={deltaColor(d.etaDays)} />
              <Figure label="Distance" value={`${d.distanceNm > 0 ? '+' : ''}${d.distanceNm.toLocaleString()} nm`} color={deltaColor(d.distanceNm)} />
              <Figure label="Fuel cost" value={fmtUsd(d.fuelUsd)} color={deltaColor(d.fuelUsd)} />
              <Figure label="Fuel burn" value={`${d.fuelTonnes > 0 ? '+' : ''}${d.fuelTonnes.toFixed(1)} t`} color={deltaColor(d.fuelTonnes)} />
              <Figure
                label="CO₂"
                value={`${d.co2Tonnes > 0 ? '+' : ''}${d.co2Tonnes.toFixed(1)} t · ${d.co2Pct > 0 ? '+' : ''}${d.co2Pct.toFixed(1)}%`}
                color={deltaColor(d.co2Tonnes)}
              />
              <Figure label="Risk score" value={`${d.riskScore > 0 ? '+' : ''}${d.riskScore}`} color={deltaColor(d.riskScore)} />
            </div>
            <div style={{ fontSize: 9, color: PANEL.inkMuted, marginTop: 10, lineHeight: 1.5 }}>
              Computed from route data by deterministic tools — not model output.
            </div>
          </Section>
        )}

        {/* the evidence */}
        {voyage.signals.length > 0 && (
          <Section icon={<Newspaper size={10} />} title={`Evidence · ${voyage.signalIds.length}`}>
            {voyage.signals.map((s) => (
              <a
                key={s.id}
                href={s.url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  padding: '8px 0',
                  borderTop: `1px solid ${PANEL.divider}`,
                }}
              >
                <div style={{ fontSize: 11, color: PANEL.inkSoft, lineHeight: 1.45 }}>
                  {s.title}
                  {s.url && (
                    <ArrowUpRight
                      size={9}
                      style={{ color: PANEL.accent, marginLeft: 4, verticalAlign: 'middle' }}
                    />
                  )}
                </div>
                <div style={{ fontSize: 9, color: PANEL.inkMuted, marginTop: 3 }}>
                  {s.source} · ×{s.corroboration} sources
                </div>
              </a>
            ))}
          </Section>
        )}
      </div>
    </motion.aside>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ padding: '13px 14px', borderBottom: `1px solid ${PANEL.divider}` }}>
      <div style={{ ...label, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 9 }}>
        <span style={{ color: PANEL.label, display: 'flex' }}>{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function RouteRow({
  swatch,
  dashed,
  caption,
  label: routeLabel,
  via,
}: {
  swatch: string;
  dashed: boolean;
  caption: string;
  label: string;
  via: string[];
}) {
  return (
    <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
      {/* mirrors how the globe draws it: solid = current, dashed = proposed */}
      <span
        style={{
          width: 16,
          height: 2,
          marginTop: 6,
          flexShrink: 0,
          background: dashed
            ? `repeating-linear-gradient(90deg, ${swatch} 0 4px, transparent 4px 7px)`
            : swatch,
          opacity: dashed ? 1 : 0.5,
        }}
      />
      <div style={{ minWidth: 0 }}>
        <div style={{ ...label, fontSize: 8, marginBottom: 2 }}>{caption}</div>
        <div style={{ fontSize: 12, color: PANEL.ink, lineHeight: 1.4 }}>{routeLabel}</div>
        {via.length > 0 && (
          <div style={{ fontSize: 10, color: PANEL.inkMuted, marginTop: 3 }}>
            via {via.join(' · ')}
          </div>
        )}
      </div>
    </div>
  );
}

function Figure({ label: l, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ ...label, fontSize: 8, marginBottom: 3 }}>{l}</div>
      <div style={{ fontSize: 13, fontFamily: mono, color, fontWeight: 500 }}>{value}</div>
    </div>
  );
}
