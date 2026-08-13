/**
 * RouteComparisonTable — per-route economics & carbon comparison.
 * Distance, ETA, fuel, CO₂, EU ETS (estimate) and composite risk, with
 * deltas versus the plan of record. Row click selects the route on the map.
 */

import { Fragment } from 'react';
import type { CSSProperties } from 'react';
import type { RouteOption, Voyage } from '../../../data/types';
import { estimateEuEtsUsd, fmtInt, fmtUsd, riskColor, routeVisual } from './geo';

function Delta({ value, unit, invert = false }: { value: number; unit: string; invert?: boolean }) {
  if (Math.abs(value) < 0.05) return null;
  const bad = invert ? value < 0 : value > 0;
  return (
    <span style={{ fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace", color: bad ? '#E8A043' : '#00D47E' }}>
      {value > 0 ? '+' : '−'}
      {Math.abs(value) % 1 === 0 ? fmtInt(Math.abs(value)) : Math.abs(value).toFixed(1)}
      {unit}
    </span>
  );
}

const TH_STYLE: CSSProperties = {
  padding: '8px 14px',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#5A8AB4',
  textAlign: 'right',
  whiteSpace: 'nowrap',
};

const TD_STYLE: CSSProperties = {
  padding: '10px 14px',
  fontSize: 12.5,
  color: '#EAF4FF',
  textAlign: 'right',
  fontFamily: "'JetBrains Mono', monospace",
  whiteSpace: 'nowrap',
  verticalAlign: 'top',
};

interface Props {
  voyage: Voyage;
  selectedRouteId: string;
  onSelectRoute: (id: string) => void;
}

export function RouteComparisonTable({ voyage, selectedRouteId, onSelectRoute }: Props) {
  const baseline = voyage.routeOptions.find((r) => r.id === voyage.activeRouteId) ?? voyage.routeOptions[0];

  const roleTag = (route: RouteOption) => {
    const v = routeVisual(route, voyage);
    const label = v.role === 'current' ? 'PLAN OF RECORD' : v.role === 'recommended' ? 'RECOMMENDED' : 'REJECTED';
    return (
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.1em',
          padding: '2px 7px',
          borderRadius: 999,
          color: v.color,
          background: `color-mix(in srgb, ${v.color} 10%, transparent)`,
          border: `1px solid color-mix(in srgb, ${v.color} 32%, transparent)`,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    );
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(16,32,51,0.5)' }}>
            <th style={{ ...TH_STYLE, textAlign: 'left' }}>Route option</th>
            <th style={TH_STYLE}>Distance</th>
            <th style={TH_STYLE}>ETA</th>
            <th style={TH_STYLE}>Fuel</th>
            <th style={TH_STYLE}>Fuel cost</th>
            <th style={TH_STYLE}>CO₂</th>
            <th style={TH_STYLE}>EU ETS est.*</th>
            <th style={TH_STYLE}>Risk</th>
          </tr>
        </thead>
        <tbody>
          {voyage.routeOptions.map((route) => {
            const visual = routeVisual(route, voyage);
            const isSelected = route.id === selectedRouteId;
            const isBaseline = route.id === baseline.id;
            const ets = estimateEuEtsUsd(route, voyage);
            return (
              <Fragment key={route.id}>
                <tr
                  onClick={() => onSelectRoute(route.id)}
                  style={{
                    borderBottom: isSelected ? 'none' : '1px solid rgba(255,255,255,0.06)',
                    background: isSelected ? 'rgba(45,212,191,0.06)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 200ms ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'rgba(23,39,66,0.35)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <svg width={20} height={6} style={{ flexShrink: 0 }}>
                        <line
                          x1={1}
                          y1={3}
                          x2={19}
                          y2={3}
                          stroke={visual.color}
                          strokeWidth={2.5}
                          strokeDasharray={visual.dash}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#EAF4FF' }}>{route.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {roleTag(route)}
                      <span style={{ fontSize: 10.5, color: '#5A8AB4' }}>via {route.viaChokepoints.join(' · ')}</span>
                    </div>
                  </td>
                  <td style={TD_STYLE}>{fmtInt(route.distanceNm)} nm</td>
                  <td style={TD_STYLE}>
                    <div>{route.etaDays.toFixed(1)} d</div>
                    {!isBaseline && <Delta value={route.etaDays - baseline.etaDays} unit=" d" />}
                  </td>
                  <td style={TD_STYLE}>
                    <div>{fmtInt(route.fuelTonnes)} t</div>
                    {!isBaseline && <Delta value={route.fuelTonnes - baseline.fuelTonnes} unit=" t" />}
                  </td>
                  <td style={TD_STYLE}>
                    <div>{fmtUsd(route.fuelUsd)}</div>
                    {!isBaseline && (
                      <Delta value={(route.fuelUsd - baseline.fuelUsd) / 1000} unit="k" />
                    )}
                  </td>
                  <td style={TD_STYLE}>
                    <div>{fmtInt(route.co2Tonnes)} t</div>
                    {!isBaseline && (
                      <Delta
                        value={((route.co2Tonnes - baseline.co2Tonnes) / baseline.co2Tonnes) * 100}
                        unit="%"
                      />
                    )}
                  </td>
                  <td style={TD_STYLE}>{ets == null ? '—' : fmtUsd(ets)}</td>
                  <td style={{ ...TD_STYLE, minWidth: 96 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                      <div
                        style={{
                          width: 44,
                          height: 4,
                          borderRadius: 999,
                          background: 'rgba(255,255,255,0.08)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${route.riskScore}%`,
                            height: '100%',
                            borderRadius: 999,
                            background: riskColor(route.riskScore),
                          }}
                        />
                      </div>
                      <span style={{ color: riskColor(route.riskScore), fontWeight: 700 }}>{route.riskScore}</span>
                    </div>
                  </td>
                </tr>
                {isSelected && route.notes && (
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(45,212,191,0.04)' }}>
                    <td colSpan={8} style={{ padding: '0 14px 12px 42px' }}>
                      <p style={{ fontSize: 11.5, lineHeight: 1.55, color: '#8BA8C8', margin: 0, whiteSpace: 'normal' }}>
                        {route.notes}
                      </p>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <p style={{ fontSize: 10, color: '#5A8AB4', margin: '10px 14px 0', lineHeight: 1.5 }}>
        * EU ETS estimate: full-route CO₂ × 50% extra-EU scope × 70% 2026 phase-in × €72/EUA × 1.08 USD/EUR.
        Decision-grade figures come from the deterministic carbon tool on the linked decision.
      </p>
    </div>
  );
}
