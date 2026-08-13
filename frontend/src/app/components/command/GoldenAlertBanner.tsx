/**
 * Critical-disruption banner — surfaces the highest-severity pending decision
 * (the golden DEC-0042 Cape reroute in the demo dataset) with one-click paths
 * to approval and to the signal evidence on the globe.
 */
import { useNavigate } from 'react-router';
import { AlertTriangle, ArrowRight, Globe2 } from 'lucide-react';
import type { Decision, Voyage } from '../../../data/types';
import { MONO, RELIABILITY_META, StatusPill, timeAgo } from './primitives';
import { useNow } from '../../../lib/useNowClock';

interface GoldenAlertBannerProps {
  decisions: Decision[];
  voyages: Voyage[];
}

export function GoldenAlertBanner({ decisions, voyages }: GoldenAlertBannerProps) {
  const navigate = useNavigate();
  const now = useNow();

  const critical = decisions.find((d) => d.status === 'pending' && d.severity === 'critical');
  if (!critical) return null;

  const voyage = voyages.find((v) => v.id === critical.voyageId);
  const rel = RELIABILITY_META[critical.reliability];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap',
        padding: '13px 18px',
        borderRadius: 10,
        background: 'linear-gradient(90deg, rgba(255,90,90,0.08) 0%, rgba(14,28,45,0.65) 55%)',
        border: '1px solid rgba(255,90,90,0.28)',
        animation: 'criticalPulse 3s ease-in-out infinite',
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,90,90,0.12)',
          border: '1px solid rgba(255,90,90,0.35)',
          flexShrink: 0,
        }}
      >
        <AlertTriangle size={16} strokeWidth={1.8} style={{ color: '#FF5A5A' }} />
      </span>

      <div style={{ flex: 1, minWidth: 240 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#FF5A5A',
            }}
          >
            Critical disruption
          </span>
          <span style={{ fontSize: 9.5, color: '#5A8AB4', fontFamily: MONO }}>
            {critical.id} · {timeAgo(critical.createdAt, now)}
          </span>
          <StatusPill label={rel.label} color={rel.color} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#EAF4FF', marginTop: 3, lineHeight: 1.35 }}>
          {critical.title}
        </div>
        {voyage && (
          <div style={{ fontSize: 10.5, color: '#8BA8C8', marginTop: 2 }}>
            {voyage.vessel.name} · {voyage.originPort} → {voyage.destinationPort} · {critical.reliabilityNote.split('—')[0].trim()}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => navigate('/globe')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 13px',
            borderRadius: 8,
            background: 'rgba(14,28,45,0.8)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: '#BFD7F7',
            fontSize: 11.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
          }}
        >
          <Globe2 size={12} strokeWidth={1.8} />
          View signals
        </button>
        <button
          onClick={() => navigate(`/decisions/${critical.id}`)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 8,
            background: 'linear-gradient(135deg, #2DD4BF 0%, #22B8CF 100%)',
            border: 'none',
            color: '#07111D',
            fontSize: 11.5,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 12px rgba(45,212,191,0.25)',
          }}
        >
          Review decision
          <ArrowRight size={12} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
