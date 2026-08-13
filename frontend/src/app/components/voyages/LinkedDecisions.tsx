/**
 * LinkedDecisions — decisions raised against a voyage, with reliability
 * gate, quantified impact micro-stats and a deep link into /decisions/:id.
 */

import { Link } from 'react-router';
import { ChevronRight, GitBranch } from 'lucide-react';
import type { Decision, ReliabilityStatus, Severity } from '../../../data/types';
import { Panel } from './DetailPanels';
import { fmtDateTime, fmtEtaDelta, fmtUsd } from './geo';

const RELIABILITY_COLOR: Record<ReliabilityStatus, string> = {
  READY: '#00D47E',
  REVIEW: '#E8A043',
  ESCALATE: '#C75A5A',
  INSUFFICIENT_EVIDENCE: '#8BA8C8',
};

const RELIABILITY_LABEL: Record<ReliabilityStatus, string> = {
  READY: 'READY',
  REVIEW: 'REVIEW',
  ESCALATE: 'ESCALATE',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT',
};

const SEVERITY_COLOR: Record<Severity, string> = {
  low: '#8BA8C8',
  medium: '#38BDF8',
  high: '#E8A043',
  critical: '#C75A5A',
};

const STATUS_LABEL: Record<Decision['status'], string> = {
  pending: 'Awaiting approval',
  approved: 'Approved',
  overridden: 'Overridden',
  expired: 'Expired',
};

function MicroStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5A8AB4' }}>
        {label}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: tone ?? '#EAF4FF' }}>
        {value}
      </div>
    </div>
  );
}

export function LinkedDecisions({ decisions }: { decisions: Decision[] }) {
  return (
    <Panel icon={<GitBranch size={14} strokeWidth={1.8} />} title={`Linked decisions (${decisions.length})`}>
      {decisions.length === 0 ? (
        <p style={{ fontSize: 12, color: '#8BA8C8', margin: 0 }}>
          No decisions raised against this voyage — the agent pipeline has nothing pending here.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {decisions.map((d) => {
            const relColor = RELIABILITY_COLOR[d.reliability];
            const pending = d.status === 'pending';
            return (
              <Link
                key={d.id}
                to={`/decisions/${d.id}`}
                className="hover-elevate"
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: pending ? 'rgba(232,160,67,0.05)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${pending ? 'rgba(232,160,67,0.22)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      flexShrink: 0,
                      background: SEVERITY_COLOR[d.severity],
                      boxShadow: d.severity === 'critical' ? `0 0 6px ${SEVERITY_COLOR[d.severity]}` : undefined,
                    }}
                  />
                  <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#5A8AB4' }}>{d.id}</span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      padding: '1px 7px',
                      borderRadius: 999,
                      color: relColor,
                      background: `color-mix(in srgb, ${relColor} 10%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${relColor} 32%, transparent)`,
                    }}
                  >
                    {RELIABILITY_LABEL[d.reliability]}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 10.5, color: pending ? '#E8A043' : '#8BA8C8', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {STATUS_LABEL[d.status]}
                  </span>
                  <ChevronRight size={13} style={{ color: '#5A8AB4', flexShrink: 0 }} />
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#EAF4FF', lineHeight: 1.4, marginBottom: 8 }}>
                  {d.title}
                </div>
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                  <MicroStat label="ETA" value={fmtEtaDelta(d.impact.etaHours)} tone={d.impact.etaHours > 0 ? '#E8A043' : '#00D47E'} />
                  <MicroStat label="Fuel" value={fmtUsd(d.impact.fuelUsd, true)} tone={d.impact.fuelUsd > 0 ? '#E8A043' : '#00D47E'} />
                  <MicroStat
                    label="CO₂"
                    value={`${d.impact.co2Pct > 0 ? '+' : ''}${d.impact.co2Pct.toFixed(1)}%`}
                    tone={d.impact.co2Pct > 0 ? '#E8A043' : '#00D47E'}
                  />
                  <MicroStat label="Risk →" value={String(d.impact.riskScore)} tone={d.impact.riskScore < 35 ? '#00D47E' : '#E8A043'} />
                </div>
                <div style={{ fontSize: 10, color: '#5A8AB4', marginTop: 8, fontFamily: "'JetBrains Mono', monospace" }}>
                  raised {fmtDateTime(d.createdAt)}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
