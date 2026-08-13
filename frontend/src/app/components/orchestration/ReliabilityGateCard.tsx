import { Link } from 'react-router';
import { motion } from 'motion/react';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ShieldQuestion,
  ArrowRight,
  FileCheck2,
  Scale,
} from 'lucide-react';
import type { Decision, ReliabilityStatus } from '../../../data/types';

/**
 * ReliabilityGateCard — output of the evidence-completeness gate.
 * Shows the four possible verdicts with the active one lit, the gate note,
 * the headline impact numbers and a link into the produced decision.
 */

const GATE_META: Record<
  ReliabilityStatus,
  { label: string; color: string; icon: typeof ShieldCheck; blurb: string }
> = {
  READY: {
    label: 'READY',
    color: '#34D399',
    icon: ShieldCheck,
    blurb: 'Evidence complete — safe to approve',
  },
  REVIEW: {
    label: 'REVIEW',
    color: '#E8A043',
    icon: ShieldAlert,
    blurb: 'Human review advised before acting',
  },
  ESCALATE: {
    label: 'ESCALATE',
    color: '#C75A5A',
    icon: ShieldX,
    blurb: 'Conflicting evidence — escalate',
  },
  INSUFFICIENT_EVIDENCE: {
    label: 'INSUFFICIENT EVIDENCE',
    color: '#8BA8C8',
    icon: ShieldQuestion,
    blurb: 'Do not act on this yet',
  },
};

const GATE_ORDER: ReliabilityStatus[] = ['READY', 'REVIEW', 'ESCALATE', 'INSUFFICIENT_EVIDENCE'];

interface Props {
  /** Decision produced by the run — null until the gate event has streamed. */
  decision: Decision | null;
  /** True while the pipeline is streaming but the gate has not fired yet. */
  streaming: boolean;
}

function fmtSigned(n: number, prefix = '', suffix = '') {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${prefix}${Math.abs(n).toLocaleString()}${suffix}`;
}

export function ReliabilityGateCard({ decision, streaming }: Props) {
  const status = decision?.reliability ?? null;
  const meta = status ? GATE_META[status] : null;
  const Icon = meta?.icon ?? Scale;

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Scale size={13} style={{ color: '#2DD4BF' }} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#EAF4FF' }}>Reliability Gate</div>
          <div style={{ fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            evidence-completeness verdict
          </div>
        </div>
      </div>

      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        {/* Verdict rail */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {GATE_ORDER.map((s) => {
            const m = GATE_META[s];
            const active = status === s;
            return (
              <div
                key={s}
                style={{
                  padding: '7px 4px',
                  borderRadius: 7,
                  textAlign: 'center',
                  fontSize: 8,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: active ? m.color : '#4A6484',
                  background: active ? `${m.color}14` : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${active ? `${m.color}55` : 'rgba(255,255,255,0.06)'}`,
                  boxShadow: active ? `0 0 12px ${m.color}22` : 'none',
                  transition: 'all 300ms',
                }}
              >
                {m.label.replace('_', ' ')}
              </div>
            );
          })}
        </div>

        {/* Verdict body */}
        {meta && decision ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `${meta.color}14`,
                  border: `1px solid ${meta.color}50`,
                  boxShadow: `0 0 16px ${meta.color}22`,
                }}
              >
                <Icon size={21} style={{ color: meta.color }} />
              </div>
              <div>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    color: meta.color,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {meta.label}
                </div>
                <div style={{ fontSize: 10.5, color: '#8BA8C8' }}>{meta.blurb}</div>
              </div>
            </div>

            <div
              style={{
                padding: '9px 11px',
                borderRadius: 8,
                background: 'rgba(4,10,18,0.55)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderLeft: `3px solid ${meta.color}`,
                fontSize: 10.5,
                color: '#BFD7F7',
                lineHeight: 1.55,
              }}
            >
              {decision.reliabilityNote}
            </div>

            {/* Headline impact numbers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {[
                { label: 'ETA', value: fmtSigned(decision.impact.etaHours / 24, '', ' d') },
                { label: 'Fuel', value: fmtSigned(Math.round(decision.impact.fuelUsd / 1000), '$', 'k') },
                { label: 'CO₂', value: fmtSigned(decision.impact.co2Pct, '', '%') },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  style={{
                    padding: '7px 8px',
                    borderRadius: 7,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 8.5, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {kpi.label}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: '#EAF4FF',
                      fontFamily: "'JetBrains Mono', monospace",
                      marginTop: 2,
                    }}
                  >
                    {kpi.value}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#8BA8C8' }}>
              <FileCheck2 size={11} style={{ color: meta.color }} />
              {decision.evidence.length} evidence items · {decision.alternatives.length} alternatives documented
            </div>

            <Link
              to={`/decisions/${decision.id}`}
              style={{
                marginTop: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 9,
                background: `${meta.color}14`,
                border: `1px solid ${meta.color}50`,
                color: meta.color,
                fontSize: 11.5,
                fontWeight: 700,
                textDecoration: 'none',
                transition: 'all 200ms',
              }}
            >
              View decision {decision.id}
              <ArrowRight size={13} />
            </Link>
          </motion.div>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '28px 12px',
              textAlign: 'center',
            }}
          >
            <ShieldQuestion
              size={26}
              style={{
                color: 'rgba(90,138,180,0.6)',
                animation: streaming ? 'livePulse 1.4s ease-in-out infinite' : undefined,
              }}
            />
            <div style={{ fontSize: 11.5, fontWeight: 600, color: '#8BA8C8' }}>
              {streaming ? 'Gate not yet evaluated' : 'No verdict yet'}
            </div>
            <div style={{ fontSize: 10, color: '#5A8AB4', maxWidth: 240, lineHeight: 1.5 }}>
              {streaming
                ? 'The Decision Agent runs the evidence-completeness checklist at the end of the Recommend stage.'
                : 'Run the pipeline — the reliability gate fires once the Decision Agent has ranked the scenarios.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
