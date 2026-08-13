/**
 * NewsTicker — auto-scrolling captured-news strip pinned to the bottom of
 * the globe. Pure CSS marquee (keyframes injected by the page); the item
 * list is duplicated so the -50% translation loops seamlessly. Hovering
 * pauses the scroll; clicking an item selects that signal on the globe.
 */

import { useMemo } from 'react';
import { Radio } from 'lucide-react';
import type { Signal } from '../../../data/types';
import { CATEGORY_META, SEVERITY_META, UI } from './constants';

export const TICKER_HEIGHT = 38;

interface NewsTickerProps {
  signals: Signal[];
  onSelect: (signal: Signal) => void;
}

function utcTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}Z`;
}

export function NewsTicker({ signals, onSelect }: NewsTickerProps) {
  const latest = useMemo(
    () =>
      [...signals].sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
      ),
    [signals],
  );

  const renderItems = (dupe: number) =>
    latest.map((s) => (
      <button
        key={`${dupe}-${s.id}`}
        onClick={() => onSelect(s)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 22px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          height: '100%',
          color: UI.textMuted,
          fontSize: 11.5,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: SEVERITY_META[s.severity].color,
            boxShadow: `0 0 5px ${SEVERITY_META[s.severity].color}`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: CATEGORY_META[s.category].color,
            textTransform: 'uppercase',
          }}
        >
          {CATEGORY_META[s.category].label}
        </span>
        <span style={{ color: UI.textSecondary }}>{s.title}</span>
        <span style={{ color: UI.label, fontSize: 10.5 }}>
          {s.source} · {utcTime(s.publishedAt)}
        </span>
      </button>
    ));

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: TICKER_HEIGHT,
        zIndex: 55,
        display: 'flex',
        alignItems: 'stretch',
        background: 'rgba(6, 13, 24, 0.92)',
        borderTop: `1px solid ${UI.panelBorder}`,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
    >
      {/* fixed left badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '0 14px',
          borderRight: `1px solid ${UI.panelBorder}`,
          background: 'rgba(45, 212, 191, 0.05)',
          flexShrink: 0,
        }}
      >
        <Radio size={12} style={{ color: UI.primary }} />
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: '0.18em',
            color: UI.primary,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          Captured News
        </span>
      </div>

      {/* marquee viewport */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }} className="om-ticker-viewport">
        <div
          className="om-ticker-track"
          style={{
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            width: 'max-content',
            animation: `om-ticker ${Math.max(40, latest.length * 6)}s linear infinite`,
          }}
        >
          {renderItems(0)}
          {renderItems(1)}
        </div>
        {/* edge fades */}
        <div
          style={{
            position: 'absolute',
            inset: '0 auto 0 0',
            width: 40,
            background: 'linear-gradient(90deg, rgba(6,13,24,0.95), transparent)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: '0 0 0 auto',
            width: 40,
            background: 'linear-gradient(270deg, rgba(6,13,24,0.95), transparent)',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
}
