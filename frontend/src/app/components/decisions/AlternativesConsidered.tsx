/**
 * "Alternatives considered" — the options the Decision Agent evaluated and
 * did NOT recommend, each with its rejection reason and a compact recharts
 * bar comparison against the recommended plan (per-metric normalised bars,
 * tooltip shows the real values).
 */

import { XCircle } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { Alternative, ImpactDelta } from '../../../data/types';
import {
  C,
  fmtEtaDelta,
  fmtTonnesDelta,
  fmtUsdDelta,
  SectionLabel,
} from './shared';

interface CompareRow {
  metric: string;
  rec: number; // normalised 0–100 magnitude
  alt: number;
  recLabel: string;
  altLabel: string;
  recRaw: number;
  altRaw: number;
}

function buildRows(rec: ImpactDelta, alt: ImpactDelta): CompareRow[] {
  const defs: { metric: string; r: number; a: number; fmt: (v: number) => string }[] = [
    { metric: 'ETA', r: rec.etaHours, a: alt.etaHours, fmt: fmtEtaDelta },
    { metric: 'Fuel $', r: rec.fuelUsd, a: alt.fuelUsd, fmt: fmtUsdDelta },
    { metric: 'CO₂', r: rec.co2Tonnes, a: alt.co2Tonnes, fmt: fmtTonnesDelta },
    { metric: 'Risk', r: rec.riskScore, a: alt.riskScore, fmt: (v) => `${v}` },
  ];
  return defs.map(({ metric, r, a, fmt }) => {
    const max = Math.max(Math.abs(r), Math.abs(a), 1e-9);
    return {
      metric,
      rec: (Math.abs(r) / max) * 100,
      alt: (Math.abs(a) / max) * 100,
      recLabel: fmt(r),
      altLabel: fmt(a),
      recRaw: r,
      altRaw: a,
    };
  });
}

function CompareTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: CompareRow }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div
      style={{
        background: 'rgba(7,17,31,0.97)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 8,
        padding: '8px 11px',
        fontSize: 11,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ color: C.faint, fontWeight: 700, marginBottom: 5, letterSpacing: '0.06em' }}>
        {row.metric}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: C.teal }}>
        <span>Recommended</span>
        <span style={{ fontFamily: C.mono, fontWeight: 700 }}>{row.recLabel}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: C.slate }}>
        <span>This option</span>
        <span style={{ fontFamily: C.mono, fontWeight: 700 }}>{row.altLabel}</span>
      </div>
    </div>
  );
}

function ImpactCompareChart({ rec, alt }: { rec: ImpactDelta; alt: ImpactDelta }) {
  const rows = buildRows(rec, alt);
  return (
    <div style={{ width: '100%', height: 128 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 2, right: 8, bottom: 2, left: 0 }}
          barGap={2}
        >
          <XAxis type="number" domain={[0, 108]} hide />
          <YAxis
            type="category"
            dataKey="metric"
            width={52}
            axisLine={false}
            tickLine={false}
            tick={{ fill: C.faint, fontSize: 10, fontWeight: 600 }}
          />
          <Tooltip content={<CompareTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="rec" name="Recommended" barSize={6} radius={[3, 3, 3, 3]}>
            {rows.map((r) => (
              <Cell key={r.metric} fill={C.teal} fillOpacity={0.9} />
            ))}
          </Bar>
          <Bar dataKey="alt" name="This option" barSize={6} radius={[3, 3, 3, 3]}>
            {rows.map((r) => (
              <Cell key={r.metric} fill={C.slate} fillOpacity={0.55} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AlternativesConsidered({
  alternatives,
  recommendedImpact,
}: {
  alternatives: Alternative[];
  recommendedImpact: ImpactDelta;
}) {
  if (alternatives.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <SectionLabel>Alternatives considered — and why they lost</SectionLabel>
        <div style={{ display: 'flex', gap: 14, fontSize: 10, color: C.faint, fontWeight: 600 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 4, borderRadius: 2, background: C.teal }} />
            Recommended
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 4, borderRadius: 2, background: C.slate, opacity: 0.6 }} />
            Alternative
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 12,
        }}
      >
        {alternatives.map((alt) => (
          <div
            key={alt.id}
            style={{
              background: C.cardBg,
              border: C.cardBorder,
              borderRadius: 12,
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div
                style={{
                  fontSize: 10,
                  fontFamily: C.mono,
                  color: C.faint,
                  letterSpacing: '0.08em',
                }}
              >
                {alt.id}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.textSecondary, lineHeight: 1.35 }}>
                {alt.label}
              </div>
              <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.5 }}>{alt.summary}</div>
            </div>

            <ImpactCompareChart rec={recommendedImpact} alt={alt.impact} />

            <div
              style={{
                display: 'flex',
                gap: 9,
                padding: '10px 12px',
                borderRadius: 9,
                background: 'rgba(199,90,90,0.07)',
                border: '1px solid rgba(199,90,90,0.22)',
              }}
            >
              <XCircle size={13} strokeWidth={2} style={{ color: C.red, flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 11.5, color: '#D9A0A0', lineHeight: 1.5 }}>
                <span
                  style={{
                    color: C.red,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    fontSize: 9.5,
                    letterSpacing: '0.1em',
                    display: 'block',
                    marginBottom: 3,
                  }}
                >
                  Rejected because
                </span>
                {alt.rejectionReason}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
