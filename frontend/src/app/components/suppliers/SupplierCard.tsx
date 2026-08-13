import { motion } from 'motion/react';
import { Anchor, AlertTriangle, BadgeCheck, ShieldCheck, Sparkles } from 'lucide-react';
import type { Supplier } from '../../../data/types';
import { SupplierLogo } from './SupplierLogo';
import { DnaRing } from './DnaRing';
import { ScoreBar } from './ScoreBar';
import { TrendSparkline } from './TrendSparkline';
import { dnaScore, dnaTier, dnaTrend, isGoldenSupplier, SUB_SCORES } from './dna';

/**
 * One supplier DNA card. Clicking anywhere opens the detail drawer.
 * The golden-scenario pick (Straits Marine Energy) gets a teal ring and a
 * "Recommended · DEC-0042" ribbon so the demo story reads instantly.
 */
export interface SupplierCardProps {
  supplier: Supplier;
  index: number;              // stagger order for the entrance animation
  onOpen: (s: Supplier) => void;
}

export function SupplierCard({ supplier, index, onOpen }: SupplierCardProps) {
  const score = dnaScore(supplier);
  const tier = dnaTier(score);
  const golden = isGoldenSupplier(supplier);
  const trend = dnaTrend(supplier);
  const incidentCount = supplier.incidents.length;
  const worstIncident = supplier.incidents.find((i) => i.severity === 'critical' || i.severity === 'high');

  return (
    <motion.button
      type="button"
      onClick={() => onOpen(supplier)}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ y: -2 }}
      style={{
        position: 'relative', textAlign: 'left', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 16,
        padding: '20px 22px',
        background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
        border: golden ? '1px solid rgba(45,212,191,0.45)' : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        boxShadow: golden
          ? '0 0 0 1px rgba(45,212,191,0.12), 0 8px 24px rgba(0,0,0,0.35), 0 0 24px rgba(45,212,191,0.06)'
          : '0 4px 16px rgba(0,0,0,0.35)',
        transition: 'border-color 200ms ease, box-shadow 200ms ease',
        width: '100%', fontFamily: 'inherit',
      }}
    >
      {golden && (
        <div
          style={{
            position: 'absolute', top: -11, left: 18,
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 999,
            background: '#0B2A28', border: '1px solid rgba(45,212,191,0.5)',
            boxShadow: '0 0 12px rgba(45,212,191,0.18)',
          }}
        >
          <Sparkles size={11} style={{ color: '#2DD4BF' }} strokeWidth={2} />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#5EEAD4', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Recommended · DEC-0042
          </span>
        </div>
      )}

      {/* Header: logo + name + port | DNA ring */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <SupplierLogo id={supplier.id} name={supplier.name} size={46} borderColor={tier.border} />
        <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#EAF4FF', letterSpacing: '-0.01em', lineHeight: 1.25 }}>
            {supplier.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
            <Anchor size={11} style={{ color: '#5A8AB4' }} strokeWidth={1.75} />
            <span style={{ fontSize: 11.5, color: '#8BA8C8' }}>{supplier.port}</span>
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>·</span>
            <span style={{ fontSize: 11.5, color: '#5A8AB4' }}>{supplier.yearsActive} yrs</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: tier.color, background: tier.soft, border: `1px solid ${tier.border}`,
                padding: '2px 8px', borderRadius: 999,
              }}
            >
              {tier.label}
            </span>
            {incidentCount === 0 ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: '#00D47E' }}>
                <ShieldCheck size={11} strokeWidth={2} /> 0 incidents
              </span>
            ) : (
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600,
                  color: worstIncident ? '#C75A5A' : '#E8A043',
                }}
              >
                <AlertTriangle size={11} strokeWidth={2} />
                {incidentCount} incident{incidentCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <DnaRing score={score} size={72} />
      </div>

      {/* Sub-scores */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 18, rowGap: 10 }}>
        {SUB_SCORES.slice(0, 4).map((s) => (
          <ScoreBar key={s.key} label={s.label} value={supplier[s.key]} hint={s.hint} />
        ))}
      </div>

      {/* Trend + footer meta */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: '#5A8AB4', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            12-mo DNA trend
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: '#8BA8C8' }}>
            <BadgeCheck size={11} style={{ color: '#5A8AB4' }} strokeWidth={1.75} />
            {supplier.deliveriesYtd} deliveries YTD
          </span>
        </div>
        <TrendSparkline data={trend} gradientId={`spark-${supplier.id}`} />
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {supplier.fuelsOffered.slice(0, 4).map((f) => (
            <span
              key={f}
              style={{
                fontSize: 9.5, fontWeight: 600, color: '#8BA8C8',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                padding: '2px 7px', borderRadius: 6,
              }}
            >
              {f}
            </span>
          ))}
          {supplier.fuelsOffered.length > 4 && (
            <span style={{ fontSize: 9.5, fontWeight: 600, color: '#5A8AB4', padding: '2px 4px' }}>
              +{supplier.fuelsOffered.length - 4}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}
