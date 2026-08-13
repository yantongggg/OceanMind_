/**
 * Voyage detail side panels — vessel identity, schedule (ETA drift),
 * fuel plan & bunkering. Presentational; all data flows in via props.
 */

import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';
import { Anchor, CalendarClock, ExternalLink, Fuel, Ship } from 'lucide-react';
import type { Supplier, Voyage } from '../../../data/types';
import { Progress } from '../ui/progress';
import {
  etaDeltaHours,
  flagStateEmoji,
  fmtDateTime,
  fmtEtaDelta,
  fmtInt,
  portFlag,
} from './geo';

/* ── Shared panel shell ───────────────────────────────────────────────── */

export function Panel({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="premium-glass-card" style={{ padding: 20 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#2DD4BF', display: 'inline-flex' }}>{icon}</span>
          <h3
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#5A8AB4',
              margin: 0,
            }}
          >
            {title}
          </h3>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

const ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 12,
  padding: '5px 0',
};
const KEY: CSSProperties = { fontSize: 11.5, color: '#5A8AB4', whiteSpace: 'nowrap' };
const VAL: CSSProperties = { fontSize: 12.5, color: '#EAF4FF', fontWeight: 500, textAlign: 'right' };
const MONO: CSSProperties = { ...VAL, fontFamily: "'JetBrains Mono', monospace" };

function Row({ k, v, mono = false }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div style={ROW}>
      <span style={KEY}>{k}</span>
      <span style={mono ? MONO : VAL}>{v}</span>
    </div>
  );
}

/* ── Vessel card ──────────────────────────────────────────────────────── */

export function VesselCard({ voyage }: { voyage: Voyage }) {
  const v = voyage.vessel;
  return (
    <Panel icon={<Ship size={14} strokeWidth={1.8} />} title="Vessel">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(45,212,191,0.08)',
            border: '1px solid rgba(45,212,191,0.22)',
            fontSize: 18,
          }}
        >
          {flagStateEmoji(v.flag)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: '#EAF4FF', letterSpacing: '-0.01em' }}>{v.name}</div>
          <div style={{ fontSize: 11, color: '#5A8AB4', fontFamily: "'JetBrains Mono', monospace" }}>
            IMO {v.imo} · {v.flag} flag
          </div>
        </div>
      </div>
      <Row k="Type" v={v.type} />
      <Row k="Capacity" v={v.capacity} mono />
      <Row k="Built" v={v.builtYear} mono />
      <Row k="Charterer" v={voyage.charterer} />
      <div style={{ ...ROW, alignItems: 'center' }}>
        <span style={KEY}>Bunker grades</span>
        <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {v.fuelTypes.map((f) => (
            <span
              key={f}
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 999,
                color: '#BFD7F7',
                background: 'rgba(139,168,200,0.10)',
                border: '1px solid rgba(139,168,200,0.24)',
                whiteSpace: 'nowrap',
              }}
            >
              {f}
            </span>
          ))}
        </span>
      </div>
      <div
        style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: '1px solid rgba(255,255,255,0.07)',
          fontSize: 11.5,
          lineHeight: 1.55,
          color: '#8BA8C8',
        }}
      >
        {voyage.cargo}
      </div>
    </Panel>
  );
}

/* ── Schedule card ────────────────────────────────────────────────────── */

export function ScheduleCard({ voyage }: { voyage: Voyage }) {
  const delta = etaDeltaHours(voyage);
  const deltaColor = delta > 0 ? '#E8A043' : delta < 0 ? '#00D47E' : '#8BA8C8';
  return (
    <Panel icon={<CalendarClock size={14} strokeWidth={1.8} />} title="Schedule">
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={KEY}>Route progress</span>
          <span style={{ ...MONO, color: '#2DD4BF', fontWeight: 700 }}>{voyage.progressPct}%</span>
        </div>
        <Progress value={voyage.progressPct} className="h-1.5 bg-white/10" />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
          <span style={{ fontSize: 10.5, color: '#8BA8C8' }}>
            {portFlag(voyage.originPort)} {voyage.originPort}
          </span>
          <span style={{ fontSize: 10.5, color: '#8BA8C8' }}>
            {portFlag(voyage.destinationPort)} {voyage.destinationPort}
          </span>
        </div>
      </div>

      <Row k="Departed" v={fmtDateTime(voyage.departedAt)} mono />
      <Row
        k="ETA · plan of record"
        v={
          <span style={{ textDecoration: delta !== 0 ? 'line-through' : 'none', opacity: delta !== 0 ? 0.55 : 1 }}>
            {fmtDateTime(voyage.etaOriginal)}
          </span>
        }
        mono
      />
      <Row k="ETA · current" v={fmtDateTime(voyage.etaCurrent)} mono />
      <div style={{ ...ROW, alignItems: 'center' }}>
        <span style={KEY}>Drift vs plan</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace",
            padding: '2px 9px',
            borderRadius: 999,
            color: deltaColor,
            background: `color-mix(in srgb, ${deltaColor} 10%, transparent)`,
            border: `1px solid color-mix(in srgb, ${deltaColor} 30%, transparent)`,
          }}
        >
          {fmtEtaDelta(delta)}
        </span>
      </div>

      {voyage.portCalls.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ ...KEY, marginBottom: 6, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 10 }}>
            Port calls
          </div>
          {voyage.portCalls.map((pc) => (
            <div key={`${pc.port}-${pc.etaISO}`} style={{ ...ROW, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#BFD7F7' }}>
                {portFlag(pc.port)} {pc.port}
                <span style={{ fontSize: 10, color: '#5A8AB4', marginLeft: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {pc.purpose}
                </span>
              </span>
              <span style={{ textAlign: 'right' }}>
                <span style={{ ...MONO, fontSize: 11.5 }}>{fmtDateTime(pc.etaISO)}</span>
                {pc.congestionHours != null && (
                  <span
                    style={{
                      display: 'block',
                      fontSize: 10,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: pc.congestionHours > 20 ? '#E8A043' : '#8BA8C8',
                    }}
                  >
                    ~{pc.congestionHours} h wait
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ── Fuel plan & bunkering card ───────────────────────────────────────── */

export function FuelPlanCard({ voyage, supplier }: { voyage: Voyage; supplier?: Supplier }) {
  const fp = voyage.fuelPlan;
  const consumedPct = Math.min(100, Math.round((fp.consumedTonnes / Math.max(fp.plannedTonnes, 1)) * 100));
  return (
    <Panel icon={<Fuel size={14} strokeWidth={1.8} />} title="Fuel plan & bunkering">
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={KEY}>Consumed · {fp.fuelType}</span>
          <span style={MONO}>
            {fmtInt(fp.consumedTonnes)} / {fmtInt(fp.plannedTonnes)} t
          </span>
        </div>
        <Progress value={consumedPct} className="h-1.5 bg-white/10" />
      </div>

      <Row k="Remaining plan" v={`${fmtInt(fp.plannedTonnes - fp.consumedTonnes)} t`} mono />
      <Row k="CO₂ emitted to date" v={`${fmtInt(voyage.co2ToDateTonnes)} t`} mono />
      <div style={{ ...ROW, alignItems: 'center' }}>
        <span style={KEY}>Next bunkering</span>
        <span style={{ ...VAL, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Anchor size={11} style={{ color: '#5A8AB4' }} />
          {portFlag(fp.bunkerPort)} {fp.bunkerPort}
        </span>
      </div>

      <div
        style={{
          marginTop: 10,
          padding: '10px 12px',
          borderRadius: 10,
          background: supplier ? 'rgba(45,212,191,0.05)' : 'rgba(139,168,200,0.05)',
          border: `1px solid ${supplier ? 'rgba(45,212,191,0.20)' : 'rgba(139,168,200,0.16)'}`,
        }}
      >
        {supplier ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#EAF4FF' }}>{supplier.name}</div>
                <div style={{ fontSize: 10.5, color: '#5A8AB4' }}>
                  Supplier DNA · reliability {supplier.reliability}/100 · ESG {supplier.esgScore}/100
                </div>
              </div>
              <Link
                to="/suppliers"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#2DD4BF',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                Profile <ExternalLink size={11} />
              </Link>
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
              {supplier.certifications.slice(0, 3).map((c) => (
                <span
                  key={c}
                  style={{
                    fontSize: 9.5,
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: 999,
                    color: '#8BA8C8',
                    background: 'rgba(139,168,200,0.08)',
                    border: '1px solid rgba(139,168,200,0.2)',
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 11.5, color: '#8BA8C8' }}>
            No supplier locked for {fp.bunkerPort} yet —{' '}
            <Link to="/suppliers" style={{ color: '#2DD4BF', textDecoration: 'none', fontWeight: 600 }}>
              browse Supplier DNA scores
            </Link>
            .
          </div>
        )}
      </div>
    </Panel>
  );
}
