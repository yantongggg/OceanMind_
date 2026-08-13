import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router';
import {
  Anchor, ArrowUpRight, Award, Droplets, MapPin, ShieldCheck,
  Ship, Sparkles, TriangleAlert, X,
} from 'lucide-react';
import type { Supplier, Voyage } from '../../../data/types';
import { SupplierLogo } from './SupplierLogo';
import { DnaRing } from './DnaRing';
import { ScoreBar } from './ScoreBar';
import { TrendSparkline } from './TrendSparkline';
import { dnaScore, dnaTier, dnaTrend, isGoldenSupplier, severityColor, SUB_SCORES } from './dna';

/**
 * Right-hand detail drawer for one supplier: full DNA breakdown, incident
 * history, fleet port-coverage (voyages that touch the supplier's port),
 * certifications, and — for the golden pick — the DEC-0042 link.
 */
export interface SupplierDetailDrawerProps {
  supplier: Supplier | null;
  voyages: Voyage[];
  onClose: () => void;
}

const sectionLabel: CSSProperties = {
  fontSize: 10, fontWeight: 700, color: '#5A8AB4',
  letterSpacing: '0.16em', textTransform: 'uppercase',
};

function coverageFor(supplier: Supplier, voyages: Voyage[]): Voyage[] {
  return voyages.filter(
    (v) =>
      v.fuelPlan.supplierId === supplier.id ||
      v.fuelPlan.bunkerPort === supplier.port ||
      v.portCalls.some((pc) => pc.port === supplier.port),
  );
}

export function SupplierDetailDrawer({ supplier, voyages, onClose }: SupplierDetailDrawerProps) {
  return (
    <AnimatePresence>
      {supplier && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 60,
              background: 'rgba(4,10,18,0.62)', backdropFilter: 'blur(3px)',
            }}
          />
          {/* Panel */}
          <motion.aside
            key="panel"
            initial={{ x: 480, opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 480, opacity: 0.6 }}
            transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 61,
              width: 'min(460px, 94vw)',
              background: 'linear-gradient(180deg, #0C1929 0%, #081320 100%)',
              borderLeft: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '-16px 0 48px rgba(0,0,0,0.55)',
              display: 'flex', flexDirection: 'column',
            }}
            role="dialog"
            aria-label={`${supplier.name} details`}
          >
            {(() => {
              const score = dnaScore(supplier);
              const tier = dnaTier(score);
              const golden = isGoldenSupplier(supplier);
              const coverage = coverageFor(supplier, voyages);
              return (
                <>
                  {/* Header */}
                  <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                      <SupplierLogo id={supplier.id} name={supplier.name} size={52} borderColor={tier.border} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 17, fontWeight: 700, color: '#EAF4FF', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                          {supplier.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                          <Anchor size={12} style={{ color: '#5A8AB4' }} strokeWidth={1.75} />
                          <span style={{ fontSize: 12, color: '#8BA8C8' }}>
                            {supplier.port} · {supplier.lat.toFixed(2)}°, {supplier.lon.toFixed(2)}°
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                              color: tier.color, background: tier.soft, border: `1px solid ${tier.border}`,
                              padding: '2px 8px', borderRadius: 999,
                            }}
                          >
                            {tier.label} tier
                          </span>
                          <span style={{ fontSize: 10.5, color: '#5A8AB4', padding: '2px 0' }}>
                            {supplier.yearsActive} years active · {supplier.deliveriesYtd} deliveries YTD
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        style={{
                          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
                          color: '#8BA8C8', cursor: 'pointer',
                        }}
                      >
                        <X size={15} strokeWidth={2} />
                      </button>
                    </div>
                  </div>

                  {/* Scrollable body */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}>
                    {golden && (
                      <div
                        style={{
                          display: 'flex', gap: 12, alignItems: 'flex-start',
                          padding: '12px 14px', borderRadius: 12,
                          background: 'rgba(45,212,191,0.07)', border: '1px solid rgba(45,212,191,0.3)',
                        }}
                      >
                        <Sparkles size={16} style={{ color: '#2DD4BF', marginTop: 1, flexShrink: 0 }} strokeWidth={1.75} />
                        <div style={{ fontSize: 12, color: '#BFD7F7', lineHeight: 1.55 }}>
                          <strong style={{ color: '#5EEAD4' }}>Decision Agent pick — DEC-0042.</strong>{' '}
                          Selected for VYG-2026-0007's Cape reroute: USD 9/t under Singapore spot, ISCC EU
                          chain of custody on B24 biofuel, zero incidents across 212 deliveries.
                          <Link
                            to="/decisions/DEC-0042"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 6,
                              color: '#2DD4BF', fontWeight: 600, textDecoration: 'none',
                            }}
                          >
                            View decision <ArrowUpRight size={12} strokeWidth={2} />
                          </Link>
                        </div>
                      </div>
                    )}

                    {/* Composite + trend */}
                    <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
                      <DnaRing score={score} size={92} strokeWidth={6.5} caption="DNA" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={sectionLabel}>12-month trajectory</div>
                        <div style={{ marginTop: 8 }}>
                          <TrendSparkline data={dnaTrend(supplier)} gradientId={`drawer-spark-${supplier.id}`} height={56} />
                        </div>
                      </div>
                    </div>

                    {/* Full sub-score breakdown */}
                    <div>
                      <div style={sectionLabel}>DNA breakdown</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                        {SUB_SCORES.map((s) => (
                          <ScoreBar key={s.key} label={s.label} value={supplier[s.key]} hint={s.hint} detailed />
                        ))}
                      </div>
                    </div>

                    {/* Fuels offered */}
                    <div>
                      <div style={sectionLabel}>Fuels offered</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                        {supplier.fuelsOffered.map((f) => (
                          <span
                            key={f}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              fontSize: 11, fontWeight: 600, color: '#BFD7F7',
                              background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.2)',
                              padding: '4px 10px', borderRadius: 999,
                            }}
                          >
                            <Droplets size={11} style={{ color: '#38BDF8' }} strokeWidth={1.75} />
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Incident history */}
                    <div>
                      <div style={sectionLabel}>Incident history</div>
                      {supplier.incidents.length === 0 ? (
                        <div
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, marginTop: 10,
                            padding: '10px 12px', borderRadius: 10,
                            background: 'rgba(0,212,126,0.06)', border: '1px solid rgba(0,212,126,0.22)',
                          }}
                        >
                          <ShieldCheck size={15} style={{ color: '#00D47E' }} strokeWidth={1.75} />
                          <span style={{ fontSize: 12, color: '#BFD7F7' }}>
                            Zero recorded incidents — clean quality and quantity record.
                          </span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
                          {supplier.incidents.map((inc, i) => {
                            const c = severityColor(inc.severity);
                            return (
                              <div
                                key={`${inc.date}-${i}`}
                                style={{
                                  display: 'flex', gap: 12,
                                  paddingBottom: i === supplier.incidents.length - 1 ? 0 : 14,
                                  position: 'relative',
                                }}
                              >
                                {/* timeline spine */}
                                {i !== supplier.incidents.length - 1 && (
                                  <div style={{ position: 'absolute', left: 5.5, top: 14, bottom: 0, width: 1, background: 'rgba(255,255,255,0.08)' }} />
                                )}
                                <div
                                  style={{
                                    width: 12, height: 12, borderRadius: 999, marginTop: 2, flexShrink: 0,
                                    background: `${c}22`, border: `2px solid ${c}`,
                                  }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: c, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                      {inc.severity}
                                    </span>
                                    <span style={{ fontSize: 11, color: '#5A8AB4', fontVariantNumeric: 'tabular-nums' }}>
                                      {new Date(inc.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: 12, color: '#BFD7F7', lineHeight: 1.5, marginTop: 3 }}>
                                    {inc.summary}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {supplier.incidents.some((i) => i.severity === 'critical') && (
                        <div
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, marginTop: 12,
                            padding: '9px 12px', borderRadius: 10,
                            background: 'rgba(199,90,90,0.08)', border: '1px solid rgba(199,90,90,0.3)',
                          }}
                        >
                          <TriangleAlert size={14} style={{ color: '#C75A5A', flexShrink: 0 }} strokeWidth={1.75} />
                          <span style={{ fontSize: 11.5, color: '#E3B8B8' }}>
                            Active critical incident — excluded from Decision Agent recommendations.
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Port coverage — fleet touchpoints */}
                    <div>
                      <div style={sectionLabel}>Fleet port coverage</div>
                      {coverage.length === 0 ? (
                        <div style={{ fontSize: 12, color: '#5A8AB4', marginTop: 10 }}>
                          No active OceanMind voyages currently route through {supplier.port}.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                          {coverage.map((v) => (
                            <Link
                              key={v.id}
                              to={`/voyages/${v.id}`}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
                                padding: '9px 12px', borderRadius: 10,
                                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                              }}
                            >
                              <Ship size={14} style={{ color: '#38BDF8', flexShrink: 0 }} strokeWidth={1.75} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#EAF4FF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {v.vessel.name}
                                </div>
                                <div style={{ fontSize: 10.5, color: '#5A8AB4', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <MapPin size={9} strokeWidth={1.75} />
                                  {v.originPort} → {v.destinationPort}
                                  {v.fuelPlan.supplierId === supplier.id && (
                                    <span style={{ color: '#2DD4BF', fontWeight: 600 }}>· planned bunker supplier</span>
                                  )}
                                </div>
                              </div>
                              <span style={{ fontSize: 10, color: '#5A8AB4', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{v.id}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Certifications */}
                    <div>
                      <div style={sectionLabel}>Certifications</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
                        {supplier.certifications.map((c) => (
                          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Award size={13} style={{ color: '#E8A043', flexShrink: 0 }} strokeWidth={1.75} />
                            <span style={{ fontSize: 12, color: '#BFD7F7' }}>{c}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
