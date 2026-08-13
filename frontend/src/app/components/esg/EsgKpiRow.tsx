import { Factory, Leaf, Landmark, Gauge, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react';
import type { EsgSummary } from '../../../data/types';
import { CARD, LABEL, MONO, fmtInt, fmtUsdCompact } from './esgTheme';
import { FuelEuGauge } from './FuelEuGauge';

function KpiShell({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Leaf;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ ...CARD, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 26, height: 26, borderRadius: 8, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.20)',
          }}
        >
          <Icon size={13} style={{ color: '#2DD4BF' }} strokeWidth={1.8} />
        </div>
        <span style={LABEL}>{label}</span>
      </div>
      {children}
    </div>
  );
}

function BigNumber({ value, unit }: { value: string; unit: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 27, fontWeight: 700, color: '#EAF4FF', letterSpacing: '-0.02em', fontFamily: MONO, lineHeight: 1 }}>
        {value}
      </span>
      <span style={{ fontSize: 11, color: '#7FA5D3', fontWeight: 600, whiteSpace: 'nowrap' }}>{unit}</span>
    </div>
  );
}

function Footnote({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10.5, color: '#5A8AB4', lineHeight: 1.5 }}>{children}</div>;
}

/** KPI band: fleet CO₂ · CO₂ avoided · EU ETS · FuelEU gauge · IMO status. */
export function EsgKpiRow({ esg }: { esg: EsgSummary }) {
  const ciiImproving = esg.imoCii.trend === 'improving';
  const TrendIcon = ciiImproving ? TrendingDown : TrendingUp;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))',
        gap: 14,
      }}
    >
      {/* 1 · Fleet CO₂ YTD */}
      <KpiShell icon={Factory} label="Fleet CO₂ · YTD">
        <BigNumber value={fmtInt(esg.fleetCo2YtdTonnes)} unit="tCO₂" />
        <Footnote>8 active voyages · IMO DCS verified consumption records</Footnote>
      </KpiShell>

      {/* 2 · CO₂ avoided via AI decisions */}
      <KpiShell icon={Leaf} label="CO₂ Avoided · Decisions">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <BigNumber value={fmtInt(esg.co2SavedVsBaselineTonnes)} unit="tCO₂" />
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 999,
              background: 'rgba(0,212,126,0.10)', border: '1px solid rgba(0,212,126,0.30)',
              fontSize: 11, fontWeight: 700, color: '#00D47E', fontFamily: MONO,
            }}
          >
            <TrendingDown size={11} strokeWidth={2} />
            {esg.co2SavedPct.toFixed(1)}%
          </span>
        </div>
        <Footnote>vs no-optimisation baseline — slow-steaming, reroutes &amp; bunker shifts</Footnote>
      </KpiShell>

      {/* 3 · EU ETS liability */}
      <KpiShell icon={Landmark} label="EU ETS Liability">
        <BigNumber value={fmtUsdCompact(esg.euEtsExposureUsd)} unit={`@ €${esg.euEtsAllowancePriceEur}/EUA`} />
        <Footnote>
          Phase-in 40% ’25 → <strong style={{ color: '#BFD7F7' }}>{esg.euEtsPhaseInPct}% ’26</strong> → 100% ’27 ·
          CH₄ &amp; N₂O in scope from 2026
        </Footnote>
      </KpiShell>

      {/* 4 · FuelEU gauge */}
      <KpiShell icon={Gauge} label="FuelEU GHG Intensity">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <FuelEuGauge
            value={esg.fuelEu.ghgIntensity}
            limit={esg.fuelEu.limit}
            compliant={esg.fuelEu.compliant}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              padding: '2.5px 9px', borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
              background: esg.fuelEu.compliant ? 'rgba(0,212,126,0.10)' : 'rgba(199,90,90,0.12)',
              border: `1px solid ${esg.fuelEu.compliant ? 'rgba(0,212,126,0.32)' : 'rgba(199,90,90,0.4)'}`,
              color: esg.fuelEu.compliant ? '#00D47E' : '#C75A5A',
            }}
          >
            {esg.fuelEu.compliant ? 'COMPLIANT' : 'DEFICIT'}
          </span>
          <span style={{ fontSize: 10.5, color: '#5A8AB4' }}>
            {Math.abs(esg.fuelEu.surplusDeficitPct).toFixed(1)}% {esg.fuelEu.surplusDeficitPct <= 0 ? 'surplus banked for pooling' : 'deficit'}
          </span>
        </div>
      </KpiShell>

      {/* 5 · IMO Net-Zero framework */}
      <KpiShell icon={ShieldCheck} label="IMO Net-Zero Framework">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 44, height: 44, borderRadius: 11, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,212,126,0.08)', border: '1px solid rgba(0,212,126,0.28)',
              fontSize: 22, fontWeight: 800, color: '#00D47E', fontFamily: MONO,
            }}
          >
            {esg.imoCii.fleetRating}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#EAF4FF' }}>Fleet CII rating</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: ciiImproving ? '#00D47E' : '#E8A043', fontWeight: 600 }}>
              <TrendIcon size={11} strokeWidth={2} />
              {esg.imoCii.trend}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              padding: '2.5px 9px', borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
              background: 'rgba(45,212,191,0.10)', border: '1px solid rgba(45,212,191,0.30)', color: '#2DD4BF',
            }}
          >
            ON TRACK
          </span>
          <span style={{ fontSize: 10.5, color: '#5A8AB4' }}>2030 checkpoint −20%</span>
        </div>
      </KpiShell>
    </div>
  );
}
