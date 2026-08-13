/**
 * Evidence trail — every piece of evidence the agents used, with source
 * kind, excerpt, confidence and a link chip; footer links to /orchestration
 * for the full agent trace.
 */

import { Link } from 'react-router';
import { ArrowUpRight, Link2, Workflow } from 'lucide-react';
import type { EvidenceItem } from '../../../data/types';
import { C, EVIDENCE_KIND_META, SectionLabel } from './shared';

function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.9 ? C.green : value >= 0.75 ? C.teal : C.amber;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }} title={`Confidence ${pct}%`}>
      <div
        style={{
          width: 44,
          height: 4,
          borderRadius: 2,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}
      >
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: color }} />
      </div>
      <span style={{ fontSize: 10, fontFamily: C.mono, fontWeight: 700, color, width: 30 }}>
        {pct}%
      </span>
    </div>
  );
}

export function EvidenceTrail({
  evidence,
  pipelineRunId,
  decisionCreatedAt,
  fmtTimestamp,
}: {
  evidence: EvidenceItem[];
  pipelineRunId: string;
  decisionCreatedAt: string;
  fmtTimestamp: (iso: string) => string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <SectionLabel>
          Evidence trail — {evidence.length} items · assembled {fmtTimestamp(decisionCreatedAt)}
        </SectionLabel>
        <Link
          to="/orchestration"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 700,
            color: C.teal,
            textDecoration: 'none',
            padding: '5px 11px',
            borderRadius: 8,
            background: 'rgba(45,212,191,0.07)',
            border: '1px solid rgba(45,212,191,0.25)',
          }}
        >
          <Workflow size={12} strokeWidth={2} />
          Full agent trace · {pipelineRunId}
          <ArrowUpRight size={11} strokeWidth={2.2} />
        </Link>
      </div>

      <div
        style={{
          background: C.cardBg,
          border: C.cardBorder,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        {evidence.map((item, i) => {
          const meta = EVIDENCE_KIND_META[item.kind];
          const Icon = meta.icon;
          return (
            <div
              key={item.id}
              style={{
                display: 'flex',
                gap: 14,
                padding: '14px 18px',
                borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  background: `color-mix(in srgb, ${meta.color} 9%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${meta.color} 28%, transparent)`,
                  marginTop: 2,
                }}
              >
                <Icon size={14} strokeWidth={1.8} style={{ color: meta.color }} />
              </div>

              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: C.textSecondary }}>
                    {item.label}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: meta.color,
                    }}
                  >
                    {meta.label}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.55 }}>{item.detail}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 10,
                      fontFamily: C.mono,
                      fontWeight: 600,
                      color: C.faint,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <Link2 size={10} strokeWidth={2} />
                    {item.sourceRef}
                  </span>
                  <span style={{ fontSize: 10, fontFamily: C.mono, color: 'rgba(90,138,180,0.6)' }}>
                    {item.id}
                  </span>
                </div>
              </div>

              <ConfidenceMeter value={item.confidence} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
