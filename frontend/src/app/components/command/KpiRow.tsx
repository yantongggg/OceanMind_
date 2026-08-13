/**
 * Command Center KPI strip — five fleet-level metrics derived live from the
 * shared API layer: active voyages, open disruptions, decisions pending,
 * CO₂ saved YTD vs baseline, EU ETS exposure.
 */
import { Ship, ShieldAlert, Scale, Leaf, Landmark } from 'lucide-react';
import type { Decision, EsgSummary, Signal, Voyage } from '../../../data/types';
import { ACCENT, MONO, fmtInt, fmtUsd } from './primitives';

interface KpiRowProps {
  voyages: Voyage[];
  signals: Signal[];
  decisions: Decision[];
  esg: EsgSummary;
}

interface KpiTileDef {
  label: string;
  value: string;
  unit?: string;
  sub: string;
  subColor: string;
  icon: typeof Ship;
  iconColor: string;
}

export function KpiRow({ voyages, signals, decisions, esg }: KpiRowProps) {
  const activeVoyages = voyages.filter((v) => v.status !== 'completed');
  const flagged = activeVoyages.filter((v) => v.status === 'delayed' || v.status === 'rerouted');

  // Cluster high-severity signals into disruption groups by chokepoint
  // (falling back to category for open-water / systemic signals).
  const highSev = signals.filter((s) => s.severity === 'critical' || s.severity === 'high');
  const criticalCount = signals.filter((s) => s.severity === 'critical').length;
  const disruptionClusters = new Set(highSev.map((s) => s.affectedChokepoint ?? s.category)).size;

  const pending = decisions.filter((d) => d.status === 'pending');
  const readyCount = pending.filter((d) => d.reliability === 'READY').length;

  const tiles: KpiTileDef[] = [
    {
      label: 'Active voyages',
      value: String(activeVoyages.length),
      sub: flagged.length > 0 ? `${flagged.length} flagged en route` : 'All on plan',
      subColor: flagged.length > 0 ? '#FFB84D' : '#00D47E',
      icon: Ship,
      iconColor: ACCENT,
    },
    {
      label: 'Open disruptions',
      value: String(disruptionClusters),
      sub: `${criticalCount} critical signal${criticalCount === 1 ? '' : 's'} live`,
      subColor: criticalCount > 0 ? '#FF5A5A' : '#7A94B4',
      icon: ShieldAlert,
      iconColor: '#FF5A5A',
    },
    {
      label: 'Decisions pending',
      value: String(pending.length),
      sub: readyCount > 0 ? `${readyCount} READY for approval` : 'None gated READY',
      subColor: readyCount > 0 ? '#00D47E' : '#7A94B4',
      icon: Scale,
      iconColor: '#FFB84D',
    },
    {
      label: 'CO₂ saved YTD',
      value: fmtInt(esg.co2SavedVsBaselineTonnes),
      unit: 't',
      sub: `−${esg.co2SavedPct.toFixed(1)}% vs baseline plans`,
      subColor: '#00D47E',
      icon: Leaf,
      iconColor: '#00D47E',
    },
    {
      label: 'EU ETS exposure',
      value: fmtUsd(esg.euEtsExposureUsd),
      sub: `${esg.euEtsPhaseInPct}% phase-in · EUA €${esg.euEtsAllowancePriceEur}`,
      subColor: '#7FA5D3',
      icon: Landmark,
      iconColor: '#38BDF8',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(196px, 1fr))',
        gap: 14,
      }}
    >
      {tiles.map((t) => {
        const Icon = t.icon;
        return (
          <div
            key={t.label}
            className="premium-glass-card hover-elevate"
            style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: '0.13em',
                  textTransform: 'uppercase',
                  color: '#5A8AB4',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.label}
              </span>
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `${t.iconColor}12`,
                  border: `1px solid ${t.iconColor}28`,
                  flexShrink: 0,
                }}
              >
                <Icon size={13} strokeWidth={1.8} style={{ color: t.iconColor }} />
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span
                className="tabular-nums"
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: '#EAF4FF',
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  fontFamily: MONO,
                }}
              >
                {t.value}
              </span>
              {t.unit && <span style={{ fontSize: 12, fontWeight: 600, color: '#7FA5D3' }}>{t.unit}</span>}
            </div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: t.subColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {t.sub}
            </div>
          </div>
        );
      })}
    </div>
  );
}
