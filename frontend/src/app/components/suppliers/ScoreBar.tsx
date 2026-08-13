/**
 * One horizontal sub-score bar (Reliability, Fuel Quality, ESG…).
 * Compact by default for cards; `detailed` adds the hint line for the drawer.
 */
export interface ScoreBarProps {
  label: string;
  value: number;      // 0–100
  hint?: string;
  detailed?: boolean;
}

function barColor(v: number): string {
  if (v >= 88) return '#2DD4BF';
  if (v >= 78) return '#38BDF8';
  if (v >= 62) return '#E8A043';
  return '#C75A5A';
}

export function ScoreBar({ label, value, hint, detailed = false }: ScoreBarProps) {
  const color = barColor(value);
  return (
    <div title={hint} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: '#8BA8C8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {label}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#EAF4FF', fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </span>
      </div>
      <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div
          style={{
            width: `${Math.min(100, Math.max(0, value))}%`,
            height: '100%', borderRadius: 999,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
            transition: 'width 500ms cubic-bezier(0.4,0,0.2,1)',
          }}
        />
      </div>
      {detailed && hint && (
        <span style={{ fontSize: 10.5, color: '#5A8AB4', lineHeight: 1.4 }}>{hint}</span>
      )}
    </div>
  );
}
