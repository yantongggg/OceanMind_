/**
 * SignalDetailPanel — right slide-in intelligence briefing for a selected
 * signal: headline, source + capture time, severity, plain-English read,
 * explicit "what this does NOT imply", corroboration meter, affected
 * voyages (deep-linked) and a "Run agent analysis" CTA to /orchestration.
 */

import type { CSSProperties } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router';
import {
  X,
  Radio,
  Clock3,
  ShieldAlert,
  Ship,
  ArrowUpRight,
  Workflow,
  MapPin,
  CheckCheck,
  FlaskConical,
} from 'lucide-react';
import type { Signal } from '../../../data/types';
import { useNowClock } from '../../../lib/useNowClock';
import { CATEGORY_META, SEVERITY_META, UI, hexAlpha } from './constants';
import { TICKER_HEIGHT } from './NewsTicker';

interface SignalDetailPanelProps {
  signal: Signal | null;
  onClose: () => void;
}

function timeAgo(iso: string, now: number): string {
  const diffMs = now - new Date(iso).getTime();
  const mins = Math.max(1, Math.floor(diffMs / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function utcStamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())} ${d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }).toUpperCase()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}Z`;
}

const sectionLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: UI.label,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

/**
 * Says where a signal came from, and — for live ones — links out to the
 * article so the claim can be checked.
 *
 * Live signals are ingested from real reporting and always carry a url.
 * Curated signals are the authored demo dataset: plausible, but not published
 * by the outlet named on them. Labelling that difference is the point; a
 * synthetic signal wearing a Reuters byline must never read as journalism.
 */
function ProvenanceBadge({ signal }: { signal: Signal }) {
  const isLive = signal.origin === 'live';
  const color = isLive ? '#3FB98B' : '#8B93A7';
  const badge = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 7px',
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color,
        background: hexAlpha(color, 0.12),
        border: `1px solid ${hexAlpha(color, 0.35)}`,
      }}
    >
      {isLive ? <Radio size={9} /> : <FlaskConical size={9} />}
      {isLive ? 'live' : 'curated'}
      {isLive && signal.url && <ArrowUpRight size={9} />}
    </span>
  );

  if (!isLive || !signal.url) return badge;
  return (
    <a
      href={signal.url}
      target="_blank"
      rel="noopener noreferrer"
      title="Open the source article"
      style={{ textDecoration: 'none' }}
    >
      {badge}
    </a>
  );
}

export function SignalDetailPanel({ signal, onClose }: SignalDetailPanelProps) {
  const { now } = useNowClock();

  return (
    <AnimatePresence>
      {signal && (
        <motion.aside
          key={signal.id}
          initial={{ x: 420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 420, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: TICKER_HEIGHT,
            width: 392,
            maxWidth: '86vw',
            zIndex: 60,
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(7, 15, 27, 0.92)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            borderLeft: `1px solid ${UI.panelBorder}`,
            boxShadow: '-12px 0 40px rgba(0,0,0,0.45)',
          }}
        >
          {/* header */}
          <div
            style={{
              padding: '16px 18px 14px',
              borderBottom: `1px solid ${UI.panelBorder}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  padding: '3px 9px',
                  borderRadius: 999,
                  color: CATEGORY_META[signal.category].color,
                  background: hexAlpha(CATEGORY_META[signal.category].color, 0.12),
                  border: `1px solid ${hexAlpha(CATEGORY_META[signal.category].color, 0.35)}`,
                }}
              >
                {CATEGORY_META[signal.category].label}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  padding: '3px 9px',
                  borderRadius: 999,
                  color: SEVERITY_META[signal.severity].color,
                  background: hexAlpha(SEVERITY_META[signal.severity].color, 0.12),
                  border: `1px solid ${hexAlpha(SEVERITY_META[signal.severity].color, 0.35)}`,
                }}
              >
                {SEVERITY_META[signal.severity].label}
              </span>
              <span style={{ fontSize: 10, color: UI.label, letterSpacing: '0.08em', marginLeft: 2 }}>
                {signal.id}
              </span>
              <button
                onClick={onClose}
                aria-label="Close signal briefing"
                style={{
                  marginLeft: 'auto',
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  border: `1px solid ${UI.panelBorder}`,
                  background: 'rgba(255,255,255,0.03)',
                  color: UI.textMuted,
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            </div>

            <h2
              style={{
                margin: 0,
                fontSize: 15.5,
                fontWeight: 650,
                lineHeight: 1.35,
                letterSpacing: '-0.01em',
                color: UI.text,
              }}
            >
              {signal.title}
            </h2>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                fontSize: 11,
                color: UI.textMuted,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Radio size={11} style={{ color: UI.primary }} />
                {signal.source}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Clock3 size={11} />
                {utcStamp(signal.publishedAt)} · {timeAgo(signal.publishedAt, now)}
              </span>
              {signal.affectedChokepoint && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <MapPin size={11} style={{ color: '#E8A043' }} />
                  {signal.affectedChokepoint}
                </span>
              )}
              <ProvenanceBadge signal={signal} />
            </div>
          </div>

          {/* scrollable body */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.65, color: UI.textMuted }}>
              {signal.summary}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={sectionLabel}>Plain-English read</div>
              <div
                style={{
                  padding: '11px 13px',
                  borderRadius: 10,
                  background: 'rgba(45, 212, 191, 0.06)',
                  borderLeft: '2px solid rgba(45, 212, 191, 0.55)',
                  fontSize: 12.5,
                  lineHeight: 1.65,
                  color: UI.textSecondary,
                }}
              >
                {signal.plainEnglish}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={sectionLabel}>
                <ShieldAlert size={11} style={{ color: '#E8A043' }} />
                What this does NOT imply
              </div>
              <div
                style={{
                  padding: '11px 13px',
                  borderRadius: 10,
                  background: 'rgba(232, 160, 67, 0.06)',
                  borderLeft: '2px solid rgba(232, 160, 67, 0.55)',
                  fontSize: 12.5,
                  lineHeight: 1.65,
                  color: UI.textSecondary,
                }}
              >
                {signal.notImplied}
              </div>
            </div>

            {/* corroboration */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={sectionLabel}>
                <CheckCheck size={11} style={{ color: UI.primary }} />
                Corroboration
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', gap: 3 }}>
                  {Array.from({ length: 10 }, (_, i) => (
                    <span
                      key={i}
                      style={{
                        width: 10,
                        height: 5,
                        borderRadius: 2,
                        background:
                          i < Math.min(signal.corroboration, 10)
                            ? UI.primary
                            : 'rgba(255,255,255,0.09)',
                      }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: 11.5, color: UI.textSecondary, fontWeight: 600 }}>
                  ×{signal.corroboration}
                </span>
                <span style={{ fontSize: 11, color: UI.textMuted }}>independent sources</span>
              </div>
            </div>

            {/* affected voyages */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={sectionLabel}>
                <Ship size={11} style={{ color: UI.primary }} />
                Affected voyages
              </div>
              {signal.affectedVoyageIds.length === 0 ? (
                <div style={{ fontSize: 12, color: UI.textMuted }}>
                  No OceanMind voyages intersect this signal.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {signal.affectedVoyageIds.map((vid) => (
                    <Link
                      key={vid}
                      to={`/voyages/${vid}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        padding: '9px 12px',
                        borderRadius: 10,
                        border: `1px solid ${UI.panelBorder}`,
                        background: 'rgba(255,255,255,0.025)',
                        textDecoration: 'none',
                        color: UI.textSecondary,
                        fontSize: 12.5,
                        fontWeight: 600,
                        letterSpacing: '0.02em',
                        transition: 'background 200ms ease, border-color 200ms ease',
                      }}
                    >
                      <Ship size={13} style={{ color: UI.primary, flexShrink: 0 }} />
                      {vid}
                      <ArrowUpRight
                        size={13}
                        style={{ marginLeft: 'auto', color: UI.label, flexShrink: 0 }}
                      />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* actions */}
          <div
            style={{
              padding: '14px 18px 16px',
              borderTop: `1px solid ${UI.panelBorder}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <Link
              to="/orchestration"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '11px 16px',
                borderRadius: 12,
                background: UI.primary,
                color: '#07111D',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.01em',
                textDecoration: 'none',
                transition: 'filter 200ms ease',
              }}
            >
              <Workflow size={15} />
              Run agent analysis
            </Link>
            <Link
              to="/decisions"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${UI.panelBorder}`,
                color: UI.textSecondary,
                fontSize: 12.5,
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'background 200ms ease',
              }}
            >
              Open decision queue
            </Link>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
