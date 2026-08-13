/**
 * OceanMind compliance-report PDF builder (jspdf).
 *
 * Generates an audit-ready A4 evidence pack for one ComplianceReport:
 * header band, verification-chain block, summary, linked-decision evidence
 * (impact numbers + evidence items + approval record) and a signature
 * footer. Everything is drawn from the shared data contract — no
 * screenshots, the PDF *is* the evidence artefact the demo talks about.
 */

import { jsPDF } from 'jspdf';
import type { ComplianceReport, Decision } from '../../../data/types';
import { REPORT_STATUS_META, REPORT_TYPE_META, formatDateTime, verificationChain } from './reportMeta';

/* Palette (print-friendly, mirrors the dark UI accents on white paper). */
const NAVY: [number, number, number] = [10, 24, 38];
const TEAL: [number, number, number] = [13, 148, 136];
const INK: [number, number, number] = [26, 38, 52];
const MUTED: [number, number, number] = [95, 112, 131];
const AMBER: [number, number, number] = [180, 116, 30];
const GREEN: [number, number, number] = [12, 148, 90];
const LINE: [number, number, number] = [214, 222, 230];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const BODY_W = PAGE_W - MARGIN * 2;

class Cursor {
  y: number;
  constructor(private doc: jsPDF, start: number) { this.y = start; }
  /** Ensure `need` mm fit on the page, else start a new page. */
  ensure(need: number) {
    if (this.y + need > PAGE_H - 22) {
      this.doc.addPage();
      this.y = MARGIN;
    }
  }
}

function setColor(doc: jsPDF, rgb: [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function sectionTitle(doc: jsPDF, cur: Cursor, title: string) {
  cur.ensure(14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setColor(doc, TEAL);
  doc.text(title.toUpperCase(), MARGIN, cur.y);
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, cur.y + 2, PAGE_W - MARGIN, cur.y + 2);
  cur.y += 8;
}

function paragraph(doc: jsPDF, cur: Cursor, text: string, size = 9.5, color: [number, number, number] = INK) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(size);
  setColor(doc, color);
  const lines = doc.splitTextToSize(text, BODY_W) as string[];
  const lineH = size * 0.45;
  for (const line of lines) {
    cur.ensure(lineH + 2);
    doc.text(line, MARGIN, cur.y);
    cur.y += lineH;
  }
  cur.y += 2;
}

function keyValueRow(doc: jsPDF, cur: Cursor, pairs: [string, string][]) {
  cur.ensure(12);
  const colW = BODY_W / pairs.length;
  pairs.forEach(([k, v], i) => {
    const x = MARGIN + i * colW;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    setColor(doc, MUTED);
    doc.text(k.toUpperCase(), x, cur.y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setColor(doc, INK);
    doc.text(v, x, cur.y + 5);
  });
  cur.y += 12;
}

function fmtDelta(n: number, unit: string, digits = 0): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString('en-US', { maximumFractionDigits: digits })}${unit}`;
}

export function buildReportPdf(report: ComplianceReport, allDecisions: Decision[]): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const typeMeta = REPORT_TYPE_META[report.type];
  const statusMeta = REPORT_STATUS_META[report.status];
  const linked = allDecisions.filter((d) => report.decisionIds.includes(d.id));

  /* ── Header band ─────────────────────────────────────────────────── */
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, 0, PAGE_W, 46, 'F');
  doc.setFillColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.rect(0, 46, PAGE_W, 1.6, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(45, 212, 191);
  doc.text('OCEANMIND', MARGIN, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(160, 185, 210);
  doc.text('Evidence & Compliance Center  ·  Causal Multi-Agent Voyage Intelligence', MARGIN, 20.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(240, 246, 252);
  const titleLines = doc.splitTextToSize(report.title, BODY_W) as string[];
  doc.text(titleLines.slice(0, 2), MARGIN, 30);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(160, 185, 210);
  doc.text(
    `${typeMeta.label}  ·  ${report.period}  ·  ${report.id}  ·  Generated ${formatDateTime(report.generatedAt)}`,
    MARGIN, 41.5,
  );

  const cur = new Cursor(doc, 56);

  /* ── Status + verification chain ─────────────────────────────────── */
  const statusColor = report.status === 'draft' ? AMBER : report.status === 'final' ? GREEN : TEAL;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setColor(doc, statusColor);
  doc.text(`STATUS: ${statusMeta.label.toUpperCase()}`, MARGIN, cur.y);
  cur.y += 7;

  sectionTitle(doc, cur, 'Verification chain');
  for (const step of verificationChain(report)) {
    cur.ensure(7);
    const mark = step.done ? '[x]' : '[ ]';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setColor(doc, step.done ? GREEN : AMBER);
    doc.text(`${mark}  ${step.label}`, MARGIN, cur.y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setColor(doc, MUTED);
    doc.text(`—  ${step.detail}`, MARGIN + 52, cur.y);
    cur.y += 5.5;
  }
  cur.y += 4;

  /* ── Report metadata ─────────────────────────────────────────────── */
  keyValueRow(doc, cur, [
    ['Prepared by', report.preparedBy],
    ['Linked decisions', report.decisionIds.length ? report.decisionIds.join(', ') : '—'],
    ['Linked voyages', report.voyageIds.length ? report.voyageIds.join(', ') : '—'],
  ]);
  cur.y += 2;

  /* ── Executive summary ───────────────────────────────────────────── */
  sectionTitle(doc, cur, 'Executive summary');
  paragraph(doc, cur, report.summary);
  cur.y += 3;

  /* ── Linked decision evidence packs ──────────────────────────────── */
  for (const d of linked) {
    sectionTitle(doc, cur, `Decision evidence — ${d.id}`);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    setColor(doc, INK);
    const dTitle = doc.splitTextToSize(d.title, BODY_W) as string[];
    for (const line of dTitle) {
      cur.ensure(6);
      doc.text(line, MARGIN, cur.y);
      cur.y += 5;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setColor(doc, MUTED);
    cur.ensure(6);
    doc.text(
      `Voyage ${d.voyageId}  ·  Disruption ${d.disruptionId}  ·  Reliability gate: ${d.reliability}  ·  Pipeline ${d.agentTrace.pipelineRunId}`,
      MARGIN, cur.y,
    );
    cur.y += 7;

    keyValueRow(doc, cur, [
      ['ETA impact', fmtDelta(d.impact.etaHours / 24, ' days', 1)],
      ['Fuel cost', fmtDelta(d.impact.fuelUsd / 1000, 'k USD')],
      ['CO2', fmtDelta(d.impact.co2Tonnes, ' t') + ` (${fmtDelta(d.impact.co2Pct, '%', 1)})`],
      ['EU ETS', fmtDelta(d.impact.euEtsUsd / 1000, 'k USD', 1)],
      ['Risk score', `${d.impact.riskScore}/100`],
    ]);

    paragraph(doc, cur, d.rationale, 8.5, INK);

    // Evidence items
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    setColor(doc, TEAL);
    cur.ensure(8);
    doc.text('EVIDENCE ITEMS', MARGIN, cur.y);
    cur.y += 5;
    d.evidence.forEach((e, i) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      setColor(doc, INK);
      const head = `${i + 1}. ${e.label}   [${e.kind} · ${e.sourceRef} · confidence ${(e.confidence * 100).toFixed(0)}%]`;
      const headLines = doc.splitTextToSize(head, BODY_W) as string[];
      for (const line of headLines) {
        cur.ensure(5.5);
        doc.text(line, MARGIN, cur.y);
        cur.y += 4.4;
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      setColor(doc, MUTED);
      const detailLines = doc.splitTextToSize(e.detail, BODY_W - 5) as string[];
      for (const line of detailLines) {
        cur.ensure(5);
        doc.text(line, MARGIN + 5, cur.y);
        cur.y += 4;
      }
      cur.y += 2;
    });

    // Approval record
    cur.ensure(18);
    if (d.approval) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      setColor(doc, GREEN);
      doc.text(
        `${d.approval.action === 'approved' ? 'APPROVED' : 'OVERRIDDEN'} by ${d.approval.approvedBy} (${d.approval.approverEmail}) — ${formatDateTime(d.approval.at)}`,
        MARGIN, cur.y,
      );
      cur.y += 5;
      paragraph(doc, cur, `"${d.approval.comment}"`, 8, MUTED);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      setColor(doc, AMBER);
      doc.text('PENDING HUMAN SIGN-OFF — this decision has not yet been approved.', MARGIN, cur.y);
      cur.y += 7;
    }
    cur.y += 2;
  }

  /* ── Signature block ─────────────────────────────────────────────── */
  cur.ensure(38);
  sectionTitle(doc, cur, 'Sign-off');
  const signed = report.status !== 'draft';
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(0.35);
  const sigY = cur.y + 14;
  doc.line(MARGIN, sigY, MARGIN + 70, sigY);
  doc.line(PAGE_W - MARGIN - 70, sigY, PAGE_W - MARGIN, sigY);
  doc.setFont('helvetica', signed ? 'bolditalic' : 'italic');
  doc.setFontSize(10);
  if (signed) {
    setColor(doc, INK);
    doc.text('Voyage Operations Manager', MARGIN + 2, sigY - 3);
  } else {
    setColor(doc, AMBER);
    doc.text('awaiting signature', MARGIN + 2, sigY - 3);
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  setColor(doc, MUTED);
  doc.text('Voyage Operations Manager · ops@oceanmind.ai', MARGIN, sigY + 4);
  doc.text('Date', PAGE_W - MARGIN - 70, sigY + 4);
  if (signed) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setColor(doc, INK);
    doc.text(formatDateTime(report.generatedAt), PAGE_W - MARGIN - 68, sigY - 3);
  }

  /* ── Footer on every page ────────────────────────────────────────── */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, PAGE_H - 14, PAGE_W - MARGIN, PAGE_H - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    setColor(doc, MUTED);
    doc.text(
      report.status === 'draft'
        ? 'AI-GENERATED DRAFT — not valid until human sign-off. OceanMind keeps a human in the loop on every decision.'
        : 'AI-generated, evidence-linked and human-verified. Every number in this report traces to a signal, tool call or regulation.',
      MARGIN, PAGE_H - 9,
    );
    doc.text(`${report.id}  ·  page ${p}/${pages}`, PAGE_W - MARGIN, PAGE_H - 9, { align: 'right' });
  }

  doc.save(`${report.id}.pdf`);
}
