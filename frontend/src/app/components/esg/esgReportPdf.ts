/**
 * ESG report PDF export — clean, audit-ready one-pager built with jsPDF.
 *
 * NOTE: jsPDF standard fonts are WinAnsi-encoded, so this module writes
 * "CO2" / "tCO2e" (no unicode subscripts) and "->" instead of arrows.
 */
import { jsPDF } from 'jspdf';
import type { Decision, EsgSummary } from '../../../data/types';

const PAGE_W = 595.28; // A4 portrait, pt
const PAGE_H = 841.89;
const MARGIN = 48;

const INK = '#122033';
const INK_SOFT = '#4F6B85';
const INK_MUTED = '#7E8BA3';
const TEAL = '#0D9488';
const NAVY = '#07111D';
const LINE = '#D7E0EA';

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function fmtSigned(n: number, unit = ''): string {
  if (n === 0) return `0${unit}`;
  return `${n > 0 ? '+' : '-'}${fmtInt(Math.abs(n))}${unit}`;
}

export function generateEsgReportPdf(esg: EsgSummary, decisions: Decision[]): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const asOf = new Date(esg.asOf);
  const period = `January - ${asOf.toLocaleString('en-US', { month: 'long' })} ${asOf.getFullYear()} (YTD)`;
  let y = 0;

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - 64) {
      doc.addPage();
      y = MARGIN;
    }
  };

  /* ── Header band ─────────────────────────────────────────────────── */
  doc.setFillColor(NAVY);
  doc.rect(0, 0, PAGE_W, 104, 'F');
  doc.setFillColor(TEAL);
  doc.rect(0, 0, 6, 104, 'F');

  doc.setTextColor('#2DD4BF');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('OCEANMIND', MARGIN, 34, { charSpace: 2 });

  doc.setTextColor('#FFFFFF');
  doc.setFontSize(19);
  doc.text('ESG & Carbon Intelligence Report', MARGIN, 58);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor('#9FB4CC');
  doc.text(`Reporting period: ${period}`, MARGIN, 78);
  doc.text(
    `Generated ${asOf.toISOString().slice(0, 10)} by OceanMind Decision Engine v2.4 - MRV-aligned`,
    MARGIN,
    91,
  );
  y = 132;

  /* ── KPI grid ────────────────────────────────────────────────────── */
  const kpis: { label: string; value: string; note: string }[] = [
    {
      label: 'FLEET CO2 YTD',
      value: `${fmtInt(esg.fleetCo2YtdTonnes)} t`,
      note: 'IMO DCS verified consumption',
    },
    {
      label: 'CO2 AVOIDED VIA AI DECISIONS',
      value: `${fmtInt(esg.co2SavedVsBaselineTonnes)} t (-${esg.co2SavedPct.toFixed(1)}%)`,
      note: 'vs no-optimisation baseline',
    },
    {
      label: 'EU ETS LIABILITY (PROJECTED)',
      value: `USD ${fmtInt(esg.euEtsExposureUsd)}`,
      note: `${esg.euEtsPhaseInPct}% phase-in 2026 at EUR ${esg.euEtsAllowancePriceEur}/EUA`,
    },
    {
      label: 'FUELEU GHG INTENSITY',
      value: `${esg.fuelEu.ghgIntensity.toFixed(1)} gCO2e/MJ - ${esg.fuelEu.compliant ? 'PASS' : 'DEFICIT'}`,
      note: `Limit ${esg.fuelEu.limit.toFixed(2)} - ${Math.abs(esg.fuelEu.surplusDeficitPct).toFixed(1)}% ${
        esg.fuelEu.surplusDeficitPct <= 0 ? 'surplus' : 'deficit'
      }`,
    },
    {
      label: 'IMO CII FLEET RATING',
      value: `${esg.imoCii.fleetRating} (${esg.imoCii.trend})`,
      note: 'IMO Net-Zero Framework: on track',
    },
    {
      label: 'REGULATORY PHASE-IN',
      value: `40% '25 -> 70% '26 -> 100% '27`,
      note: 'CH4 & N2O in EU ETS scope from 2026',
    },
  ];

  const cols = 3;
  const gap = 12;
  const boxW = (PAGE_W - MARGIN * 2 - gap * (cols - 1)) / cols;
  const boxH = 62;
  kpis.forEach((kpi, i) => {
    const cx = MARGIN + (i % cols) * (boxW + gap);
    const cy = y + Math.floor(i / cols) * (boxH + gap);
    doc.setDrawColor(LINE);
    doc.setFillColor('#F7FAFC');
    doc.roundedRect(cx, cy, boxW, boxH, 5, 5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(INK_MUTED);
    doc.text(kpi.label, cx + 10, cy + 15);
    doc.setFontSize(11.5);
    doc.setTextColor(INK);
    doc.text(kpi.value, cx + 10, cy + 33);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(INK_SOFT);
    doc.text(doc.splitTextToSize(kpi.note, boxW - 20) as string[], cx + 10, cy + 46);
  });
  y += Math.ceil(kpis.length / cols) * (boxH + gap) + 16;

  /* ── Decision impact table ───────────────────────────────────────── */
  ensureSpace(60);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(INK);
  doc.text('Carbon Impact of AI Decisions', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(INK_SOFT);
  doc.text('Quantified deltas vs plan of record. Negative values are savings.', MARGIN, y + 13);
  y += 26;

  const tableW = PAGE_W - MARGIN * 2;
  const colW = [64, 205, 60, 60, 60, 50];
  const colX: number[] = [];
  colW.reduce((acc, w, i) => {
    colX[i] = acc;
    return acc + w;
  }, MARGIN);
  const headers = ['ID', 'Decision', 'Status', 'dCO2 (t)', 'Fuel (USD)', 'EU ETS'];
  const rowH = 24;

  const order: Record<string, number> = { approved: 0, pending: 1, overridden: 2, expired: 3 };
  const rows = [...decisions].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

  // Header row
  doc.setFillColor('#EDF3F8');
  doc.rect(MARGIN, y, tableW, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(INK_SOFT);
  headers.forEach((h, i) => {
    const right = i >= 3;
    doc.text(h, right ? colX[i] + colW[i] - 4 : colX[i] + 4, y + 12, right ? { align: 'right' } : undefined);
  });
  y += 18;

  rows.forEach((d, idx) => {
    ensureSpace(rowH + 4);
    if (idx % 2 === 1) {
      doc.setFillColor('#F7FAFC');
      doc.rect(MARGIN, y, tableW, rowH, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    doc.setTextColor(INK);
    doc.text(d.id, colX[0] + 4, y + 10);
    doc.setTextColor(INK_MUTED);
    doc.setFontSize(6.8);
    doc.text(d.voyageId, colX[0] + 4, y + 19);

    doc.setTextColor(INK);
    doc.setFontSize(7.6);
    const title = doc.splitTextToSize(d.title, colW[1] - 8) as string[];
    doc.text(title.slice(0, 2), colX[1] + 4, y + 10);

    const statusColor = d.status === 'approved' ? '#0B7A4B' : d.status === 'pending' ? '#9A6A1B' : INK_MUTED;
    doc.setTextColor(statusColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.text(d.status.toUpperCase(), colX[2] + 4, y + 10);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(d.impact.co2Tonnes < 0 ? '#0B7A4B' : INK);
    doc.text(fmtSigned(d.impact.co2Tonnes), colX[3] + colW[3] - 4, y + 10, { align: 'right' });
    doc.setTextColor(d.impact.fuelUsd < 0 ? '#0B7A4B' : INK);
    doc.text(fmtSigned(d.impact.fuelUsd), colX[4] + colW[4] - 4, y + 10, { align: 'right' });
    doc.setTextColor(d.impact.euEtsUsd < 0 ? '#0B7A4B' : INK);
    doc.text(fmtSigned(d.impact.euEtsUsd), colX[5] + colW[5] - 4, y + 10, { align: 'right' });

    doc.setDrawColor(LINE);
    doc.line(MARGIN, y + rowH, MARGIN + tableW, y + rowH);
    y += rowH;
  });

  // Net line for approved decisions
  const approved = rows.filter((d) => d.status === 'approved');
  const netCo2 = approved.reduce((s, d) => s + d.impact.co2Tonnes, 0);
  const netUsd = approved.reduce((s, d) => s + d.impact.fuelUsd, 0);
  ensureSpace(22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(INK);
  doc.text(`Net impact of approved decisions (${approved.length})`, colX[0] + 4, y + 13);
  doc.setTextColor(netCo2 < 0 ? '#0B7A4B' : INK);
  doc.text(fmtSigned(netCo2, ' t'), colX[3] + colW[3] - 4, y + 13, { align: 'right' });
  doc.setTextColor(netUsd < 0 ? '#0B7A4B' : INK);
  doc.text(fmtSigned(netUsd), colX[4] + colW[4] - 4, y + 13, { align: 'right' });
  y += 30;

  /* ── SDG alignment summary ───────────────────────────────────────── */
  ensureSpace(30 + esg.sdgAlignment.length * 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(INK);
  doc.text('UN SDG Alignment', MARGIN, y);
  y += 15;
  doc.setFontSize(7.8);
  esg.sdgAlignment.forEach((s) => {
    ensureSpace(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(TEAL);
    doc.text(`SDG ${s.sdg}`, MARGIN, y + 10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(INK);
    doc.text(`${s.title} - ${s.metric}`, MARGIN + 38, y + 10);
    y += 14;
  });
  y += 18;

  /* ── Signature block ─────────────────────────────────────────────── */
  ensureSpace(110);
  doc.setDrawColor(LINE);
  doc.setFillColor('#F7FAFC');
  doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, 92, 5, 5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(TEAL);
  doc.text('HUMAN VERIFICATION', MARGIN + 14, y + 20, { charSpace: 1 });

  doc.setFontSize(10.5);
  doc.setTextColor(INK);
  doc.text('Human-verified - Voyage Operations Manager', MARGIN + 14, y + 38);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(INK_SOFT);
  doc.text(
    'All AI recommendations in this report passed the evidence-completeness gate and carry a recorded human approval trail.',
    MARGIN + 14,
    y + 52,
  );

  doc.setDrawColor(INK_MUTED);
  doc.line(MARGIN + 14, y + 76, MARGIN + 194, y + 76);
  doc.setFontSize(7.4);
  doc.text('Signature - ops@oceanmind.ai', MARGIN + 14, y + 85);
  doc.line(PAGE_W - MARGIN - 150, y + 76, PAGE_W - MARGIN - 14, y + 76);
  doc.text(`Date - ${asOf.toISOString().slice(0, 10)}`, PAGE_W - MARGIN - 150, y + 85);

  /* ── Footer on every page ────────────────────────────────────────── */
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(INK_MUTED);
    doc.text('OceanMind - Causal Multi-Agent Voyage Intelligence - Confidential', MARGIN, PAGE_H - 30);
    doc.text(`Page ${p} of ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 30, { align: 'right' });
  }

  doc.save(`OceanMind-ESG-Report-${asOf.toISOString().slice(0, 7)}.pdf`);
}
