import { MONO, fmtInt } from './esgTheme';

interface TooltipRow {
  name?: string;
  value?: number | string;
  color?: string;
  unit?: string;
  /** Pie/Bar entries carry the mark fill on the datum payload. */
  payload?: { fill?: string; color?: string };
}

/**
 * Shared dark-glass recharts tooltip.
 * recharts injects `active`, `payload` and `label` at runtime.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  unit = 'tCO₂',
}: {
  active?: boolean;
  payload?: TooltipRow[];
  label?: string | number;
  unit?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      style={{
        background: 'rgba(7,17,29,0.97)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 10,
        padding: '10px 12px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        minWidth: 150,
      }}
    >
      {label !== undefined && label !== '' && (
        <div style={{ fontSize: 10, fontWeight: 700, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
          {label}
        </div>
      )}
      {payload.map((row, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: row.payload?.fill ?? row.color ?? '#2DD4BF', flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, color: '#BFD7F7', flex: 1 }}>{row.name}</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#EAF4FF', fontFamily: MONO }}>
            {typeof row.value === 'number' ? fmtInt(row.value) : row.value}
            <span style={{ color: '#7FA5D3', fontWeight: 500 }}> {unit}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
