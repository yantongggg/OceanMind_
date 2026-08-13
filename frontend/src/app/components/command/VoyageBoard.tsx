/**
 * Live voyage board — dense operational table of the fleet. Rows link into
 * /voyages/:id; voyages with a pending decision carry an amber gavel marker.
 */
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import { Ship, Scale, ArrowRight } from 'lucide-react';
import type { Decision, Voyage } from '../../../data/types';
import {
  MONO,
  ACCENT,
  SectionPanel,
  StatusPill,
  PanelLink,
  VOYAGE_STATUS_META,
  fmtEtaDelta,
  fmtInt,
} from './primitives';

interface VoyageBoardProps {
  voyages: Voyage[];
  decisions: Decision[];
}

const TH_STYLE: CSSProperties = {
  padding: '9px 14px',
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
  color: '#5A8AB4',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

function etaDeltaHours(v: Voyage): number {
  return Math.round((new Date(v.etaCurrent).getTime() - new Date(v.etaOriginal).getTime()) / 3_600_000);
}

function etaTone(hours: number): string {
  if (hours <= 0) return '#00D47E';
  if (hours > 24) return '#FF5A5A';
  return '#FFB84D';
}

export function VoyageBoard({ voyages, decisions }: VoyageBoardProps) {
  const navigate = useNavigate();
  const pendingVoyageIds = new Set(decisions.filter((d) => d.status === 'pending').map((d) => d.voyageId));

  // Attention first: voyages with a pending decision, then largest ETA slip.
  const rows = [...voyages].sort((a, b) => {
    const pa = pendingVoyageIds.has(a.id) ? 0 : 1;
    const pb = pendingVoyageIds.has(b.id) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return etaDeltaHours(b) - etaDeltaHours(a);
  });

  return (
    <SectionPanel
      title="Live voyage board"
      icon={<Ship size={13} strokeWidth={1.8} />}
      meta={`${rows.length} tracked · AIS + plan-of-record fusion`}
      action={
        <button
          onClick={() => navigate('/voyages')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <PanelLink>
            Fleet view <ArrowRight size={11} />
          </PanelLink>
        </button>
      }
      flush
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr style={{ background: 'rgba(8,19,31,0.55)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <th style={TH_STYLE}>Vessel</th>
              <th style={TH_STYLE}>Route</th>
              <th style={{ ...TH_STYLE, width: 140 }}>Progress</th>
              <th style={{ ...TH_STYLE, textAlign: 'right' }}>ETA Δ</th>
              <th style={TH_STYLE}>Status</th>
              <th style={{ ...TH_STYLE, textAlign: 'right' }}>CO₂ (t)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => {
              const meta = VOYAGE_STATUS_META[v.status];
              const dHours = etaDeltaHours(v);
              const hasPending = pendingVoyageIds.has(v.id);
              return (
                <tr
                  key={v.id}
                  onClick={() => navigate(`/voyages/${v.id}`)}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    transition: 'background 180ms ease',
                    background: hasPending ? 'rgba(45,212,191,0.03)' : 'transparent',
                    boxShadow: hasPending ? `inset 2px 0 0 ${ACCENT}` : undefined,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(23,39,66,0.45)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = hasPending ? 'rgba(45,212,191,0.03)' : 'transparent';
                  }}
                >
                  {/* Vessel */}
                  <td style={{ padding: '10px 14px', minWidth: 170 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#EAF4FF', whiteSpace: 'nowrap' }}>
                        {v.vessel.name.replace(/^MV /, '')}
                      </span>
                      {hasPending && (
                        <span title="Pending decision awaiting approval">
                          <Scale size={11} strokeWidth={2} style={{ color: '#FFB84D', flexShrink: 0 }} />
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: '#5A8AB4', marginTop: 1, whiteSpace: 'nowrap' }}>
                      {v.vessel.type} · {v.vessel.capacity}
                    </div>
                  </td>
                  {/* Route */}
                  <td style={{ padding: '10px 14px', minWidth: 150 }}>
                    <div style={{ fontSize: 11.5, color: '#BFD7F7', whiteSpace: 'nowrap' }}>
                      {v.originPort}
                      <span style={{ color: '#3D5A75', margin: '0 5px' }}>→</span>
                      {v.destinationPort}
                    </div>
                    <div style={{ fontSize: 9.5, color: '#5A8AB4', fontFamily: MONO, marginTop: 1 }}>{v.id}</div>
                  </td>
                  {/* Progress */}
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          flex: 1,
                          height: 4,
                          borderRadius: 999,
                          background: 'rgba(255,255,255,0.07)',
                          overflow: 'hidden',
                          minWidth: 56,
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, v.progressPct))}%`,
                            height: '100%',
                            borderRadius: 999,
                            background: `linear-gradient(90deg, rgba(45,212,191,0.55) 0%, ${ACCENT} 100%)`,
                          }}
                        />
                      </div>
                      <span
                        className="tabular-nums"
                        style={{ fontSize: 10.5, fontWeight: 600, color: '#7FA5D3', fontFamily: MONO, width: 30, textAlign: 'right' }}
                      >
                        {v.progressPct}%
                      </span>
                    </div>
                  </td>
                  {/* ETA delta */}
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <span
                      className="tabular-nums"
                      style={{ fontSize: 11.5, fontWeight: 700, color: etaTone(dHours), fontFamily: MONO, whiteSpace: 'nowrap' }}
                    >
                      {fmtEtaDelta(dHours)}
                    </span>
                  </td>
                  {/* Status */}
                  <td style={{ padding: '10px 14px' }}>
                    <StatusPill label={meta.label} color={meta.color} />
                  </td>
                  {/* CO₂ */}
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <span className="tabular-nums" style={{ fontSize: 11.5, color: '#BFD7F7', fontFamily: MONO }}>
                      {fmtInt(v.co2ToDateTonnes)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionPanel>
  );
}
