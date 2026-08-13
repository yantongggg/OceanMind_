/**
 * Command Center — the '/' route. Fleet-level operational picture:
 * KPI strip, critical-disruption banner, live voyage board, disruption
 * feed, pending-decision queue and the ESG snapshot sparkline.
 * All data flows through src/lib/api.ts (backend with mock fallback).
 */
import { useEffect, useState } from 'react';
import { LayoutDashboard } from 'lucide-react';
import { motion } from 'motion/react';
import type { Decision, EsgSummary, Signal, Voyage } from '../../data/types';
import { getDecisions, getEsgSummary, getSignals, getVoyages } from '../../lib/api';
import { useRefetchTick } from '../../lib/useNowClock';
import { GoldenAlertBanner } from '../components/command/GoldenAlertBanner';
import { KpiRow } from '../components/command/KpiRow';
import { VoyageBoard } from '../components/command/VoyageBoard';
import { SignalFeed } from '../components/command/SignalFeed';
import { DecisionQueue } from '../components/command/DecisionQueue';
import { EsgSnapshot } from '../components/command/EsgSnapshot';

interface DashboardData {
  voyages: Voyage[];
  signals: Signal[];
  decisions: Decision[];
  esg: EsgSummary;
}

const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

function SkeletonBlock({ height }: { height: number }) {
  return (
    <div
      className="premium-glass-card"
      style={{ height, position: 'relative', overflow: 'hidden' }}
    >
      <div className="ai-processing" style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}

export function CommandCenterPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const refetchTick = useRefetchTick();

  useEffect(() => {
    let alive = true;
    Promise.all([getVoyages(), getSignals(), getDecisions(), getEsgSummary()]).then(
      ([voyages, signals, decisions, esg]) => {
        if (alive) setData({ voyages, signals, decisions, esg });
      },
    );
    return () => {
      alive = false;
    };
  }, [refetchTick]);

  return (
    <div style={{ padding: '26px 32px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page header */}
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
            flexShrink: 0,
          }}
        >
          <LayoutDashboard size={19} style={{ color: '#2DD4BF' }} />
        </div>
        <div>
          <div
            style={{
              fontSize: 10,
              color: '#5A8AB4',
              textTransform: 'uppercase',
              letterSpacing: '0.16em',
              fontWeight: 700,
            }}
          >
            Fleet Operations
          </div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: '#EAF4FF',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Command Center
          </h1>
        </div>
      </div>

      {!data ? (
        <>
          <SkeletonBlock height={72} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(196px, 1fr))', gap: 14 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <SkeletonBlock key={i} height={96} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 16 }}>
            <SkeletonBlock height={440} />
            <SkeletonBlock height={440} />
          </div>
        </>
      ) : (
        <>
          {/* Critical disruption banner (golden DEC-0042 path) */}
          <motion.div {...fadeUp} transition={{ duration: 0.35, delay: 0 }}>
            <GoldenAlertBanner decisions={data.decisions} voyages={data.voyages} />
          </motion.div>

          {/* KPI strip */}
          <motion.div {...fadeUp} transition={{ duration: 0.35, delay: 0.05 }}>
            <KpiRow voyages={data.voyages} signals={data.signals} decisions={data.decisions} esg={data.esg} />
          </motion.div>

          {/* Voyage board + disruption feed */}
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.35, delay: 0.1 }}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 5fr) minmax(300px, 3fr)',
              gap: 16,
              alignItems: 'stretch',
            }}
          >
            <VoyageBoard voyages={data.voyages} decisions={data.decisions} />
            <SignalFeed signals={data.signals} />
          </motion.div>

          {/* Decision queue + ESG snapshot */}
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.35, delay: 0.15 }}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 5fr) minmax(300px, 3fr)',
              gap: 16,
              alignItems: 'start',
            }}
          >
            <DecisionQueue decisions={data.decisions} />
            <EsgSnapshot esg={data.esg} />
          </motion.div>
        </>
      )}
    </div>
  );
}
