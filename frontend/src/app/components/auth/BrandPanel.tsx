import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Radar, Ship, Leaf, ChevronRight } from 'lucide-react';
import { mockSignals, mockVoyages, mockEsgSummary } from '../../../data/mock';
import type { Severity } from '../../../data/types';
import { OceanCanvas } from './OceanCanvas';

const STAGES = ['Detect', 'Explain', 'Simulate', 'Recommend', 'Approve'];

const SEVERITY_COLOR: Record<Severity, string> = {
  low: '#8BA8C8',
  medium: '#38BDF8',
  high: '#E8A043',
  critical: '#C75A5A',
};

function StatChip({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3"
      style={{
        background: 'rgba(14, 28, 45, 0.62)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ background: 'rgba(45,212,191,0.10)', border: '1px solid rgba(45,212,191,0.25)' }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[17px] font-bold leading-tight tracking-tight" style={{ color: '#EAF4FF' }}>
          {value}
        </div>
        <div
          className="text-[10px] font-semibold uppercase leading-tight"
          style={{ color: '#5A8AB4', letterSpacing: '0.1em' }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

/**
 * Left hero of the login screen: animated ocean backdrop, OceanMind brand,
 * pipeline stages and a rotating live-signal ticker fed by the shared mock
 * dataset — a preview of the intelligence waiting behind the sign-in.
 */
export function BrandPanel() {
  const tickerSignals = useMemo(
    () =>
      [...mockSignals]
        .sort((a, b) => (a.severity === 'critical' ? -1 : 0) - (b.severity === 'critical' ? -1 : 0))
        .slice(0, 8),
    [],
  );
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (tickerSignals.length < 2) return;
    const id = setInterval(() => setTick((t) => (t + 1) % tickerSignals.length), 4200);
    return () => clearInterval(id);
  }, [tickerSignals.length]);

  const signal = tickerSignals[tick];
  const underway = mockVoyages.filter((v) => v.status !== 'completed').length;

  return (
    <div
      className="relative hidden h-full flex-col justify-between overflow-hidden p-12 lg:flex xl:p-16"
      style={{
        background:
          'radial-gradient(ellipse 1000px 700px at 20% 0%, rgba(45,212,191,0.07) 0%, transparent 55%), linear-gradient(160deg, #08131F 0%, #07111D 45%, #050D16 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <OceanCanvas />

      {/* Brand row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 flex items-center gap-3.5"
      >
        <img src="/oceanmind-logo.svg" alt="OceanMind" className="h-11 w-11" />
        <div>
          <div className="text-[20px] font-bold tracking-tight" style={{ color: '#EAF4FF' }}>
            OceanMind
          </div>
          <div
            className="text-[10px] font-semibold uppercase"
            style={{ color: '#2DD4BF', letterSpacing: '0.18em' }}
          >
            Voyage Intelligence
          </div>
        </div>
      </motion.div>

      {/* Headline block */}
      <div className="relative z-10 max-w-xl">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
        >
          <span
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[10.5px] font-bold uppercase"
            style={{
              color: '#5EEAD4',
              letterSpacing: '0.14em',
              background: 'rgba(45,212,191,0.08)',
              border: '1px solid rgba(45,212,191,0.28)',
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: '#2DD4BF', boxShadow: '0 0 8px rgba(45,212,191,0.8)' }}
            />
            MAIC Nexus 2026 · Track 6 — AI for ESG &amp; SDG
          </span>

          <h1
            className="mt-6 text-[42px] font-bold leading-[1.12] tracking-tight xl:text-[48px]"
            style={{ color: '#EAF4FF', letterSpacing: '-0.025em' }}
          >
            One explainable decision
            <br />
            for every{' '}
            <span
              style={{
                background: 'linear-gradient(100deg, #5EEAD4 0%, #2DD4BF 45%, #38BDF8 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              disrupted voyage
            </span>
            .
          </h1>

          <p className="mt-5 max-w-lg text-[15px] leading-relaxed" style={{ color: '#8BA8C8' }}>
            AI Decision Intelligence for Sustainable Maritime Operations. Specialised agents turn
            live maritime signals into carbon-aware, audit-ready voyage recommendations — with a
            human always in command.
          </p>

          {/* Pipeline stages */}
          <div className="mt-7 flex flex-wrap items-center gap-1.5">
            {STAGES.map((stage, i) => (
              <div key={stage} className="flex items-center gap-1.5">
                <span
                  className="rounded-md px-2.5 py-1 text-[11px] font-semibold"
                  style={{
                    color: i === STAGES.length - 1 ? '#00D47E' : '#BFD7F7',
                    background: 'rgba(16,32,51,0.75)',
                    border: `1px solid ${
                      i === STAGES.length - 1 ? 'rgba(0,212,126,0.35)' : 'rgba(255,255,255,0.09)'
                    }`,
                  }}
                >
                  {stage}
                </span>
                {i < STAGES.length - 1 && (
                  <ChevronRight size={11} style={{ color: '#3D5A75' }} strokeWidth={2.5} />
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Live signal ticker */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
          className="mt-8 overflow-hidden rounded-xl"
          style={{
            background: 'rgba(8,19,31,0.72)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div
            className="flex items-center gap-2 px-4 pt-3 text-[9.5px] font-bold uppercase"
            style={{ color: '#5A8AB4', letterSpacing: '0.16em' }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: '#00D47E',
                boxShadow: '0 0 8px rgba(0,212,126,0.7)',
                animation: 'livePulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              }}
            />
            Live intelligence feed
          </div>
          <div className="relative h-[52px] px-4">
            <AnimatePresence mode="wait">
              {signal && (
                <motion.div
                  key={signal.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35 }}
                  className="absolute inset-x-4 top-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                      style={{
                        color: SEVERITY_COLOR[signal.severity],
                        border: `1px solid ${SEVERITY_COLOR[signal.severity]}55`,
                        letterSpacing: '0.08em',
                      }}
                    >
                      {signal.severity}
                    </span>
                    <span
                      className="truncate text-[12.5px] font-medium"
                      style={{ color: '#BFD7F7' }}
                    >
                      {signal.title}
                    </span>
                  </div>
                  <div className="mt-1 text-[10.5px]" style={{ color: '#5A8AB4' }}>
                    {signal.source} · {signal.corroboration} corroborating sources
                    {signal.affectedChokepoint ? ` · ${signal.affectedChokepoint}` : ''}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Bottom stats */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.45, ease: 'easeOut' }}
        className="relative z-10 flex flex-wrap gap-3"
      >
        <StatChip
          icon={<Radar size={16} style={{ color: '#2DD4BF' }} strokeWidth={1.75} />}
          value={String(mockSignals.length)}
          label="Signals monitored"
        />
        <StatChip
          icon={<Ship size={16} style={{ color: '#38BDF8' }} strokeWidth={1.75} />}
          value={String(underway)}
          label="Voyages underway"
        />
        <StatChip
          icon={<Leaf size={16} style={{ color: '#00D47E' }} strokeWidth={1.75} />}
          value={`${(mockEsgSummary.co2SavedVsBaselineTonnes / 1000).toFixed(1)}kt`}
          label="CO₂ saved YTD"
        />
      </motion.div>
    </div>
  );
}
