/**
 * Intelligence Globe — Crucix-inspired full-viewport WebGL intelligence
 * terminal. Every captured maritime signal from getSignals() is plotted on
 * a dark 3D globe (dotted land + coastlines from local GeoJSON), overlaid
 * with animated shipping-lane arcs, chokepoint labels, category/severity
 * filters, a right slide-in signal briefing and a bottom captured-news
 * ticker.
 */

import { useEffect, useMemo, useState } from 'react';
import { MousePointer2, Route } from 'lucide-react';
import type {
  Signal,
  SignalCategory,
  Voyage,
  AffectedVoyage,
} from '../../data/types';
import { getSignals, getVoyages } from '../../lib/api';
import { GlobeScene } from '../components/globe/GlobeScene';
import { GlobeErrorBoundary } from '../components/globe/GlobeErrorBoundary';
import type { GeoFeatureCollection } from '../components/globe/geo';
import { FilterBar } from '../components/globe/FilterBar';
import { SignalDetailPanel } from '../components/globe/SignalDetailPanel';
import { ImpactPanel } from '../components/globe/ImpactPanel';
import { VoyageFocusPanel } from '../components/globe/VoyageFocusPanel';
import { NewsTicker, TICKER_HEIGHT } from '../components/globe/NewsTicker';
import {
  ALL_CATEGORIES,
  SEVERITY_META,
  UI,
} from '../components/globe/constants';
import type { SeverityFilter } from '../components/globe/constants';

/* Keyframes + hover behaviour for the HUD (injected once with the page). */
const GLOBE_CSS = `
@keyframes om-ticker {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
@keyframes om-globe-pulse-kf {
  0%, 100% { opacity: 1;    transform: scale(1); }
  50%      { opacity: 0.35; transform: scale(0.75); }
}
.om-globe-pulse { animation: om-globe-pulse-kf 1.6s ease-in-out infinite; }
.om-ticker-viewport:hover .om-ticker-track { animation-play-state: paused; }
`;

/* Routes draw only on demand — pick a vessel or an impact-panel row — so the
 * legend describes those two lines, not a permanent lane network. */
const LANE_LEGEND: { label: string; color: string }[] = [
  { label: 'Current route', color: '#8BA8C8' },
  { label: 'Suggested route', color: '#2DD4BF' },
];

export function IntelligenceGlobePage() {
  const [signals, setSignals] = useState<Signal[] | null>(null);
  const [coast, setCoast] = useState<GeoFeatureCollection | null>(null);
  const [land, setLand] = useState<GeoFeatureCollection | null>(null);

  const [activeCategories, setActiveCategories] = useState<Set<SignalCategory>>(
    () => new Set(ALL_CATEGORIES),
  );
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [selected, setSelected] = useState<Signal | null>(null);

  /* The fleet, and the voyage the operator is inspecting from the impact
   * panel. Signal selection and voyage focus are separate concerns — reading
   * a headline and comparing two routes are different tasks — so picking one
   * clears the other rather than stacking two panels over the globe. */
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [focused, setFocused] = useState<AffectedVoyage | null>(null);
  /* A hull clicked straight on the globe — shows its plan of record only.
   * Distinct from `focused`, which is a decision under review. */
  const [inspectedVoyageId, setInspectedVoyageId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVoyages().then((v) => {
      if (!cancelled) setVoyages(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /* One subject at a time. Reading a headline, tracing a ship's plan, and
   * weighing a reroute are three different tasks — stacking their overlays
   * would bury the globe under panels and lines. */
  const focusVoyage = (v: AffectedVoyage | null) => {
    setFocused(v);
    if (v) {
      setSelected(null);
      setInspectedVoyageId(null);
    }
  };

  const selectSignal = (s: Signal | null) => {
    setSelected(s);
    if (s) {
      setFocused(null);
      setInspectedVoyageId(null);
    }
  };

  const inspectVoyage = (id: string | null) => {
    setInspectedVoyageId(id);
    if (id) {
      setSelected(null);
      setFocused(null);
    }
  };

  /* Signals — API with mock fallback. */
  useEffect(() => {
    let cancelled = false;
    getSignals().then((data) => {
      if (!cancelled) setSignals(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /* Local GeoJSON (public/geo/) — no runtime external assets. */
  useEffect(() => {
    let cancelled = false;
    const load = async (file: string, set: (g: GeoFeatureCollection) => void) => {
      try {
        const res = await fetch(`/geo/${file}`);
        if (!res.ok) return;
        const json = (await res.json()) as GeoFeatureCollection;
        if (!cancelled) set(json);
      } catch {
        /* globe still renders without continents */
      }
    };
    load('ne_110m_coastline.geojson', setCoast);
    load('ne_110m_land.geojson', setLand);
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!signals) return [];
    const minRank =
      severityFilter === 'critical' ? 3 : severityFilter === 'high' ? 2 : 0;
    return signals.filter(
      (s) =>
        activeCategories.has(s.category) &&
        SEVERITY_META[s.severity].rank >= minRank,
    );
  }, [signals, activeCategories, severityFilter]);

  /* Keep the briefing panel honest — deselect signals the filters hid. */
  useEffect(() => {
    if (selected && !filtered.some((s) => s.id === selected.id)) {
      setSelected(null);
    }
  }, [filtered, selected]);

  const toggleCategory = (cat: SignalCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
        if (next.size === 0) return new Set(ALL_CATEGORIES); // never empty
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        position: 'relative',
        overflow: 'hidden',
        background:
          'radial-gradient(1200px 800px at 32% 22%, #0B1B30 0%, #060D18 55%, #04080F 100%)',
      }}
    >
      <style>{GLOBE_CSS}</style>

      {/* WebGL globe (boundary keeps the HUD alive if WebGL init fails) */}
      <GlobeErrorBoundary>
        <GlobeScene
          signals={filtered}
          selected={selected}
          onSelect={selectSignal}
          coast={coast}
          land={land}
          voyages={voyages}
          focused={focused}
          inspectedVoyageId={inspectedVoyageId}
          onInspectVoyage={inspectVoyage}
        />
      </GlobeErrorBoundary>

      {/* right rail: which ships care, and what it costs to act */}
      {focused ? (
        <VoyageFocusPanel voyage={focused} onBack={() => focusVoyage(null)} />
      ) : (
        <ImpactPanel selectedVoyageId={null} onSelect={focusVoyage} />
      )}

      {/* top-left HUD: count + filters */}
      {signals && (
        <FilterBar
          signals={signals}
          visibleCount={filtered.length}
          activeCategories={activeCategories}
          onToggleCategory={toggleCategory}
          severityFilter={severityFilter}
          onSeverityFilter={setSeverityFilter}
        />
      )}

      {/* lane legend — bottom-left, above the ticker */}
      <div
        style={{
          position: 'absolute',
          left: 16,
          bottom: TICKER_HEIGHT + 12,
          zIndex: 45,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '7px 12px',
          borderRadius: 10,
          background: 'rgba(7,16,28,0.72)',
          border: `1px solid ${UI.panelBorder}`,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      >
        <Route size={12} style={{ color: UI.label, flexShrink: 0 }} />
        {LANE_LEGEND.map((item) => (
          <span
            key={item.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.05em',
              color: UI.textMuted,
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                width: 14,
                height: 2,
                borderRadius: 2,
                background: item.color,
                boxShadow: `0 0 5px ${item.color}`,
                flexShrink: 0,
              }}
            />
            {item.label}
          </span>
        ))}
      </div>

      {/* interaction hint — bottom-right, above the ticker */}
      <div
        style={{
          position: 'absolute',
          right: 16,
          bottom: TICKER_HEIGHT + 12,
          zIndex: 45,
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '7px 12px',
          borderRadius: 10,
          background: 'rgba(7,16,28,0.72)',
          border: `1px solid ${UI.panelBorder}`,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: '0.16em',
          color: UI.label,
          textTransform: 'uppercase',
          userSelect: 'none',
        }}
      >
        <MousePointer2 size={11} />
        Scroll to zoom · Drag to pan
      </div>

      {/* loading veil */}
      {!signals && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 70,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            background: 'rgba(4, 8, 15, 0.6)',
          }}
        >
          <span
            className="om-globe-pulse"
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: UI.primary,
              boxShadow: `0 0 14px ${UI.primary}`,
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.22em',
              color: UI.label,
              textTransform: 'uppercase',
            }}
          >
            Establishing signal uplink
          </span>
        </div>
      )}

      {/* right slide-in briefing */}
      <SignalDetailPanel signal={selected} onClose={() => setSelected(null)} />

      {/* bottom captured-news ticker */}
      {signals && <NewsTicker signals={signals} onSelect={setSelected} />}
    </div>
  );
}
