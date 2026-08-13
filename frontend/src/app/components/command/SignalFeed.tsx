/**
 * Disruption / signal feed — top-severity captured intelligence, newest and
 * hottest first, linking through to the 3D intelligence globe.
 */
import { useNavigate } from 'react-router';
import {
  Radio,
  ShieldAlert,
  CloudLightning,
  Anchor,
  Scale,
  Crosshair,
  ArrowRight,
} from 'lucide-react';
import type { Signal, SignalCategory } from '../../../data/types';
import { SectionPanel, PanelLink, SEVERITY_COLOR, SEVERITY_RANK, timeAgo } from './primitives';
import { useNow } from '../../../lib/useNowClock';

const CATEGORY_ICON: Record<SignalCategory, typeof ShieldAlert> = {
  geopolitical: ShieldAlert,
  weather: CloudLightning,
  port: Anchor,
  regulatory: Scale,
  piracy: Crosshair,
};

interface SignalFeedProps {
  signals: Signal[];
  /** Panel body max height in px (scrolls internally). */
  maxHeight?: number;
}

export function SignalFeed({ signals, maxHeight = 452 }: SignalFeedProps) {
  const navigate = useNavigate();
  const now = useNow();

  const feed = [...signals]
    .sort((a, b) => {
      const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (sev !== 0) return sev;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    })
    .slice(0, 14);

  return (
    <SectionPanel
      title="Disruption feed"
      icon={<Radio size={13} strokeWidth={1.8} />}
      meta={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: '#00D47E',
              boxShadow: '0 0 5px rgba(0,212,126,0.6)',
              animation: 'livePulse 2s ease-in-out infinite',
            }}
          />
          {signals.length} signals captured / 96 h
        </span>
      }
      action={
        <button
          onClick={() => navigate('/globe')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <PanelLink>
            Open globe <ArrowRight size={11} />
          </PanelLink>
        </button>
      }
      flush
      bodyStyle={{ maxHeight, overflowY: 'auto' }}
    >
      {feed.map((s) => {
        const color = SEVERITY_COLOR[s.severity];
        const Icon = CATEGORY_ICON[s.category];
        return (
          <div
            key={s.id}
            onClick={() => navigate('/globe')}
            style={{
              display: 'flex',
              gap: 10,
              padding: '10px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              cursor: 'pointer',
              transition: 'background 180ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(23,39,66,0.45)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `${color}12`,
                border: `1px solid ${color}30`,
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              <Icon size={12} strokeWidth={1.8} style={{ color }} />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: '#DCEBFF',
                  lineHeight: 1.35,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {s.title}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginTop: 4,
                  fontSize: 9.5,
                  color: '#5A8AB4',
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color,
                  }}
                >
                  {s.severity}
                </span>
                <span style={{ color: '#3D5A75' }}>·</span>
                <span>{s.source}</span>
                <span style={{ color: '#3D5A75' }}>·</span>
                <span>{timeAgo(s.publishedAt, now)}</span>
                {s.affectedChokepoint && (
                  <span
                    style={{
                      padding: '1px 7px',
                      borderRadius: 999,
                      background: 'rgba(56,189,248,0.09)',
                      border: '1px solid rgba(56,189,248,0.22)',
                      color: '#38BDF8',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.affectedChokepoint}
                  </span>
                )}
                {s.corroboration > 1 && (
                  <span style={{ color: '#7FA5D3', whiteSpace: 'nowrap' }}>×{s.corroboration} sources</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </SectionPanel>
  );
}
