import { useEffect, useMemo, useState } from 'react';
import { Dna, Globe2, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import type { Supplier, Voyage } from '../../data/types';
import { getSuppliers, getVoyages } from '../../lib/api';
import { SupplierCard } from '../components/suppliers/SupplierCard';
import { SupplierDetailDrawer } from '../components/suppliers/SupplierDetailDrawer';
import { dnaScore } from '../components/suppliers/dna';

/**
 * Suppliers — "Supplier DNA".
 *
 * Composite-scored bunker supplier intelligence: reliability, fuel quality,
 * ESG and alt-fuel readiness rolled into one DNA score per supplier, with
 * incident history and fleet port coverage in a click-through drawer.
 * Straits Marine Energy (SUP-001) is highlighted as the DEC-0042 pick.
 */
export function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [selected, setSelected] = useState<Supplier | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getSuppliers(), getVoyages()]).then(([s, v]) => {
      if (!alive) return;
      setSuppliers(s);
      setVoyages(v);
    });
    return () => { alive = false; };
  }, []);

  const ranked = useMemo(
    () => [...suppliers].sort((a, b) => dnaScore(b) - dnaScore(a)),
    [suppliers],
  );

  const stats = useMemo(() => {
    if (suppliers.length === 0) return null;
    const scores = suppliers.map(dnaScore);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const clean = suppliers.filter((s) => s.incidents.length === 0).length;
    const ports = new Set(suppliers.map((s) => s.port)).size;
    const altReady = suppliers.filter((s) => s.altFuelReadiness >= 70).length;
    return { avg, clean, ports, altReady };
  }, [suppliers]);

  return (
    <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40, height: 40, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(45,212,191,0.10)', border: '1px solid rgba(45,212,191,0.28)',
            }}
          >
            <Users size={19} style={{ color: '#2DD4BF' }} strokeWidth={1.75} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.16em', fontWeight: 700 }}>
              Supplier DNA
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#EAF4FF', lineHeight: 1.1, letterSpacing: '-0.02em', margin: 0 }}>
              Suppliers
            </h1>
          </div>
        </div>
        <p style={{ fontSize: 13, color: '#8BA8C8', maxWidth: 560, margin: 0 }}>
          Every bunker supplier scored on reliability, fuel quality, ESG and alternative-fuel
          readiness — the same DNA the Decision Agent uses to pick where the fleet fuels.
        </p>
      </div>

      {/* KPI strip */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          {[
            { icon: Dna, label: 'Network avg DNA', value: `${stats.avg}`, sub: `${suppliers.length} scored suppliers`, color: '#2DD4BF' },
            { icon: ShieldCheck, label: 'Zero-incident', value: `${stats.clean}/${suppliers.length}`, sub: 'clean delivery records', color: '#00D47E' },
            { icon: Globe2, label: 'Ports covered', value: `${stats.ports}`, sub: 'Klang · Singapore · Rotterdam…', color: '#38BDF8' },
            { icon: TrendingUp, label: 'Alt-fuel capable', value: `${stats.altReady}`, sub: 'readiness ≥ 70 / 100', color: '#E8A043' },
          ].map((k) => (
            <div
              key={k.label}
              style={{
                display: 'flex', alignItems: 'center', gap: 13,
                padding: '14px 16px', borderRadius: 14,
                background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              }}
            >
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${k.color}14`, border: `1px solid ${k.color}33`,
                }}
              >
                <k.icon size={16} style={{ color: k.color }} strokeWidth={1.75} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 19, fontWeight: 700, color: '#EAF4FF', lineHeight: 1.1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                  {k.value}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#5A8AB4', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>
                  {k.label}
                </div>
                <div style={{ fontSize: 10.5, color: '#8BA8C8', marginTop: 1 }}>{k.sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Supplier grid */}
      {ranked.length === 0 ? (
        <div
          style={{
            padding: '56px 32px', borderRadius: 14, textAlign: 'center',
            background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
            border: '1px dashed rgba(45,212,191,0.25)', color: '#5A8AB4', fontSize: 13,
          }}
        >
          Loading supplier network…
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
            gap: 18,
            paddingTop: 6, // room for the "Recommended" ribbon on the golden card
          }}
        >
          {ranked.map((s, i) => (
            <SupplierCard key={s.id} supplier={s} index={i} onOpen={setSelected} />
          ))}
        </div>
      )}

      <SupplierDetailDrawer supplier={selected} voyages={voyages} onClose={() => setSelected(null)} />
    </div>
  );
}
