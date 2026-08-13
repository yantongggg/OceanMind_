/**
 * ESG snapshot — monthly fleet CO₂ (actual vs no-optimisation baseline)
 * sparkline plus the headline compliance chips, linking to /esg.
 */
import { useNavigate } from 'react-router';
import { Leaf, ArrowRight } from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { EsgSummary } from '../../../data/types';
import { ACCENT, MONO, SectionPanel, PanelLink, fmtInt } from './primitives';

const BASELINE_COLOR = '#8BA8C8';

interface EsgSnapshotProps {
  esg: EsgSummary;
}

function ChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      style={{
        background: 'rgba(7,17,29,0.97)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 8,
        padding: '8px 10px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: '#7FA5D3', marginBottom: 5 }}>{label} 2026</div>
      {payload.map((p) => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, marginTop: 2 }}>
          <span style={{ width: 8, height: 2, background: p.color, borderRadius: 1, flexShrink: 0 }} />
          <span style={{ color: '#8BA8C8' }}>{p.name}</span>
          <span className="tabular-nums" style={{ color: '#EAF4FF', fontWeight: 700, fontFamily: MONO, marginLeft: 'auto', paddingLeft: 10 }}>
            {fmtInt(p.value ?? 0)} t
          </span>
        </div>
      ))}
    </div>
  );
}

export function EsgSnapshot({ esg }: EsgSnapshotProps) {
  const navigate = useNavigate();

  const chips = [
    {
      label: 'FuelEU',
      value: esg.fuelEu.compliant ? 'PASS' : 'FAIL',
      detail: `${esg.fuelEu.ghgIntensity.toFixed(1)} / ${esg.fuelEu.limit.toFixed(2)} gCO₂e/MJ`,
      color: esg.fuelEu.compliant ? '#00D47E' : '#FF5A5A',
    },
    {
      label: 'IMO CII',
      value: esg.imoCii.fleetRating,
      detail: esg.imoCii.trend,
      color: esg.imoCii.trend === 'degrading' ? '#FFB84D' : '#00D47E',
    },
    {
      label: 'Fleet CO₂ YTD',
      value: `${fmtInt(esg.fleetCo2YtdTonnes / 1000)}k t`,
      detail: `−${esg.co2SavedPct.toFixed(1)}% vs baseline`,
      color: ACCENT,
    },
  ];

  return (
    <SectionPanel
      title="ESG snapshot"
      icon={<Leaf size={13} strokeWidth={1.8} />}
      meta={`Fleet CO₂ — actual vs baseline · Jul is month-to-date`}
      action={
        <button
          onClick={() => navigate('/esg')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <PanelLink>
            Carbon detail <ArrowRight size={11} />
          </PanelLink>
        </button>
      }
      bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      {/* Compliance chips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        {chips.map((c) => (
          <div
            key={c.label}
            style={{
              borderRadius: 8,
              padding: '8px 10px',
              background: 'rgba(8,19,31,0.5)',
              border: '1px solid rgba(255,255,255,0.07)',
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontSize: 8.5,
                fontWeight: 700,
                letterSpacing: '0.11em',
                textTransform: 'uppercase',
                color: '#5A8AB4',
                whiteSpace: 'nowrap',
              }}
            >
              {c.label}
            </div>
            <div
              className="tabular-nums"
              style={{ fontSize: 15, fontWeight: 700, color: c.color, fontFamily: MONO, marginTop: 3, lineHeight: 1 }}
            >
              {c.value}
            </div>
            <div
              style={{
                fontSize: 9,
                color: '#7FA5D3',
                marginTop: 3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {c.detail}
            </div>
          </div>
        ))}
      </div>

      {/* Sparkline */}
      <div style={{ width: '100%', height: 148 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={esg.monthlyCo2} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id="cmdEsgActualFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity={0.28} />
                <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(56,189,248,0.06)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: '#5A8AB4' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
              tickLine={false}
              interval={0}
            />
            <YAxis hide domain={['dataMin - 2500', 'dataMax + 1500']} />
            <Tooltip content={<ChartTip />} cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeDasharray: '3 3' }} />
            <Line
              name="Baseline"
              type="monotone"
              dataKey="baseline"
              stroke={BASELINE_COLOR}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 3, fill: BASELINE_COLOR, stroke: '#0E1C2D', strokeWidth: 2 }}
            />
            <Area
              name="Actual"
              type="monotone"
              dataKey="actual"
              stroke={ACCENT}
              strokeWidth={2}
              fill="url(#cmdEsgActualFill)"
              dot={false}
              activeDot={{ r: 3.5, fill: ACCENT, stroke: '#0E1C2D', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend + saved callout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 10, color: '#8BA8C8' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 2, background: ACCENT, borderRadius: 1 }} />
          Actual
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 14,
              height: 0,
              borderTop: `2px dashed ${BASELINE_COLOR}`,
            }}
          />
          Baseline (no optimisation)
        </span>
        <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#00D47E', fontFamily: MONO }} className="tabular-nums">
          −{fmtInt(esg.co2SavedVsBaselineTonnes)} tCO₂ YTD
        </span>
      </div>
    </SectionPanel>
  );
}
