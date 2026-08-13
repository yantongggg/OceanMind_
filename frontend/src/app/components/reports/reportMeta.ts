/**
 * Reports — shared display metadata for the Evidence & Compliance Center.
 *
 * Maps the contract's ComplianceReport.type / .status onto the
 * human-in-the-loop verification story:
 *   draft      → AI-generated, awaiting human sign-off
 *   final      → human-verified
 *   submitted  → certified & filed with the regulator
 */

import type { ComplianceReport } from '../../../data/types';

export interface ReportTypeMeta {
  label: string;
  /** Short category chip: ESG / Operational / Regulatory / Audit. */
  category: string;
  color: string;
}

export const REPORT_TYPE_META: Record<ComplianceReport['type'], ReportTypeMeta> = {
  DECISION_AUDIT: { label: 'Decision Audit', category: 'Audit', color: '#2DD4BF' },
  EU_ETS: { label: 'EU ETS', category: 'Regulatory', color: '#38BDF8' },
  FUELEU: { label: 'FuelEU Maritime', category: 'Regulatory', color: '#5EEAD4' },
  IMO_DCS: { label: 'IMO DCS', category: 'Regulatory', color: '#8BA8C8' },
  ESG_QUARTERLY: { label: 'ESG Quarterly', category: 'ESG', color: '#00D47E' },
};

export interface ReportStatusMeta {
  label: string;
  color: string;
  soft: string;
  border: string;
}

export const REPORT_STATUS_META: Record<ComplianceReport['status'], ReportStatusMeta> = {
  draft: {
    label: 'AI draft — awaiting sign-off',
    color: '#E8A043', soft: 'rgba(232,160,67,0.1)', border: 'rgba(232,160,67,0.35)',
  },
  final: {
    label: 'Human-verified',
    color: '#00D47E', soft: 'rgba(0,212,126,0.08)', border: 'rgba(0,212,126,0.3)',
  },
  submitted: {
    label: 'Certified · Submitted',
    color: '#38BDF8', soft: 'rgba(56,189,248,0.08)', border: 'rgba(56,189,248,0.3)',
  },
};

/** Verification chain step states for one report. */
export interface ChainStep {
  key: 'generated' | 'evidence' | 'signoff';
  label: string;
  detail: string;
  done: boolean;
}

export function verificationChain(report: ComplianceReport): ChainStep[] {
  const hasEvidence = report.decisionIds.length > 0 || report.voyageIds.length > 0;
  const signed = report.status !== 'draft';
  const links =
    [
      report.decisionIds.length > 0 ? `${report.decisionIds.length} decision${report.decisionIds.length > 1 ? 's' : ''}` : null,
      report.voyageIds.length > 0 ? `${report.voyageIds.length} voyage${report.voyageIds.length > 1 ? 's' : ''}` : null,
    ]
      .filter(Boolean)
      .join(' · ') || 'fleet-level records';
  return [
    {
      key: 'generated',
      label: 'AI generated',
      detail: report.preparedBy,
      done: true,
    },
    {
      key: 'evidence',
      label: 'Evidence attached',
      detail: hasEvidence ? `Linked to ${links}` : 'Fleet MRV records',
      done: true,
    },
    {
      key: 'signoff',
      label: 'Human sign-off',
      detail: signed ? 'Voyage Operations Manager' : 'Pending — finalises on approval',
      done: signed,
    },
  ];
}

export function formatSize(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
