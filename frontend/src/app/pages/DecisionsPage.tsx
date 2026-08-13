/**
 * /decisions — the decision queue.
 * Every explainable, evidence-gated recommendation the pipeline has raised:
 * filterable by status and reliability gate, each row deep-links to the
 * full explanation + approval flow.
 */

import { useEffect, useMemo, useState } from 'react';
import { Scale, Search, Inbox } from 'lucide-react';
import { getDecisions, getVoyages } from '../../lib/api';
import type { Decision, ReliabilityStatus, Voyage } from '../../data/types';
import { DecisionQueueRow } from '../components/decisions/DecisionQueueRow';
import { C, RELIABILITY_META, STATUS_META } from '../components/decisions/shared';

type StatusFilter = 'all' | Decision['status'];
type GateFilter = 'all' | ReliabilityStatus;

function FilterPill({
  active,
  label,
  count,
  color,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 13px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.04em',
        cursor: 'pointer',
        transition: 'all 180ms ease',
        background: active ? 'rgba(45,212,191,0.10)' : 'rgba(255,255,255,0.03)',
        border: active ? '1px solid rgba(45,212,191,0.35)' : '1px solid rgba(255,255,255,0.08)',
        color: active ? C.teal : C.muted,
        whiteSpace: 'nowrap',
      }}
    >
      {color && (
        <span style={{ width: 7, height: 7, borderRadius: 999, background: color, opacity: active ? 1 : 0.55 }} />
      )}
      {label}
      {count !== undefined && (
        <span
          style={{
            fontFamily: C.mono,
            fontSize: 10,
            color: active ? C.teal : C.faint,
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 999,
            padding: '1px 6px',
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function StatTile({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div
      style={{
        background: C.cardBg,
        border: C.cardBorder,
        borderRadius: 12,
        padding: '15px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color, fontFamily: C.mono, letterSpacing: '-0.02em', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: C.muted }}>{sub}</div>
    </div>
  );
}

const STATUS_ORDER: Record<Decision['status'], number> = {
  pending: 0,
  approved: 1,
  overridden: 2,
  expired: 3,
};

export function DecisionsPage() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [gateFilter, setGateFilter] = useState<GateFilter>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([getDecisions(), getVoyages()]).then(([d, v]) => {
      if (cancelled) return;
      setDecisions(d);
      setVoyages(v);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const voyageById = useMemo(() => {
    const m = new Map<string, Voyage>();
    voyages.forEach((v) => m.set(v.id, v));
    return m;
  }, [voyages]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return decisions
      .filter((d) => (statusFilter === 'all' ? true : d.status === statusFilter))
      .filter((d) => (gateFilter === 'all' ? true : d.reliability === gateFilter))
      .filter((d) => {
        if (!q) return true;
        const voyage = voyageById.get(d.voyageId);
        const hay = `${d.id} ${d.title} ${d.voyageId} ${voyage?.vessel.name ?? ''}`.toLowerCase();
        return hay.includes(q);
      })
      .sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [decisions, statusFilter, gateFilter, query, voyageById]);

  const counts = useMemo(() => {
    const pending = decisions.filter((d) => d.status === 'pending').length;
    const ready = decisions.filter((d) => d.reliability === 'READY' && d.status === 'pending').length;
    const actioned = decisions.filter((d) => d.status === 'approved' || d.status === 'overridden').length;
    const escalated = decisions.filter((d) => d.reliability === 'ESCALATE').length;
    return { pending, ready, actioned, escalated };
  }, [decisions]);

  const statusCount = (s: StatusFilter) =>
    s === 'all' ? decisions.length : decisions.filter((d) => d.status === s).length;

  return (
    <div style={{ padding: '32px 36px 48px', display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1240, width: '100%', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
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
            }}
          >
            <Scale size={19} style={{ color: C.teal }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.16em', fontWeight: 700 }}>
              Decision Intelligence
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: C.text, lineHeight: 1.1, letterSpacing: '-0.02em', margin: 0 }}>
              Decisions
            </h1>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: 280, maxWidth: '100%' }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.faint }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search id, voyage, vessel…"
            style={{
              width: '100%',
              padding: '9px 12px 9px 34px',
              borderRadius: 10,
              background: 'rgba(5,11,20,0.8)',
              border: '1px solid rgba(255,255,255,0.09)',
              color: C.text,
              fontSize: 12.5,
              outline: 'none',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(45,212,191,0.4)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}
          />
        </div>
      </div>

      <p style={{ fontSize: 13, color: C.muted, maxWidth: 680, margin: 0, lineHeight: 1.55 }}>
        Explainable, evidence-gated recommendations from the multi-agent pipeline. Every decision
        carries its quantified impact, rejected alternatives, evidence trail and reliability
        verdict — nothing executes without a human signature.
      </p>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <StatTile label="Awaiting approval" value={`${counts.pending}`} sub="pending human sign-off" color={C.amber} />
        <StatTile label="Gate: READY" value={`${counts.ready}`} sub="evidence complete, one click to act" color={C.green} />
        <StatTile label="Actioned" value={`${counts.actioned}`} sub="approved or overridden, audit-signed" color={C.teal} />
        <StatTile label="Escalations" value={`${counts.escalated}`} sub="conflicting evidence routed to humans" color={C.red} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.12em', marginRight: 3 }}>
            Status
          </span>
          <FilterPill active={statusFilter === 'all'} label="All" count={statusCount('all')} onClick={() => setStatusFilter('all')} />
          {(Object.keys(STATUS_META) as Decision['status'][]).map((s) => (
            <FilterPill
              key={s}
              active={statusFilter === s}
              label={STATUS_META[s].label}
              color={STATUS_META[s].color}
              count={statusCount(s)}
              onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.12em', marginRight: 3 }}>
            Gate
          </span>
          <FilterPill active={gateFilter === 'all'} label="All" onClick={() => setGateFilter('all')} />
          {(Object.keys(RELIABILITY_META) as ReliabilityStatus[]).map((r) => (
            <FilterPill
              key={r}
              active={gateFilter === r}
              label={r === 'INSUFFICIENT_EVIDENCE' ? 'Insufficient' : RELIABILITY_META[r].label}
              color={RELIABILITY_META[r].color}
              count={decisions.filter((d) => d.reliability === r).length}
              onClick={() => setGateFilter(gateFilter === r ? 'all' : r)}
            />
          ))}
        </div>
      </div>

      {/* Queue */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="ai-processing"
              style={{ height: 118, borderRadius: 12, background: C.cardBg, border: C.cardBorder }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            background: C.cardBg,
            border: '1px dashed rgba(255,255,255,0.12)',
            borderRadius: 14,
            padding: '52px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            textAlign: 'center',
          }}
        >
          <Inbox size={26} style={{ color: C.faint }} />
          <div style={{ fontSize: 13.5, fontWeight: 600, color: C.textSecondary }}>No decisions match these filters</div>
          <p style={{ fontSize: 12, color: C.faint, margin: 0 }}>Clear the status or gate filters to see the full queue.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((d) => (
            <DecisionQueueRow key={d.id} decision={d} voyage={voyageById.get(d.voyageId)} />
          ))}
        </div>
      )}
    </div>
  );
}
