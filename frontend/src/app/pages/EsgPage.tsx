import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Leaf, FileDown, Loader2 } from 'lucide-react';
import type { Decision, EsgSummary, Voyage } from '../../data/types';
import { getDecisions, getEsgSummary, getVoyages } from '../../lib/api';
import { LABEL } from '../components/esg/esgTheme';
import { EsgKpiRow } from '../components/esg/EsgKpiRow';
import { EmissionsTrendChart } from '../components/esg/EmissionsTrendChart';
import { FuelMixDonut } from '../components/esg/FuelMixDonut';
import { VoyageEmissionsChart } from '../components/esg/VoyageEmissionsChart';
import { DecisionImpactTable } from '../components/esg/DecisionImpactTable';
import { SdgCards } from '../components/esg/SdgCards';
import { generateEsgReportPdf } from '../components/esg/esgReportPdf';

const sectionMotion = (delay: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: 'easeOut' as const, delay },
});

/** ESG & Carbon Intelligence — fleet carbon, EU ETS / FuelEU / IMO, SDG, export. */
export function EsgPage() {
  const [esg, setEsg] = useState<EsgSummary | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([getEsgSummary(), getDecisions(), getVoyages()]).then(([e, d, v]) => {
      if (!alive) return;
      setEsg(e);
      setDecisions(d);
      setVoyages(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  const handleExport = () => {
    if (!esg || exporting) return;
    setExporting(true);
    // Let the button repaint before jsPDF blocks the main thread briefly.
    setTimeout(() => {
      try {
        generateEsgReportPdf(esg, decisions);
      } finally {
        setExporting(false);
      }
    }, 60);
  };

  if (!esg) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#5A8AB4' }}>
        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
        <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
        <span style={{ fontSize: 12.5 }}>Loading carbon intelligence…</span>
      </div>
    );
  }

  const asOf = new Date(esg.asOf);

  return (
    <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      {/* Header */}
      <motion.div
        {...sectionMotion(0)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
      >
        <div
          style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(45,212,191,0.10)', border: '1px solid rgba(45,212,191,0.28)',
          }}
        >
          <Leaf size={19} style={{ color: '#2DD4BF' }} />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={LABEL}>Carbon &amp; Compliance</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#EAF4FF', lineHeight: 1.1, letterSpacing: '-0.02em', margin: 0 }}>
            ESG &amp; Carbon Intelligence
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 11, color: '#5A8AB4' }}>
            As of{' '}
            {asOf.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}{' '}
            · MRV-aligned
          </span>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', borderRadius: 10, border: 'none',
              background: exporting ? 'rgba(45,212,191,0.55)' : '#2DD4BF',
              color: '#07111D', fontSize: 12.5, fontWeight: 700,
              cursor: exporting ? 'wait' : 'pointer',
              boxShadow: '0 2px 10px rgba(45,212,191,0.25)',
              transition: 'all 200ms ease',
            }}
          >
            {exporting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <FileDown size={14} strokeWidth={2.2} />}
            {exporting ? 'Preparing PDF…' : 'Export ESG report'}
          </button>
        </div>
      </motion.div>

      {/* KPI band */}
      <motion.div {...sectionMotion(0.05)}>
        <EsgKpiRow esg={esg} />
      </motion.div>

      {/* Trend + fuel mix */}
      <motion.div
        {...sectionMotion(0.1)}
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: 14 }}
      >
        <EmissionsTrendChart esg={esg} />
        <FuelMixDonut />
      </motion.div>

      {/* Per-voyage bars + decision impact table */}
      <motion.div
        {...sectionMotion(0.15)}
        style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 5fr) minmax(0, 7fr)', gap: 14, alignItems: 'start' }}
      >
        <VoyageEmissionsChart voyages={voyages} />
        <DecisionImpactTable decisions={decisions} />
      </motion.div>

      {/* SDG alignment */}
      <motion.div {...sectionMotion(0.2)}>
        <SdgCards esg={esg} />
      </motion.div>

      <p style={{ fontSize: 11, color: '#3D5A75', margin: 0 }}>
        EU ETS maritime phase-in 40% (2025) → 70% (2026) → 100% (2027), CH₄ &amp; N₂O in scope from 2026 ·
        FuelEU Maritime Reg. (EU) 2023/1805 · IMO Net-Zero Framework · figures from deterministic carbon
        calculators over verified consumption records.
      </p>
    </div>
  );
}
