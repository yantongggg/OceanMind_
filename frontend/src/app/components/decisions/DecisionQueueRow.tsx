/**
 * One row of the decision queue — id, voyage, headline, reliability badge,
 * impact chips (ETA / fuel / CO₂ / ETS) and status. The golden pending
 * decision (critical + READY) gets a subtle teal ring so it reads as
 * "act on me" in the demo.
 */

import { useNavigate } from 'react-router';
import { ChevronRight, Fuel, Landmark, Leaf, Ship, Timer } from 'lucide-react';
import type { Decision, Voyage } from '../../../data/types';
import {
  C,
  fmtAgo,
  fmtEtaDelta,
  fmtPctDelta,
  fmtUsdDelta,
  ImpactChip,
  ReliabilityBadge,
  SEVERITY_COLOR,
  StatusBadge,
} from './shared';

function chipTone(v: number): 'good' | 'bad' | 'neutral' {
  return v > 0 ? 'bad' : v < 0 ? 'good' : 'neutral';
}

export function DecisionQueueRow({
  decision,
  voyage,
}: {
  decision: Decision;
  voyage?: Voyage;
}) {
  const navigate = useNavigate();
  const highlight = decision.status === 'pending' && decision.reliability === 'READY';
  const sevColor = SEVERITY_COLOR[decision.severity];

  return (
    <button
      onClick={() => navigate(`/decisions/${decision.id}`)}
      className="hover-elevate"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
        width: '100%',
        textAlign: 'left',
        background: C.cardBg,
        border: highlight ? '1px solid rgba(45,212,191,0.30)' : C.cardBorder,
        borderRadius: 12,
        padding: 0,
        cursor: 'pointer',
        overflow: 'hidden',
        boxShadow: highlight
          ? '0 0 20px rgba(45,212,191,0.07), 0 2px 8px rgba(0,0,0,0.3)'
          : '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      {/* severity accent bar */}
      <div style={{ width: 4, flexShrink: 0, background: sevColor, opacity: 0.75 }} />

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          padding: '16px 18px 16px 16px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 11,
                fontFamily: C.mono,
                fontWeight: 700,
                color: highlight ? C.teal : C.faint,
                letterSpacing: '0.06em',
              }}
            >
              {decision.id}
            </span>
            <ReliabilityBadge status={decision.reliability} compact />
            <StatusBadge status={decision.status} />
            <span style={{ fontSize: 10.5, color: 'rgba(90,138,180,0.7)', fontFamily: C.mono }}>
              {fmtAgo(decision.createdAt)}
            </span>
          </div>

          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: C.text,
              lineHeight: 1.35,
              letterSpacing: '-0.01em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {decision.title}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: C.muted,
                fontWeight: 600,
              }}
            >
              <Ship size={11} strokeWidth={2} style={{ color: C.faint }} />
              {decision.voyageId}
              {voyage && (
                <span style={{ color: C.faint, fontWeight: 500 }}>
                  · {voyage.vessel.name} · {voyage.originPort} → {voyage.destinationPort}
                </span>
              )}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 1 }}>
            <ImpactChip
              icon={Timer}
              value={fmtEtaDelta(decision.impact.etaHours)}
              title="ETA delta vs plan of record"
              tone={chipTone(decision.impact.etaHours)}
            />
            <ImpactChip
              icon={Fuel}
              value={fmtUsdDelta(decision.impact.fuelUsd)}
              title="Fuel cost delta"
              tone={chipTone(decision.impact.fuelUsd)}
            />
            <ImpactChip
              icon={Leaf}
              value={`${fmtPctDelta(decision.impact.co2Pct)} CO₂`}
              title="CO₂ delta vs baseline plan"
              tone={chipTone(decision.impact.co2Pct)}
            />
            <ImpactChip
              icon={Landmark}
              value={`${fmtUsdDelta(decision.impact.euEtsUsd)} ETS`}
              title="EU ETS liability delta"
              tone={chipTone(decision.impact.euEtsUsd)}
            />
          </div>
        </div>

        <ChevronRight size={16} strokeWidth={2} style={{ color: C.faint, flexShrink: 0 }} />
      </div>
    </button>
  );
}
