import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { Voyage } from '../../../data/types';
import { CARD, LABEL, CHART } from './esgTheme';
import { ChartTooltip } from './ChartTooltip';

/** Per-voyage CO₂ emitted to date — horizontal single-hue bars. */
export function VoyageEmissionsChart({ voyages }: { voyages: Voyage[] }) {
  const data = [...voyages]
    .sort((a, b) => b.co2ToDateTonnes - a.co2ToDateTonnes)
    .map((v) => ({
      name: v.vessel.name.replace(/^MV\s+/, ''),
      co2: v.co2ToDateTonnes,
      route: `${v.originPort} → ${v.destinationPort}`,
      id: v.id,
    }));

  return (
    <div style={{ ...CARD, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <div>
        <div style={LABEL}>Per-Voyage Emissions</div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#EAF4FF', marginTop: 3 }}>
          CO₂ emitted to date · active voyages
        </div>
      </div>

      <div style={{ height: data.length * 34 + 40, minHeight: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 18, bottom: 0, left: 0 }} barCategoryGap="32%">
            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: CHART.tick }}
              axisLine={{ stroke: 'rgba(255,255,255,0.10)' }}
              tickLine={false}
              tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`)}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={122}
              tick={{ fontSize: 11, fill: '#BFD7F7' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={<ChartTooltip unit="tCO₂" />}
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            />
            <Bar dataKey="co2" name="CO₂ to date" fill={CHART.bar} radius={[0, 4, 4, 0]} maxBarSize={14} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize: 10.5, color: '#3D5A75' }}>
        MV OceanMind Harmony reflects the Cape reroute + slow-steam plan (DEC-0042)
      </div>
    </div>
  );
}
