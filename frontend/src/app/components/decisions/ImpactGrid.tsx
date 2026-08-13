/**
 * Quantified impact grid — the "numbers card" of a decision.
 * Each tile is a delta vs the voyage's plan of record: red = cost, green = saving.
 */

import type { LucideIcon } from 'lucide-react';
import {
  Timer,
  Fuel,
  ShieldOff,
  Leaf,
  Landmark,
  Gauge,
} from 'lucide-react';
import type { Decision } from '../../../data/types';
import {
  C,
  deltaColor,
  fmtEtaDelta,
  fmtPctDelta,
  fmtTonnesDelta,
  fmtUsdDelta,
  SectionLabel,
} from './shared';

interface Tile {
  key: string;
  icon: LucideIcon;
  label: string;
  value: string;
  color: string;
  sub: string;
}

function buildTiles(decision: Decision): Tile[] {
  const { impact } = decision;
  const isGolden = decision.id === 'DEC-0042';

  const tiles: Tile[] = [
    {
      key: 'eta',
      icon: Timer,
      label: 'ETA delta',
      value: fmtEtaDelta(impact.etaHours),
      color: deltaColor(impact.etaHours),
      sub:
        impact.etaHours === 0
          ? 'Schedule unchanged'
          : impact.etaHours > 0
            ? 'vs plan of record'
            : 'earlier than plan',
    },
    {
      key: 'fuel',
      icon: Fuel,
      label: 'Fuel cost',
      value: fmtUsdDelta(impact.fuelUsd),
      color: deltaColor(impact.fuelUsd),
      sub:
        impact.fuelTonnes === 0
          ? 'No bunker change'
          : `${fmtTonnesDelta(impact.fuelTonnes)} bunker fuel`,
    },
  ];

  if (isGolden) {
    tiles.push({
      key: 'avoided',
      icon: ShieldOff,
      label: 'War-risk premium avoided',
      value: '−$400k',
      color: C.green,
      sub: '0.9% hull value + Suez convoy delay risk',
    });
  }

  tiles.push(
    {
      key: 'co2',
      icon: Leaf,
      label: 'CO₂ emissions',
      value: isGolden ? '+11.8% → +5.9%' : fmtPctDelta(decision.impact.co2Pct),
      color: deltaColor(impact.co2Pct),
      sub: isGolden
        ? `${fmtTonnesDelta(impact.co2Tonnes)} after slow-steaming 2 segments`
        : impact.co2Tonnes === 0
          ? 'No emissions change'
          : `${fmtTonnesDelta(impact.co2Tonnes)} CO₂ vs baseline`,
    },
    {
      key: 'ets',
      icon: Landmark,
      label: 'EU ETS liability',
      value: fmtUsdDelta(impact.euEtsUsd),
      color: deltaColor(impact.euEtsUsd),
      sub: isGolden ? '2026 phase-in 70% · EUA €72/t · 50% scope' : '2026 phase-in 70% applied',
    },
    {
      key: 'risk',
      icon: Gauge,
      label: 'Residual risk score',
      value: `${impact.riskScore}`,
      color: impact.riskScore <= 35 ? C.green : impact.riskScore <= 60 ? C.amber : C.red,
      sub: isGolden ? 'down from 82 on the Suez plan · lower is safer' : 'composite 0–100 · lower is safer',
    },
  );

  return tiles;
}

export function ImpactGrid({ decision }: { decision: Decision }) {
  const tiles = buildTiles(decision);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SectionLabel>Quantified impact — vs plan of record</SectionLabel>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div
              key={tile.key}
              style={{
                background: C.cardBg,
                border: C.cardBorder,
                borderRadius: 12,
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon size={13} strokeWidth={1.8} style={{ color: C.faint }} />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: C.faint,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  {tile.label}
                </span>
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: tile.color,
                  fontFamily: C.mono,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                }}
              >
                {tile.value}
              </div>
              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.45 }}>{tile.sub}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
