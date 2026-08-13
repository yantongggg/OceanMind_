/**
 * Voyages — fleet board. Eight active voyages with route, progress, ETA
 * drift, CO₂ to date and open-decision badges. Table and grid views.
 */

import { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Rows3, Search, Ship } from 'lucide-react';
import type { Decision, Voyage, VoyageStatus } from '../../data/types';
import { getDecisions, getVoyages } from '../../lib/api';
import { useRefetchTick } from '../../lib/useNowClock';
import { FleetGrid, FleetTable, type PendingInfo } from '../components/voyages/FleetViews';
import { STATUS_META, etaDeltaHours, fmtInt } from '../components/voyages/geo';

type ViewMode = 'table' | 'grid';
type StatusFilter = 'all' | VoyageStatus;

function StatTile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="premium-glass-card" style={{ padding: '16px 20px', flex: 1, minWidth: 180 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5A8AB4', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: tone ?? '#EAF4FF', lineHeight: 1.1, fontFamily: "'JetBrains Mono', monospace" }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#8BA8C8', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

export function VoyagesPage() {
  const refetchTick = useRefetchTick();
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<ViewMode>('table');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    let cancelled = false;
    Promise.all([getVoyages(), getDecisions()]).then(([v, d]) => {
      if (cancelled) return;
      setVoyages(v);
      setDecisions(d);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [refetchTick]);

  const pendingByVoyage = useMemo(() => {
    const map: Record<string, PendingInfo> = {};
    for (const d of decisions) {
      if (d.status !== 'pending') continue;
      const cur = map[d.voyageId] ?? { count: 0, critical: false };
      cur.count += 1;
      cur.critical = cur.critical || d.severity === 'critical';
      map[d.voyageId] = cur;
    }
    return map;
  }, [decisions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return voyages.filter((v) => {
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;
      if (!q) return true;
      return [v.id, v.vessel.name, v.vessel.type, v.originPort, v.destinationPort, v.charterer]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [voyages, query, statusFilter]);

  const kpis = useMemo(() => {
    const active = voyages.filter((v) => v.status !== 'completed');
    const delayed = voyages.filter((v) => etaDeltaHours(v) > 0).length;
    const co2 = voyages.reduce((sum, v) => sum + v.co2ToDateTonnes, 0);
    const pending = Object.values(pendingByVoyage).reduce((s, p) => s + p.count, 0);
    return { active: active.length, delayed, co2, pending };
  }, [voyages, pendingByVoyage]);

  const statusOptions: StatusFilter[] = useMemo(() => {
    const present = new Set(voyages.map((v) => v.status));
    return ['all', ...(['underway', 'rerouted', 'delayed', 'at_anchor', 'in_port', 'completed'] as VoyageStatus[]).filter((s) => present.has(s))];
  }, [voyages]);

  return (
    <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(45,212,191,0.10)',
              border: '1px solid rgba(45,212,191,0.28)',
            }}
          >
            <Ship size={19} style={{ color: '#2DD4BF' }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.16em', fontWeight: 700 }}>
              Fleet Tracking
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#EAF4FF', lineHeight: 1.1, letterSpacing: '-0.02em', margin: 0 }}>
              Voyages
            </h1>
          </div>
        </div>

        {/* View toggle */}
        <div
          style={{
            display: 'flex',
            gap: 2,
            padding: 3,
            borderRadius: 10,
            background: 'rgba(8,19,31,0.9)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {(
            [
              { mode: 'table' as ViewMode, icon: <Rows3 size={14} />, label: 'Table' },
              { mode: 'grid' as ViewMode, icon: <LayoutGrid size={14} />, label: 'Grid' },
            ]
          ).map((opt) => (
            <button
              key={opt.mode}
              onClick={() => setView(opt.mode)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                color: view === opt.mode ? '#07111D' : '#8BA8C8',
                background: view === opt.mode ? '#2DD4BF' : 'transparent',
                transition: 'all 200ms ease',
              }}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <StatTile label="Active voyages" value={String(kpis.active)} sub="across APAC & global trade lanes" />
        <StatTile
          label="Behind plan"
          value={String(kpis.delayed)}
          sub="ETA drifted past plan of record"
          tone={kpis.delayed > 0 ? '#E8A043' : '#00D47E'}
        />
        <StatTile label="Fleet CO₂ to date" value={`${fmtInt(kpis.co2)} t`} sub="emitted on active voyages (IMO factors)" />
        <StatTile
          label="Open decisions"
          value={String(kpis.pending)}
          sub="awaiting Voyage Operations Manager"
          tone={kpis.pending > 0 ? '#C75A5A' : '#00D47E'}
        />
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 10,
            background: 'rgba(5,11,20,0.8)',
            border: '1px solid rgba(255,255,255,0.08)',
            minWidth: 260,
          }}
        >
          <Search size={14} style={{ color: '#5A8AB4', flexShrink: 0 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vessel, voyage, port, charterer…"
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#EAF4FF',
              fontSize: 12.5,
              width: '100%',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {statusOptions.map((s) => {
            const isActive = statusFilter === s;
            const label = s === 'all' ? 'All' : STATUS_META[s].label;
            const color = s === 'all' ? '#2DD4BF' : STATUS_META[s].color;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: '5px 13px',
                  borderRadius: 999,
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: isActive ? color : '#8BA8C8',
                  background: isActive ? `color-mix(in srgb, ${color} 10%, transparent)` : 'transparent',
                  border: `1px solid ${isActive ? `color-mix(in srgb, ${color} 36%, transparent)` : 'rgba(255,255,255,0.10)'}`,
                  transition: 'all 200ms ease',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#5A8AB4', fontFamily: "'JetBrains Mono', monospace" }}>
          {filtered.length} / {voyages.length} voyages
        </span>
      </div>

      {/* Board */}
      {!loaded ? (
        <div className="premium-glass-card ai-processing" style={{ padding: '64px 32px', textAlign: 'center', color: '#5A8AB4', fontSize: 13 }}>
          Loading fleet…
        </div>
      ) : filtered.length === 0 ? (
        <div className="premium-glass-card" style={{ padding: '64px 32px', textAlign: 'center' }}>
          <Ship size={26} style={{ color: 'rgba(45,212,191,0.5)', marginBottom: 8 }} />
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#BFD7F7' }}>No voyages match</div>
          <p style={{ fontSize: 12, color: '#5A8AB4', margin: '4px 0 0' }}>Try clearing the search or the status filter.</p>
        </div>
      ) : view === 'table' ? (
        <FleetTable voyages={filtered} pendingByVoyage={pendingByVoyage} />
      ) : (
        <FleetGrid voyages={filtered} pendingByVoyage={pendingByVoyage} />
      )}
    </div>
  );
}
