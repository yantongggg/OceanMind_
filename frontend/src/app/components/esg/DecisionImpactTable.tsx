import { useNavigate } from 'react-router';
import { BrainCircuit } from 'lucide-react';
import type { Decision } from '../../../data/types';
import { CARD, LABEL, MONO, STATUS_CHIP, deltaColor, fmtSigned, fmtSignedUsd } from './esgTheme';

const TH: React.CSSProperties = {
  padding: '9px 10px',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: '#5A8AB4',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
};

const TD: React.CSSProperties = {
  padding: '11px 10px',
  fontSize: 12,
  color: '#BFD7F7',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  verticalAlign: 'middle',
};

const NUM: React.CSSProperties = { ...TD, fontFamily: MONO, fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' };

/**
 * Carbon impact of AI decisions — every recommendation with its CO₂ and USD
 * deltas vs the plan of record. Negative = savings (green).
 */
export function DecisionImpactTable({ decisions }: { decisions: Decision[] }) {
  const navigate = useNavigate();
  const order: Record<string, number> = { approved: 0, pending: 1, overridden: 2, expired: 3 };
  const rows = [...decisions].sort(
    (a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || b.createdAt.localeCompare(a.createdAt),
  );
  const approved = rows.filter((d) => d.status === 'approved');
  const netCo2 = approved.reduce((s, d) => s + d.impact.co2Tonnes, 0);
  const netUsd = approved.reduce((s, d) => s + d.impact.fuelUsd, 0);

  return (
    <div style={{ ...CARD, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
      <div style={{ padding: '20px 22px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.20)',
          }}
        >
          <BrainCircuit size={14} style={{ color: '#2DD4BF' }} strokeWidth={1.8} />
        </div>
        <div>
          <div style={LABEL}>Carbon Impact of AI Decisions</div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#EAF4FF', marginTop: 2 }}>
            Quantified deltas vs plan of record · negative = savings
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr style={{ background: 'rgba(8,19,31,0.5)' }}>
              <th style={TH}>Decision</th>
              <th style={TH}>Voyage</th>
              <th style={TH}>Status</th>
              <th style={{ ...TH, textAlign: 'right' }}>Δ CO₂</th>
              <th style={{ ...TH, textAlign: 'right' }}>Δ Fuel USD</th>
              <th style={{ ...TH, textAlign: 'right' }}>Δ EU ETS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const chip = STATUS_CHIP[d.status] ?? STATUS_CHIP.expired;
              return (
                <tr
                  key={d.id}
                  onClick={() => navigate(`/decisions/${d.id}`)}
                  style={{ cursor: 'pointer', transition: 'background 200ms ease' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16,32,51,0.55)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ ...TD, maxWidth: 250 }}>
                    <div style={{ fontSize: 11, color: '#5A8AB4', fontFamily: MONO, marginBottom: 2 }}>{d.id}</div>
                    <div
                      style={{
                        fontSize: 12.5, fontWeight: 600, color: '#EAF4FF',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}
                      title={d.title}
                    >
                      {d.title}
                    </div>
                  </td>
                  <td style={{ ...TD, fontFamily: MONO, fontSize: 11.5, whiteSpace: 'nowrap' }}>{d.voyageId}</td>
                  <td style={TD}>
                    <span
                      style={{
                        padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                        letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                        background: chip.bg, border: `1px solid ${chip.border}`, color: chip.color,
                      }}
                    >
                      {chip.label}
                    </span>
                  </td>
                  <td style={{ ...NUM, color: deltaColor(d.impact.co2Tonnes) }}>
                    {fmtSigned(d.impact.co2Tonnes, ' t')}
                    <div style={{ color: '#5A8AB4', fontWeight: 500, fontSize: 10 }}>
                      {d.impact.co2Pct > 0 ? '+' : d.impact.co2Pct < 0 ? '−' : ''}{Math.abs(d.impact.co2Pct).toFixed(1)}%
                    </div>
                  </td>
                  <td style={{ ...NUM, color: deltaColor(d.impact.fuelUsd) }}>{fmtSignedUsd(d.impact.fuelUsd)}</td>
                  <td style={{ ...NUM, color: deltaColor(d.impact.euEtsUsd) }}>{fmtSignedUsd(d.impact.euEtsUsd)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: 'rgba(45,212,191,0.05)' }}>
              <td style={{ ...TD, borderBottom: 'none', fontWeight: 700, color: '#EAF4FF' }} colSpan={3}>
                Net impact of approved decisions ({approved.length})
              </td>
              <td style={{ ...NUM, borderBottom: 'none', color: deltaColor(netCo2) }}>{fmtSigned(netCo2, ' t')}</td>
              <td style={{ ...NUM, borderBottom: 'none', color: deltaColor(netUsd) }}>{fmtSignedUsd(netUsd)}</td>
              <td style={{ ...NUM, borderBottom: 'none', color: '#5A8AB4' }}>—</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div style={{ padding: '10px 22px 16px', fontSize: 10.5, color: '#3D5A75' }}>
        Click a row for the full evidence trail · deltas from deterministic carbon &amp; voyage calculators
      </div>
    </div>
  );
}
