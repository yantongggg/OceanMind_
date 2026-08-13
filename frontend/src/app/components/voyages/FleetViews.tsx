/**
 * FleetViews — the fleet board's two presentations (operational table and
 * card grid). Row/card click navigates to the voyage detail page.
 */

import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import { AlertTriangle, ArrowRight, ChevronRight } from 'lucide-react';
import type { Voyage } from '../../../data/types';
import { Progress } from '../ui/progress';
import { VoyageStatusBadge } from './VoyageStatusBadge';
import { etaDeltaHours, fmtDateTime, fmtEtaDelta, fmtInt, portFlag } from './geo';

/** Pending-decision info per voyage, precomputed by the page. */
export interface PendingInfo {
  count: number;
  critical: boolean;
}

interface ViewProps {
  voyages: Voyage[];
  pendingByVoyage: Record<string, PendingInfo>;
}

function DecisionBadge({ info }: { info?: PendingInfo }) {
  if (!info || info.count === 0) {
    return <span style={{ fontSize: 11, color: '#5A8AB4' }}>—</span>;
  }
  const color = info.critical ? '#C75A5A' : '#E8A043';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 9px',
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 700,
        color,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 34%, transparent)`,
        boxShadow: info.critical ? '0 0 10px rgba(199,90,90,0.18)' : undefined,
        whiteSpace: 'nowrap',
      }}
    >
      <AlertTriangle size={11} strokeWidth={2} />
      {info.count} pending
    </span>
  );
}

function RouteCell({ voyage }: { voyage: Voyage }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: 12.5, color: '#EAF4FF' }}>
        {portFlag(voyage.originPort)} <span style={{ fontWeight: 500 }}>{voyage.originPort}</span>
      </span>
      <ArrowRight size={12} style={{ color: '#5A8AB4', flexShrink: 0 }} />
      <span style={{ fontSize: 12.5, color: '#EAF4FF' }}>
        {portFlag(voyage.destinationPort)} <span style={{ fontWeight: 500 }}>{voyage.destinationPort}</span>
      </span>
    </span>
  );
}

function EtaCell({ voyage }: { voyage: Voyage }) {
  const delta = etaDeltaHours(voyage);
  return (
    <div>
      <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: '#EAF4FF' }}>
        {fmtDateTime(voyage.etaCurrent)}
      </div>
      <div
        style={{
          fontSize: 10.5,
          fontFamily: "'JetBrains Mono', monospace",
          color: delta > 0 ? '#E8A043' : delta < 0 ? '#00D47E' : '#5A8AB4',
        }}
      >
        {delta === 0 ? 'on plan' : `${fmtEtaDelta(delta)} vs plan`}
      </div>
    </div>
  );
}

/* ── Table view ───────────────────────────────────────────────────────── */

const TH: CSSProperties = {
  padding: '10px 16px',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#5A8AB4',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

export function FleetTable({ voyages, pendingByVoyage }: ViewProps) {
  const navigate = useNavigate();
  return (
    <div className="premium-glass-card" style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(16,32,51,0.5)' }}>
              <th style={TH}>Vessel</th>
              <th style={TH}>Route</th>
              <th style={{ ...TH, minWidth: 130 }}>Progress</th>
              <th style={TH}>ETA (current)</th>
              <th style={TH}>Status</th>
              <th style={{ ...TH, textAlign: 'right' }}>CO₂ to date</th>
              <th style={TH}>Decisions</th>
              <th style={{ ...TH, width: 28 }} />
            </tr>
          </thead>
          <tbody>
            {voyages.map((v) => (
              <tr
                key={v.id}
                onClick={() => navigate(`/voyages/${v.id}`)}
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                  transition: 'background 200ms ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(23,39,66,0.35)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#EAF4FF', whiteSpace: 'nowrap' }}>
                    {v.vessel.name}
                  </div>
                  <div style={{ fontSize: 10.5, color: '#5A8AB4', whiteSpace: 'nowrap' }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{v.id}</span>
                    {' · '}
                    {v.vessel.type} · {v.vessel.capacity}
                  </div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <RouteCell voyage={v} />
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Progress value={v.progressPct} className="h-1.5 w-20 bg-white/10" />
                    <span style={{ fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace", color: '#BFD7F7' }}>
                      {v.progressPct}%
                    </span>
                  </div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <EtaCell voyage={v} />
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <VoyageStatusBadge status={v.status} />
                </td>
                <td
                  style={{
                    padding: '12px 16px',
                    textAlign: 'right',
                    fontSize: 12.5,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: '#BFD7F7',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {fmtInt(v.co2ToDateTonnes)} t
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <DecisionBadge info={pendingByVoyage[v.id]} />
                </td>
                <td style={{ padding: '12px 10px' }}>
                  <ChevronRight size={14} style={{ color: '#5A8AB4' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Grid view ────────────────────────────────────────────────────────── */

export function FleetGrid({ voyages, pendingByVoyage }: ViewProps) {
  const navigate = useNavigate();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
        gap: 16,
      }}
    >
      {voyages.map((v) => {
        return (
          <button
            key={v.id}
            onClick={() => navigate(`/voyages/${v.id}`)}
            className="premium-glass-card hover-elevate"
            style={{ padding: 18, textAlign: 'left', cursor: 'pointer', display: 'block', width: '100%' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#EAF4FF', letterSpacing: '-0.01em' }}>
                  {v.vessel.name}
                </div>
                <div style={{ fontSize: 10.5, color: '#5A8AB4' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{v.id}</span> · {v.vessel.type} ·{' '}
                  {v.vessel.capacity}
                </div>
              </div>
              <VoyageStatusBadge status={v.status} />
            </div>

            <div style={{ margin: '12px 0 10px' }}>
              <RouteCell voyage={v} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Progress value={v.progressPct} className="h-1.5 bg-white/10" />
              <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#BFD7F7', flexShrink: 0 }}>
                {v.progressPct}%
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                gap: 8,
                paddingTop: 10,
                borderTop: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <EtaCell voyage={v} />
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: '#BFD7F7' }}>
                  {fmtInt(v.co2ToDateTonnes)} t CO₂
                </div>
                <div style={{ marginTop: 4 }}>
                  <DecisionBadge info={pendingByVoyage[v.id]} />
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
