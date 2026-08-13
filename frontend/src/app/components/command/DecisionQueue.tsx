/**
 * Decisions awaiting approval — reliability-gated recommendation cards.
 * Sorted so the most severe, evidence-complete decision leads (the golden
 * DEC-0042 Cape reroute surfaces first), each linking to /decisions/:id.
 */
import { useNavigate } from 'react-router';
import { Scale, Clock3, Fuel, Leaf, ShieldCheck, ArrowRight } from 'lucide-react';
import type { Decision } from '../../../data/types';
import {
  MONO,
  SectionPanel,
  PanelLink,
  StatusPill,
  RELIABILITY_META,
  SEVERITY_COLOR,
  SEVERITY_RANK,
  fmtEtaDelta,
  fmtSignedUsd,
  timeAgo,
} from './primitives';
import { useNow } from '../../../lib/useNowClock';

interface DecisionQueueProps {
  decisions: Decision[];
}

const RELIABILITY_ORDER: Record<Decision['reliability'], number> = {
  READY: 0,
  REVIEW: 1,
  ESCALATE: 2,
  INSUFFICIENT_EVIDENCE: 3,
};

export function DecisionQueue({ decisions }: DecisionQueueProps) {
  const navigate = useNavigate();
  const now = useNow();

  const pending = decisions
    .filter((d) => d.status === 'pending')
    .sort((a, b) => {
      const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (sev !== 0) return sev;
      const rel = RELIABILITY_ORDER[a.reliability] - RELIABILITY_ORDER[b.reliability];
      if (rel !== 0) return rel;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <SectionPanel
      title="Decisions awaiting approval"
      icon={<Scale size={13} strokeWidth={1.8} />}
      meta={`${pending.length} pending · human sign-off required`}
      action={
        <button
          onClick={() => navigate('/decisions')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <PanelLink>
            View queue <ArrowRight size={11} />
          </PanelLink>
        </button>
      }
      bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      {pending.length === 0 && (
        <div style={{ fontSize: 12, color: '#5A8AB4', padding: '18px 0', textAlign: 'center' }}>
          Queue clear — no recommendations awaiting sign-off.
        </div>
      )}
      {pending.length > 0 && <DecisionCard decision={pending[0]} lead now={now} onOpen={(id) => navigate(`/decisions/${id}`)} />}
      {pending.length > 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 10 }}>
          {pending.slice(1).map((d) => (
            <DecisionCard key={d.id} decision={d} now={now} onOpen={(id) => navigate(`/decisions/${id}`)} />
          ))}
        </div>
      )}
    </SectionPanel>
  );
}

interface DecisionCardProps {
  decision: Decision;
  lead?: boolean;
  now: number;
  onOpen: (id: string) => void;
}

function DecisionCard({ decision: d, lead = false, now, onOpen }: DecisionCardProps) {
  const rel = RELIABILITY_META[d.reliability];
  const sevColor = SEVERITY_COLOR[d.severity];
  return (
          <div
            onClick={() => onOpen(d.id)}
            className="hover-elevate"
            style={{
              borderRadius: 8,
              padding: '12px 14px',
              cursor: 'pointer',
              background: lead
                ? 'linear-gradient(135deg, rgba(45,212,191,0.07) 0%, rgba(14,28,45,0.4) 60%)'
                : 'rgba(8,19,31,0.45)',
              border: lead ? '1px solid rgba(45,212,191,0.30)' : '1px solid rgba(255,255,255,0.07)',
              boxShadow: lead ? '0 0 18px rgba(45,212,191,0.07)' : undefined,
            }}
          >
            {/* Top line: id + badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#7FA5D3', fontFamily: MONO }}>{d.id}</span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: sevColor,
                  padding: '1px 7px',
                  borderRadius: 999,
                  background: `${sevColor}12`,
                  border: `1px solid ${sevColor}30`,
                }}
              >
                {d.severity}
              </span>
              <span style={{ marginLeft: 'auto' }}>
                <StatusPill label={rel.label} color={rel.color} />
              </span>
            </div>

            {/* Title + headline */}
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#EAF4FF', lineHeight: 1.35, marginTop: 8 }}>
              {d.title}
            </div>
            <div
              style={{
                fontSize: 11,
                color: '#8BA8C8',
                lineHeight: 1.45,
                marginTop: 4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {d.recommendation.headline}
            </div>

            {/* Impact micro-grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: 6,
                marginTop: 10,
                paddingTop: 10,
                borderTop: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {[
                { icon: Clock3, label: 'ETA', value: fmtEtaDelta(d.impact.etaHours) },
                { icon: Fuel, label: 'Fuel', value: fmtSignedUsd(d.impact.fuelUsd) },
                {
                  icon: Leaf,
                  label: 'CO₂',
                  value: `${d.impact.co2Pct > 0 ? '+' : ''}${d.impact.co2Pct.toFixed(1)}%`,
                },
                { icon: ShieldCheck, label: 'Risk', value: String(d.impact.riskScore) },
              ].map((m) => {
                const MIcon = m.icon;
                return (
                  <div key={m.label} style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MIcon size={10} strokeWidth={1.8} style={{ color: '#5A8AB4', flexShrink: 0 }} />
                      <span
                        style={{
                          fontSize: 8.5,
                          fontWeight: 700,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: '#5A8AB4',
                        }}
                      >
                        {m.label}
                      </span>
                    </div>
                    <div
                      className="tabular-nums"
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: '#DCEBFF',
                        fontFamily: MONO,
                        marginTop: 2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {m.value}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 10,
                fontSize: 9.5,
                color: '#5A8AB4',
              }}
            >
              <span style={{ fontFamily: MONO }}>
                {d.voyageId} · {timeAgo(d.createdAt, now)}
              </span>
              <PanelLink>
                Review <ArrowRight size={10} />
              </PanelLink>
            </div>
          </div>
  );
}
