/**
 * /decisions/:id — explainable decision detail (DEC-0042 is the demo star).
 *
 * Layout: reliability gate banner → hero recommendation (headline + concrete
 * action list + agent rationale) → quantified impact grid → alternatives
 * considered (with rejection reasons + impact comparison) → evidence trail
 * (linking to /orchestration) → human approval box (approve / override with
 * reason → signed audit line + evidence report link).
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Toaster } from 'sonner';
import {
  ArrowLeft,
  ArrowUpRight,
  BrainCircuit,
  Compass,
  SearchX,
  Ship,
} from 'lucide-react';
import { getDecision, getVoyage } from '../../lib/api';
import type { Decision, Voyage } from '../../data/types';
import {
  C,
  fmtUtc,
  ReliabilityBadge,
  SectionLabel,
  SEVERITY_COLOR,
  StatusBadge,
} from '../components/decisions/shared';
import { ReliabilityBanner } from '../components/decisions/ReliabilityBanner';
import { ImpactGrid } from '../components/decisions/ImpactGrid';
import { AlternativesConsidered } from '../components/decisions/AlternativesConsidered';
import { EvidenceTrail } from '../components/decisions/EvidenceTrail';
import { ApprovalBox } from '../components/decisions/ApprovalBox';

function RecommendationHero({ decision }: { decision: Decision }) {
  return (
    <div
      style={{
        background:
          'radial-gradient(ellipse 640px 280px at 12% 0%, rgba(45,212,191,0.08) 0%, transparent 60%), linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
        border: '1px solid rgba(45,212,191,0.28)',
        borderRadius: 16,
        padding: '24px 26px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        boxShadow: '0 0 28px rgba(45,212,191,0.05), 0 6px 24px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            background: 'rgba(45,212,191,0.12)',
            border: '1px solid rgba(45,212,191,0.35)',
            boxShadow: '0 0 16px rgba(45,212,191,0.12)',
          }}
        >
          <Compass size={19} strokeWidth={1.9} style={{ color: C.teal }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.teal,
              textTransform: 'uppercase',
              letterSpacing: '0.16em',
            }}
          >
            Recommended course of action
          </div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: C.text,
              lineHeight: 1.45,
              letterSpacing: '-0.01em',
            }}
          >
            {decision.recommendation.headline}
          </div>
        </div>
      </div>

      {/* Concrete action list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {decision.recommendation.actions.map((action, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 7,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: 11,
                fontWeight: 800,
                fontFamily: C.mono,
                color: C.teal,
                background: 'rgba(45,212,191,0.10)',
                border: '1px solid rgba(45,212,191,0.28)',
                marginTop: 1,
              }}
            >
              {i + 1}
            </span>
            <span style={{ fontSize: 12.5, color: C.textSecondary, lineHeight: 1.55 }}>{action}</span>
          </div>
        ))}
      </div>

      {/* Agent rationale */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          padding: '14px 16px',
          borderRadius: 11,
          background: 'rgba(56,189,248,0.05)',
          border: '1px solid rgba(56,189,248,0.16)',
        }}
      >
        <BrainCircuit size={15} strokeWidth={1.9} style={{ color: C.sky, flexShrink: 0, marginTop: 2 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              color: C.sky,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
            }}
          >
            Why the decision agent chose this
          </span>
          <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.65, margin: 0 }}>{decision.rationale}</p>
        </div>
      </div>
    </div>
  );
}

export function DecisionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [voyage, setVoyage] = useState<Voyage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDecision(null);
    setVoyage(null);
    if (!id) {
      setLoading(false);
      return;
    }
    getDecision(id).then(async (d) => {
      if (cancelled) return;
      setDecision(d ?? null);
      if (d) {
        const v = await getVoyage(d.voyageId);
        if (!cancelled) setVoyage(v ?? null);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const backLink = (
    <Link
      to="/decisions"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontWeight: 700,
        color: C.faint,
        textDecoration: 'none',
        letterSpacing: '0.04em',
      }}
    >
      <ArrowLeft size={13} /> Back to decisions
    </Link>
  );

  if (loading) {
    return (
      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1160, width: '100%', margin: '0 auto' }}>
        {backLink}
        {[180, 90, 260].map((h, i) => (
          <div
            key={i}
            className="ai-processing"
            style={{ height: h, borderRadius: 14, background: C.cardBg, border: C.cardBorder }}
          />
        ))}
      </div>
    );
  }

  if (!decision) {
    return (
      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1160, width: '100%', margin: '0 auto' }}>
        {backLink}
        <div
          style={{
            background: C.cardBg,
            border: '1px dashed rgba(255,255,255,0.14)',
            borderRadius: 14,
            padding: '56px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            textAlign: 'center',
          }}
        >
          <SearchX size={28} style={{ color: C.faint }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: C.textSecondary }}>
            Decision {id ?? '—'} not found
          </div>
          <p style={{ fontSize: 12, color: C.faint, maxWidth: 420, margin: 0 }}>
            It may have been archived, or the id is mistyped. The full queue lists every decision
            raised by the pipeline.
          </p>
        </div>
      </div>
    );
  }

  const sevColor = SEVERITY_COLOR[decision.severity];

  return (
    <div style={{ padding: '32px 36px 56px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1160, width: '100%', margin: '0 auto' }}>
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
            border: '1px solid rgba(45,212,191,0.25)',
            color: '#EAF4FF',
          },
        }}
      />

      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {backLink}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 13,
              fontFamily: C.mono,
              fontWeight: 800,
              color: C.teal,
              letterSpacing: '0.06em',
            }}
          >
            {decision.id}
          </span>
          <ReliabilityBadge status={decision.reliability} />
          <StatusBadge status={decision.status} />
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: sevColor,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: 999, background: sevColor }} />
            {decision.severity} severity
          </span>
          <span style={{ fontSize: 11, fontFamily: C.mono, color: 'rgba(90,138,180,0.75)' }}>
            raised {fmtUtc(decision.createdAt)}
          </span>
        </div>

        <h1
          style={{
            fontSize: 25,
            fontWeight: 700,
            color: C.text,
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
            margin: 0,
            maxWidth: 900,
          }}
        >
          {decision.title}
        </h1>

        {/* Voyage context */}
        <Link
          to={`/voyages/${decision.voyageId}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            alignSelf: 'flex-start',
            padding: '7px 13px',
            borderRadius: 9,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.09)',
            color: C.muted,
            fontSize: 11.5,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          <Ship size={12} strokeWidth={2} style={{ color: C.faint }} />
          <span style={{ fontFamily: C.mono, color: C.textSecondary }}>{decision.voyageId}</span>
          {voyage && (
            <>
              <span style={{ color: 'rgba(90,138,180,0.5)' }}>·</span>
              {voyage.vessel.name}
              <span style={{ color: 'rgba(90,138,180,0.5)' }}>·</span>
              {voyage.originPort} → {voyage.destinationPort}
              <span style={{ color: 'rgba(90,138,180,0.5)' }}>·</span>
              <span style={{ color: C.faint }}>{voyage.vessel.type} {voyage.vessel.capacity}</span>
            </>
          )}
          <ArrowUpRight size={11} strokeWidth={2.2} style={{ color: C.faint }} />
        </Link>
      </div>

      {/* 5 — Reliability gate */}
      <ReliabilityBanner status={decision.reliability} note={decision.reliabilityNote} />

      {/* 1 — Hero recommendation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SectionLabel>Recommendation</SectionLabel>
        <RecommendationHero decision={decision} />
      </div>

      {/* 2 — Quantified impact */}
      <ImpactGrid decision={decision} />

      {/* 3 — Alternatives considered */}
      <AlternativesConsidered
        alternatives={decision.alternatives}
        recommendedImpact={decision.impact}
      />

      {/* 4 — Evidence trail */}
      <EvidenceTrail
        evidence={decision.evidence}
        pipelineRunId={decision.agentTrace.pipelineRunId}
        decisionCreatedAt={decision.createdAt}
        fmtTimestamp={fmtUtc}
      />

      {/* 6 — Human approval */}
      <ApprovalBox decision={decision} onUpdated={setDecision} />
    </div>
  );
}
