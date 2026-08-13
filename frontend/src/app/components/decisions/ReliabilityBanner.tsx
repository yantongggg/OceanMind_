/**
 * Reliability gate banner — the evidence-completeness verdict the pipeline
 * attaches to a decision before it may reach a human approver.
 */

import type { ReliabilityStatus } from '../../../data/types';
import { C, RELIABILITY_META } from './shared';

export function ReliabilityBanner({
  status,
  note,
}: {
  status: ReliabilityStatus;
  note: string;
}) {
  const meta = RELIABILITY_META[status];
  const Icon = meta.icon;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        padding: '15px 18px',
        borderRadius: 12,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        boxShadow: status === 'READY' ? '0 0 20px rgba(0,212,126,0.06)' : 'none',
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: `color-mix(in srgb, ${meta.color} 12%, transparent)`,
          border: `1px solid ${meta.border}`,
        }}
      >
        <Icon size={16} strokeWidth={2} style={{ color: meta.color }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: C.faint,
            }}
          >
            Reliability gate
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: meta.color,
            }}
          >
            {meta.label}
          </span>
        </div>
        <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.55, margin: 0 }}>{note}</p>
      </div>
    </div>
  );
}
