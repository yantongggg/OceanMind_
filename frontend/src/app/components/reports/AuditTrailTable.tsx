import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight, CircleCheck, CircleX, Clock3 } from 'lucide-react';
import type { Decision } from '../../../data/types';
import { formatDateTime } from './reportMeta';

/**
 * Audit trail — who approved what, when. One row per decision, built from
 * ApprovalRecords; pending decisions surface as amber "awaiting sign-off"
 * rows so the human-in-the-loop queue is visible in the same ledger.
 */
export interface AuditTrailTableProps {
  decisions: Decision[];
}

const RELIABILITY_COLORS: Record<Decision['reliability'], string> = {
  READY: '#00D47E',
  REVIEW: '#E8A043',
  ESCALATE: '#C75A5A',
  INSUFFICIENT_EVIDENCE: '#8BA8C8',
};

const th: CSSProperties = {
  textAlign: 'left', padding: '10px 16px',
  fontSize: 9.5, fontWeight: 700, color: '#5A8AB4',
  letterSpacing: '0.12em', textTransform: 'uppercase',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  whiteSpace: 'nowrap',
};

const td: CSSProperties = {
  padding: '12px 16px', fontSize: 12, color: '#BFD7F7',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  verticalAlign: 'top',
};

function rowSort(a: Decision, b: Decision): number {
  // Pending first (the queue), then most recent action.
  const aPending = a.approval ? 1 : 0;
  const bPending = b.approval ? 1 : 0;
  if (aPending !== bPending) return aPending - bPending;
  const at = a.approval?.at ?? a.createdAt;
  const bt = b.approval?.at ?? b.createdAt;
  return bt.localeCompare(at);
}

export function AuditTrailTable({ decisions }: AuditTrailTableProps) {
  const rows = [...decisions].sort(rowSort);

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14, overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
      }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
          <thead>
            <tr style={{ background: 'rgba(8,19,31,0.6)' }}>
              <th style={th}>Decision</th>
              <th style={th}>Action</th>
              <th style={th}>By</th>
              <th style={th}>Gate</th>
              <th style={th}>Comment</th>
              <th style={{ ...th, textAlign: 'right' }}>When</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const a = d.approval;
              const relColor = RELIABILITY_COLORS[d.reliability];
              return (
                <tr key={d.id} style={{ transition: 'background 200ms ease' }}>
                  <td style={{ ...td, minWidth: 240 }}>
                    <Link
                      to={`/decisions/${d.id}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        color: '#EAF4FF', fontWeight: 600, textDecoration: 'none', fontSize: 12,
                      }}
                    >
                      {d.id} <ArrowUpRight size={11} style={{ color: '#2DD4BF' }} strokeWidth={2} />
                    </Link>
                    <div style={{ fontSize: 11, color: '#8BA8C8', marginTop: 3, lineHeight: 1.45, maxWidth: 340 }}>
                      {d.title}
                    </div>
                    <div style={{ fontSize: 10, color: '#5A8AB4', marginTop: 2 }}>{d.voyageId}</div>
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    {a ? (
                      a.action === 'approved' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#00D47E', fontWeight: 700, fontSize: 11.5 }}>
                          <CircleCheck size={13} strokeWidth={2} /> Approved
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#C75A5A', fontWeight: 700, fontSize: 11.5 }}>
                          <CircleX size={13} strokeWidth={2} /> Overridden
                        </span>
                      )
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#E8A043', fontWeight: 700, fontSize: 11.5 }}>
                        <Clock3 size={13} strokeWidth={2} /> Awaiting sign-off
                      </span>
                    )}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    {a ? (
                      <>
                        <div style={{ fontWeight: 600, color: '#EAF4FF', fontSize: 11.5 }}>{a.approvedBy}</div>
                        <div style={{ fontSize: 10.5, color: '#5A8AB4', marginTop: 2 }}>{a.approverEmail}</div>
                      </>
                    ) : (
                      <span style={{ color: '#5A8AB4', fontSize: 11.5 }}>Voyage Ops Manager</span>
                    )}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <span
                      style={{
                        fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em',
                        color: relColor, background: `${relColor}12`, border: `1px solid ${relColor}38`,
                        padding: '2px 8px', borderRadius: 999,
                      }}
                    >
                      {d.reliability.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ ...td, minWidth: 220 }}>
                    <span style={{ fontSize: 11.5, color: a ? '#BFD7F7' : '#5A8AB4', fontStyle: a ? 'normal' : 'italic', lineHeight: 1.5 }}>
                      {a ? `"${a.comment}"` : 'Reliability gate passed — queued for human review.'}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ fontSize: 11.5, color: a ? '#BFD7F7' : '#E8A043' }}>
                      {formatDateTime(a?.at ?? d.createdAt)}
                    </span>
                    {!a && <div style={{ fontSize: 10, color: '#5A8AB4', marginTop: 2 }}>raised</div>}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td style={{ ...td, textAlign: 'center', padding: '28px 16px', color: '#5A8AB4' }} colSpan={6}>
                  No decisions on record yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
