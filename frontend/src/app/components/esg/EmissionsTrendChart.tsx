import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { EsgSummary } from '../../../data/types';
import { CARD, LABEL, CHART, fmtInt } from './esgTheme';
import { ChartTooltip } from './ChartTooltip';

/**
 * Monthly fleet emissions — no-optimisation baseline (dashed reference) vs
 * actual with AI decisions applied (filled area). The gap is the CO₂ avoided.
 */
export function EmissionsTrendChart({ esg }: { esg: EsgSummary }) {
  const data = esg.monthlyCo2.map((m) => ({ ...m, avoided: m.baseline - m.actual }));
  const savedYtd = esg.co2SavedVsBaselineTonnes;

  return (
    <div style={{ ...CARD, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={LABEL}>Monthly Fleet Emissions · 2026</div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#EAF4FF', marginTop: 3 }}>
            Actual with AI decisions vs no-optimisation baseline
          </div>
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 3 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#BFD7F7' }}>
            <span style={{ width: 14, height: 3, borderRadius: 2, background: CHART.actual, display: 'inline-block' }} />
            Actual
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#BFD7F7' }}>
            <svg width={16} height={4}><line x1={0} y1={2} x2={16} y2={2} stroke={CHART.baseline} strokeWidth={2} strokeDasharray="4 3" /></svg>
            Baseline
          </span>
          <span style={{ fontSize: 11, color: '#00D47E', fontWeight: 700 }}>
            −{fmtInt(savedYtd)} t avoided YTD
          </span>
        </div>
      </div>

      <div style={{ height: 240, marginLeft: -8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="esgActualFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART.actual} stopOpacity={0.28} />
                <stop offset="100%" stopColor={CHART.actual} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: CHART.tick }}
              axisLine={{ stroke: 'rgba(255,255,255,0.10)' }}
              tickLine={false}
              dy={6}
            />
            <YAxis
              tick={{ fontSize: 11, fill: CHART.tick }}
              axisLine={false}
              tickLine={false}
              width={52}
              tickFormatter={(v: number) => (v === 0 ? '0' : `${Math.round(v / 1000)}k`)}
              domain={[0, 'auto']}
            />
            <Tooltip
              content={<ChartTooltip unit="tCO₂" />}
              cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeDasharray: '3 3' }}
            />
            <Area
              type="monotone"
              dataKey="actual"
              name="Actual (with decisions)"
              stroke={CHART.actual}
              strokeWidth={2}
              fill="url(#esgActualFill)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="baseline"
              name="Baseline (no optimisation)"
              stroke={CHART.baseline}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize: 10.5, color: '#3D5A75' }}>
        July is month-to-date · baseline = plan-of-record routings at contract speed, IMO emission factors
      </div>
    </div>
  );
}
