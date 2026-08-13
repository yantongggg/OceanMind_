import { useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { ArrowUpRight, Download, FileText, Loader2 } from 'lucide-react';
import type { ComplianceReport, Decision } from '../../../data/types';
import { REPORT_STATUS_META, REPORT_TYPE_META, formatDateTime, formatSize, verificationChain } from './reportMeta';
import { VerificationChain } from './VerificationChain';
import { buildReportPdf } from './pdfBuilder';

/**
 * One report row in the Evidence & Compliance Center: type + status chips,
 * summary, linked decision/voyage ids, inline verification chain and a
 * real jspdf download.
 */
export interface ReportCardProps {
  report: ComplianceReport;
  decisions: Decision[];
  index: number;
}

export function ReportCard({ report, decisions, index }: ReportCardProps) {
  const [building, setBuilding] = useState(false);
  const typeMeta = REPORT_TYPE_META[report.type];
  const statusMeta = REPORT_STATUS_META[report.status];
  const steps = verificationChain(report);
  const isDraft = report.status === 'draft';

  const download = () => {
    if (building) return;
    setBuilding(true);
    // Let the spinner paint before jspdf blocks the main thread briefly.
    setTimeout(() => {
      try {
        buildReportPdf(report, decisions);
      } finally {
        setBuilding(false);
      }
    }, 60);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07, ease: [0.4, 0, 0.2, 1] }}
      style={{
        display: 'flex', gap: 18, alignItems: 'stretch', flexWrap: 'wrap',
        padding: '18px 20px',
        background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
        border: isDraft ? '1px solid rgba(232,160,67,0.35)' : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        boxShadow: isDraft
          ? '0 4px 16px rgba(0,0,0,0.35), 0 0 18px rgba(232,160,67,0.05)'
          : '0 4px 16px rgba(0,0,0,0.35)',
      }}
    >
      {/* Icon + type */}
      <div
        style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0, alignSelf: 'flex-start',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${typeMeta.color}12`, border: `1px solid ${typeMeta.color}33`,
        }}
      >
        <FileText size={18} style={{ color: typeMeta.color }} strokeWidth={1.75} />
      </div>

      {/* Main copy */}
      <div style={{ flex: '1 1 340px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: typeMeta.color, background: `${typeMeta.color}12`, border: `1px solid ${typeMeta.color}33`,
              padding: '2px 8px', borderRadius: 999,
            }}
          >
            {typeMeta.label}
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#5A8AB4', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {typeMeta.category} · {report.period}
          </span>
          <span
            style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: statusMeta.color, background: statusMeta.soft, border: `1px solid ${statusMeta.border}`,
              padding: '2px 8px', borderRadius: 999,
            }}
          >
            {statusMeta.label}
          </span>
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: '#EAF4FF', letterSpacing: '-0.01em', marginTop: 8, lineHeight: 1.3 }}>
          {report.title}
        </div>
        <p style={{ fontSize: 12, color: '#8BA8C8', lineHeight: 1.55, margin: '6px 0 0', maxWidth: 720 }}>
          {report.summary}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          {report.decisionIds.map((id) => (
            <Link
              key={id}
              to={`/decisions/${id}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 10.5, fontWeight: 600, color: '#2DD4BF', textDecoration: 'none',
                background: 'rgba(45,212,191,0.07)', border: '1px solid rgba(45,212,191,0.22)',
                padding: '2px 8px', borderRadius: 6,
              }}
            >
              {id} <ArrowUpRight size={10} strokeWidth={2} />
            </Link>
          ))}
          {report.voyageIds.map((id) => (
            <Link
              key={id}
              to={`/voyages/${id}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 10.5, fontWeight: 600, color: '#38BDF8', textDecoration: 'none',
                background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.22)',
                padding: '2px 8px', borderRadius: 6,
              }}
            >
              {id} <ArrowUpRight size={10} strokeWidth={2} />
            </Link>
          ))}
          <span style={{ fontSize: 10.5, color: '#5A8AB4' }}>
            {formatDateTime(report.generatedAt)} · {formatSize(report.sizeKb)} · {report.preparedBy}
          </span>
        </div>
      </div>

      {/* Chain + actions */}
      <div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between',
          gap: 12, flexShrink: 0, marginLeft: 'auto',
        }}
      >
        <VerificationChain steps={steps} compact />
        <div style={{ display: 'flex', gap: 8 }}>
          {isDraft && (
            <Link
              to={report.decisionIds[0] ? `/decisions/${report.decisionIds[0]}` : '/decisions'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 11.5, fontWeight: 600, color: '#E8A043', textDecoration: 'none',
                background: 'rgba(232,160,67,0.1)', border: '1px solid rgba(232,160,67,0.35)',
                padding: '7px 12px', borderRadius: 9,
              }}
            >
              Review & sign
            </Link>
          )}
          <button
            type="button"
            onClick={download}
            disabled={building}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, cursor: building ? 'wait' : 'pointer',
              fontSize: 11.5, fontWeight: 600, color: '#07111D',
              background: building ? '#1E9E90' : '#2DD4BF', border: '1px solid rgba(45,212,191,0.6)',
              padding: '7px 13px', borderRadius: 9,
              boxShadow: '0 2px 8px rgba(45,212,191,0.15)',
              transition: 'background 200ms ease',
            }}
          >
            {building
              ? <Loader2 size={13} strokeWidth={2.25} className="animate-spin" />
              : <Download size={13} strokeWidth={2.25} />}
            {building ? 'Building…' : 'Download PDF'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
