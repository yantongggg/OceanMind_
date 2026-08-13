import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { CARD, LABEL, MONO, FUEL_MIX, fmtInt } from './esgTheme';
import { ChartTooltip } from './ChartTooltip';

/** Fleet bunker fuel mix YTD — donut with fixed fuel→hue assignment. */
export function FuelMixDonut() {
  const total = FUEL_MIX.reduce((s, f) => s + f.tonnes, 0);

  return (
    <div style={{ ...CARD, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div>
        <div style={LABEL}>Fuel Mix · YTD</div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#EAF4FF', marginTop: 3 }}>
          Bunkered tonnage by grade
        </div>
      </div>

      <div style={{ position: 'relative', height: 168 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={FUEL_MIX}
              dataKey="tonnes"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={76}
              paddingAngle={2}
              stroke="#0E1C2D"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {FUEL_MIX.map((f) => (
                <Cell key={f.name} fill={f.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip unit="t" />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center total */}
        <div
          style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 700, color: '#EAF4FF', fontFamily: MONO, lineHeight: 1 }}>
            {fmtInt(total)}
          </span>
          <span style={{ fontSize: 9.5, color: '#5A8AB4', marginTop: 3, letterSpacing: '0.08em' }}>TONNES</span>
        </div>
      </div>

      {/* Legend with values */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {FUEL_MIX.map((f) => (
          <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: f.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, color: '#BFD7F7', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {f.name}
            </span>
            <span style={{ fontSize: 11, color: '#EAF4FF', fontWeight: 600, fontFamily: MONO }}>{fmtInt(f.tonnes)} t</span>
            <span style={{ fontSize: 10.5, color: '#5A8AB4', fontFamily: MONO, width: 42, textAlign: 'right' }}>
              {((f.tonnes / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10.5, color: '#3D5A75' }}>
        B24 bio-blend ISCC EU certified · steered via Supplier DNA scoring
      </div>
    </div>
  );
}
