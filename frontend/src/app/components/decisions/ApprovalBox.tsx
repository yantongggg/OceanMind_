/**
 * Human approval box — the final "Approve" stage of the pipeline.
 * Approve / Override-with-reason write an ApprovalRecord via the api layer;
 * once actioned, a signed audit line (approver · role · timestamp · decision
 * hash) is rendered with a link to generate the evidence report.
 */

import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import {
  ArrowUpRight,
  CheckCircle2,
  FileCheck2,
  Fingerprint,
  Loader2,
  PenLine,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { approveDecision, overrideDecision } from '../../../lib/api';
import type { Decision } from '../../../data/types';
import { auditHash, C, fmtUtc, SectionLabel } from './shared';

const APPROVER_ROLE = 'Voyage Operations Manager';

function SignedAuditLine({ decision }: { decision: Decision }) {
  const approval = decision.approval;
  if (!approval) return null;
  const isApproved = approval.action === 'approved';
  const color = isApproved ? C.green : C.sky;
  const hash = auditHash(`${decision.id}|${approval.action}|${approval.at}|${approval.approverEmail}`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
          padding: '16px 18px',
          borderRadius: 12,
          background: `color-mix(in srgb, ${color} 6%, transparent)`,
          border: `1px solid color-mix(in srgb, ${color} 28%, transparent)`,
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            background: `color-mix(in srgb, ${color} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
          }}
        >
          {isApproved ? (
            <CheckCircle2 size={16} strokeWidth={2} style={{ color }} />
          ) : (
            <PenLine size={16} strokeWidth={2} style={{ color }} />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color }}>
            {isApproved ? 'Decision approved' : 'Decision overridden'}
            <span style={{ color: C.muted, fontWeight: 500 }}> — recorded in the audit trail</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11.5 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: C.textSecondary, fontWeight: 600 }}>
              <UserCheck size={12} strokeWidth={2} style={{ color: C.faint }} />
              {approval.approvedBy}
            </span>
            <span style={{ color: 'rgba(90,138,180,0.5)' }}>·</span>
            <span style={{ color: C.muted }}>{APPROVER_ROLE}</span>
            <span style={{ color: 'rgba(90,138,180,0.5)' }}>·</span>
            <span style={{ color: C.muted, fontFamily: C.mono }}>{approval.approverEmail}</span>
            <span style={{ color: 'rgba(90,138,180,0.5)' }}>·</span>
            <span style={{ color: C.muted, fontFamily: C.mono }}>{fmtUtc(approval.at)}</span>
          </div>

          {approval.comment && (
            <div
              style={{
                fontSize: 11.5,
                color: C.muted,
                lineHeight: 1.5,
                fontStyle: 'italic',
                borderLeft: `2px solid color-mix(in srgb, ${color} 35%, transparent)`,
                paddingLeft: 10,
              }}
            >
              “{approval.comment}”
            </div>
          )}

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              alignSelf: 'flex-start',
              marginTop: 2,
              padding: '4px 10px',
              borderRadius: 7,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              fontSize: 10,
              fontFamily: C.mono,
              color: C.faint,
            }}
            title="Deterministic signature over decision id, action, timestamp and approver"
          >
            <Fingerprint size={11} strokeWidth={2} style={{ color }} />
            signed {decision.id} · {hash}
          </div>
        </div>
      </div>

      <Link
        to="/reports"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          alignSelf: 'flex-start',
          padding: '10px 16px',
          borderRadius: 10,
          background: 'rgba(45,212,191,0.08)',
          border: '1px solid rgba(45,212,191,0.30)',
          color: C.teal,
          fontSize: 12.5,
          fontWeight: 700,
          textDecoration: 'none',
        }}
      >
        <FileCheck2 size={14} strokeWidth={2} />
        Generate evidence report
        <ArrowUpRight size={12} strokeWidth={2.2} />
      </Link>
    </div>
  );
}

export function ApprovalBox({
  decision,
  onUpdated,
}: {
  decision: Decision;
  onUpdated: (d: Decision) => void;
}) {
  const [busy, setBusy] = useState<'approve' | 'override' | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState('');

  const gateBlocksApproval =
    decision.reliability === 'ESCALATE' || decision.reliability === 'INSUFFICIENT_EVIDENCE';
  const actionable = decision.status === 'pending' && decision.approval === null;

  const handleApprove = async () => {
    setBusy('approve');
    try {
      const updated = await approveDecision(
        decision.id,
        'Approved — recommendation and evidence trail reviewed in the OceanMind console.',
      );
      if (updated) {
        onUpdated(updated);
        toast.success(`${decision.id} approved`, {
          description: `Signed by ${APPROVER_ROLE} · execution of ${updated.recommendation.actions.length} actions initiated.`,
        });
      } else {
        toast.error('Decision not found — could not record approval.');
      }
    } finally {
      setBusy(null);
    }
  };

  const handleOverride = async () => {
    if (reason.trim().length < 8) return;
    setBusy('override');
    try {
      const updated = await overrideDecision(decision.id, reason.trim());
      if (updated) {
        onUpdated(updated);
        setDialogOpen(false);
        toast(`${decision.id} overridden`, {
          description: 'Override reason preserved in the audit trail. Agents notified.',
        });
      } else {
        toast.error('Decision not found — could not record override.');
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SectionLabel>Human approval — final pipeline stage</SectionLabel>

      <div
        style={{
          background: C.cardBg,
          border: actionable ? '1px solid rgba(45,212,191,0.28)' : C.cardBorder,
          borderRadius: 14,
          padding: '20px 22px',
          boxShadow: actionable
            ? '0 0 24px rgba(45,212,191,0.06), 0 4px 16px rgba(0,0,0,0.35)'
            : '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        {decision.approval ? (
          <SignedAuditLine decision={decision} />
        ) : decision.status === 'expired' ? (
          <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>
            This decision expired without action — the evidence gate returned{' '}
            <span style={{ color: C.slate, fontWeight: 700 }}>INSUFFICIENT EVIDENCE</span> and no
            recommendation was executed. Retained for audit purposes.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <ShieldCheck size={16} strokeWidth={2} style={{ color: C.teal, flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, margin: 0 }}>
                You are signing as{' '}
                <span style={{ color: C.textSecondary, fontWeight: 700 }}>{APPROVER_ROLE}</span>{' '}
                (<span style={{ fontFamily: C.mono }}>ops@oceanmind.ai</span>). Approval executes the
                recommended action list and files the full evidence pack; an override must state a
                reason and is preserved verbatim in the audit trail.
              </p>
            </div>

            {gateBlocksApproval && (
              <div
                style={{
                  fontSize: 11.5,
                  color: C.amber,
                  lineHeight: 1.5,
                  padding: '9px 12px',
                  borderRadius: 9,
                  background: 'rgba(232,160,67,0.07)',
                  border: '1px solid rgba(232,160,67,0.25)',
                }}
              >
                One-click approval is locked: the reliability gate returned{' '}
                <strong>{decision.reliability.replace('_', ' ')}</strong>. Only an explicit
                override (with reason) can action this decision.
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={handleApprove}
                disabled={busy !== null || gateBlocksApproval}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '11px 20px',
                  borderRadius: 10,
                  border: 'none',
                  background: gateBlocksApproval
                    ? 'rgba(0,212,126,0.15)'
                    : 'linear-gradient(135deg, #00D47E 0%, #2DD4BF 100%)',
                  color: gateBlocksApproval ? 'rgba(234,244,255,0.4)' : '#07111D',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: busy !== null || gateBlocksApproval ? 'not-allowed' : 'pointer',
                  boxShadow: gateBlocksApproval ? 'none' : '0 4px 16px rgba(0,212,126,0.22)',
                  opacity: busy === 'override' ? 0.6 : 1,
                }}
              >
                {busy === 'approve' ? (
                  <Loader2 size={14} strokeWidth={2.4} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} strokeWidth={2.4} />
                )}
                {busy === 'approve' ? 'Signing…' : 'Approve recommendation'}
              </button>

              <button
                onClick={() => setDialogOpen(true)}
                disabled={busy !== null}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '11px 20px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  color: C.textSecondary,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: busy !== null ? 'not-allowed' : 'pointer',
                }}
              >
                <PenLine size={13} strokeWidth={2.2} />
                Override with reason
              </button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (busy === null) setDialogOpen(open); }}>
        <DialogContent
          style={{
            background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 16,
            boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: C.text, fontSize: 17, letterSpacing: '-0.01em' }}>
              Override {decision.id}
            </DialogTitle>
            <DialogDescription style={{ color: C.muted, fontSize: 12.5, lineHeight: 1.55 }}>
              State why you are rejecting the agent recommendation. Your reason is recorded
              verbatim in the compliance audit trail and fed back to the decision engine.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Charterer has confirmed a protected convoy slot — holding Suez routing under commercial instruction…"
            rows={4}
            style={{
              background: 'rgba(5,11,20,0.8)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 10,
              color: C.text,
              fontSize: 13,
              resize: 'vertical',
            }}
          />
          <div style={{ fontSize: 10.5, color: reason.trim().length >= 8 ? C.faint : C.amber }}>
            {reason.trim().length >= 8
              ? 'Reason will be signed and preserved.'
              : 'A substantive reason is required (min 8 characters).'}
          </div>

          <DialogFooter>
            <button
              onClick={() => setDialogOpen(false)}
              disabled={busy !== null}
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.12)',
                color: C.muted,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: busy !== null ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleOverride}
              disabled={busy !== null || reason.trim().length < 8}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 10,
                border: 'none',
                background:
                  reason.trim().length >= 8
                    ? 'linear-gradient(135deg, #38BDF8 0%, #2DD4BF 100%)'
                    : 'rgba(56,189,248,0.15)',
                color: reason.trim().length >= 8 ? '#07111D' : 'rgba(234,244,255,0.4)',
                fontSize: 12.5,
                fontWeight: 800,
                cursor: busy !== null || reason.trim().length < 8 ? 'not-allowed' : 'pointer',
              }}
            >
              {busy === 'override' ? (
                <Loader2 size={13} strokeWidth={2.4} className="animate-spin" />
              ) : (
                <PenLine size={13} strokeWidth={2.2} />
              )}
              {busy === 'override' ? 'Recording…' : 'Record override'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
