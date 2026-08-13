import { MONO } from './esgTheme';

/**
 * Semicircular FuelEU GHG-intensity gauge.
 * Scale runs 80 → 95 gCO₂e/MJ; the regulatory limit is drawn as a tick and
 * the fleet value fills the arc (emerald when compliant, red when not).
 */
export function FuelEuGauge({
  value,
  limit,
  compliant,
}: {
  value: number;
  limit: number;
  compliant: boolean;
}) {
  const MIN = 80;
  const MAX = 95;
  const clamp = (v: number) => Math.min(MAX, Math.max(MIN, v));
  const frac = (v: number) => (clamp(v) - MIN) / (MAX - MIN);

  // Semicircle geometry: 180° (left) → 0° (right), radius 62, center (80, 74).
  const cx = 80;
  const cy = 74;
  const r = 62;
  const pt = (f: number) => {
    const a = Math.PI * (1 - f); // f=0 → 180°, f=1 → 0°
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
  };
  const arc = (f0: number, f1: number) => {
    const p0 = pt(f0);
    const p1 = pt(f1);
    return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 0 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  };

  const vf = frac(value);
  const lf = frac(limit);
  const limitOuter = pt(lf);
  const limitInner = {
    x: cx + (r - 13) * Math.cos(Math.PI * (1 - lf)),
    y: cy - (r - 13) * Math.sin(Math.PI * (1 - lf)),
  };
  const fillColor = compliant ? '#00D47E' : '#C75A5A';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={160} height={84} viewBox="0 0 160 84" aria-label={`FuelEU GHG intensity ${value} against limit ${limit}`}>
        {/* Track */}
        <path d={arc(0, 1)} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth={9} strokeLinecap="round" />
        {/* Value */}
        <path d={arc(0, Math.max(0.02, vf))} fill="none" stroke={fillColor} strokeWidth={9} strokeLinecap="round" />
        {/* Regulatory limit tick */}
        <line
          x1={limitInner.x}
          y1={limitInner.y}
          x2={limitOuter.x}
          y2={limitOuter.y}
          stroke="#E8A043"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        {/* Value readout */}
        <text x={cx} y={cy - 14} textAnchor="middle" fill="#EAF4FF" fontSize={21} fontWeight={700} fontFamily={MONO}>
          {value.toFixed(1)}
        </text>
        <text x={cx} y={cy + 1} textAnchor="middle" fill="#5A8AB4" fontSize={8.5} letterSpacing="0.08em">
          gCO₂e/MJ
        </text>
      </svg>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
        <span style={{ width: 10, height: 2.5, background: '#E8A043', borderRadius: 2, display: 'inline-block' }} />
        <span style={{ fontSize: 10, color: '#7FA5D3' }}>
          2025–29 limit {limit.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
