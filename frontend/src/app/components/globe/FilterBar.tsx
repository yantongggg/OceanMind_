/**
 * FilterBar — top-left HUD: live signal count, category chips (multi-select,
 * color-coded, with per-category counts) and a minimum-severity selector.
 */

import { Activity } from 'lucide-react';
import type { Signal, SignalCategory } from '../../../data/types';
import {
  ALL_CATEGORIES,
  CATEGORY_META,
  SEVERITY_META,
  UI,
  hexAlpha,
} from './constants';
import type { SeverityFilter } from './constants';

interface FilterBarProps {
  signals: Signal[];             // full (unfiltered) signal set, for counts
  visibleCount: number;          // signals currently plotted
  activeCategories: Set<SignalCategory>;
  onToggleCategory: (cat: SignalCategory) => void;
  severityFilter: SeverityFilter;
  onSeverityFilter: (f: SeverityFilter) => void;
}

const SEVERITY_OPTIONS: { key: SeverityFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'high', label: 'High +' },
  { key: 'critical', label: 'Critical' },
];

export function FilterBar({
  signals,
  visibleCount,
  activeCategories,
  onToggleCategory,
  severityFilter,
  onSeverityFilter,
}: FilterBarProps) {
  const counts = new Map<SignalCategory, number>();
  for (const s of signals) counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
  const criticalCount = signals.filter((s) => s.severity === 'critical').length;

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 420,
        pointerEvents: 'none',
      }}
    >
      {/* headline card */}
      <div
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '13px 16px',
          borderRadius: 14,
          background: UI.panelBg,
          border: `1px solid ${UI.panelBorder}`,
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: UI.label,
            }}
          >
            Signal Intelligence
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 8px',
              borderRadius: 999,
              background: 'rgba(0, 212, 126, 0.08)',
              border: '1px solid rgba(0, 212, 126, 0.28)',
            }}
          >
            <span
              className="om-globe-pulse"
              style={{
                width: 5,
                height: 5,
                borderRadius: 999,
                background: '#00D47E',
                boxShadow: '0 0 6px rgba(0,212,126,0.7)',
              }}
            />
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.14em',
                color: '#00D47E',
              }}
            >
              LIVE
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: UI.text,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {visibleCount}
          </span>
          <span style={{ fontSize: 11, color: UI.textMuted }}>
            of {signals.length} signals plotted
          </span>
          <span
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 10.5,
              fontWeight: 700,
              color: '#E5484D',
              letterSpacing: '0.06em',
            }}
          >
            <Activity size={11} />
            {criticalCount} CRITICAL
          </span>
        </div>
      </div>

      {/* category chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, pointerEvents: 'auto' }}>
        {ALL_CATEGORIES.map((cat) => {
          const meta = CATEGORY_META[cat];
          const active = activeCategories.has(cat);
          return (
            <button
              key={cat}
              onClick={() => onToggleCategory(cat)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 11px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.03em',
                cursor: 'pointer',
                transition: 'all 200ms ease',
                color: active ? meta.color : UI.textMuted,
                background: active ? hexAlpha(meta.color, 0.10) : 'rgba(7,16,28,0.75)',
                border: `1px solid ${active ? hexAlpha(meta.color, 0.45) : UI.panelBorder}`,
                opacity: active ? 1 : 0.62,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: meta.color,
                  boxShadow: active ? `0 0 5px ${hexAlpha(meta.color, 0.8)}` : 'none',
                  flexShrink: 0,
                }}
              />
              {meta.label}
              <span style={{ fontSize: 10, opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>
                {counts.get(cat) ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* severity selector */}
      <div
        style={{
          display: 'inline-flex',
          gap: 2,
          padding: 3,
          borderRadius: 10,
          background: 'rgba(7,16,28,0.75)',
          border: `1px solid ${UI.panelBorder}`,
          alignSelf: 'flex-start',
          pointerEvents: 'auto',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: UI.label,
            alignSelf: 'center',
            padding: '0 8px',
          }}
        >
          Severity
        </span>
        {SEVERITY_OPTIONS.map((opt) => {
          const active = severityFilter === opt.key;
          const accent =
            opt.key === 'critical'
              ? SEVERITY_META.critical.color
              : opt.key === 'high'
                ? SEVERITY_META.high.color
                : UI.primary;
          return (
            <button
              key={opt.key}
              onClick={() => onSeverityFilter(opt.key)}
              style={{
                padding: '4px 12px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid transparent',
                transition: 'all 200ms ease',
                color: active ? accent : UI.textMuted,
                background: active ? hexAlpha(accent, 0.10) : 'transparent',
                borderColor: active ? hexAlpha(accent, 0.4) : 'transparent',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
