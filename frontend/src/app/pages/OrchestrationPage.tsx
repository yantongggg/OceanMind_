import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Workflow, Play, RotateCcw, Timer, Square } from 'lucide-react';
import type { AgentEvent, AgentId, Decision, PipelineRun } from '../../data/types';
import { streamPipeline, getDecision, type StreamHandle } from '../../lib/api';
import { AgentConversationStream } from '../components/intelligence/AgentConversationStream';
import { StageTracker } from '../components/orchestration/StageTracker';
import { AgentGraph, type AgentNodeState, type AgentPulse } from '../components/orchestration/AgentGraph';
import { CausalDag } from '../components/orchestration/CausalDag';
import { ReliabilityGateCard } from '../components/orchestration/ReliabilityGateCard';

/**
 * Agent Orchestration — the MiroFish-inspired living multi-agent world.
 *
 * One event stream (api.streamPipeline — SSE with scripted fallback) drives
 * everything on this page: the stage tracker, the agent node-graph, the
 * conversation feed and the reliability gate.
 */

const ALL_AGENTS: AgentId[] = ['disruption', 'causal', 'simulation', 'decision', 'tools', 'human'];

const BUILT_WITH = ['LangGraph', 'NetworkX', 'DoWhy', 'OR-Tools', 'Pydantic', 'FastAPI'];

export function OrchestrationPage() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [run, setRun] = useState<PipelineRun | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finished, setFinished] = useState(false);

  const handleRef = useRef<StreamHandle | null>(null);
  const timerRef = useRef<number | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    handleRef.current?.stop();
    handleRef.current = null;
    stopTimer();
    setStreaming(false);
  }, [stopTimer]);

  const startPipeline = useCallback(() => {
    // restart-safe: tear down any live stream first
    handleRef.current?.stop();
    stopTimer();

    setEvents([]);
    setDecision(null);
    setElapsedMs(0);
    setHasRun(true);
    setStreaming(true);
    setFinished(false);

    const startedAt = Date.now();
    timerRef.current = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 100);

    handleRef.current = streamPipeline(
      (event) => setEvents((prev) => [...prev, event]),
      {
        paceMs: 650,
        onRun: setRun,
        onDone: () => {
          setStreaming(false);
          setFinished(true);
          stopTimer();
        },
      },
    );
  }, [stopTimer]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      handleRef.current?.stop();
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, []);

  // When the Decision Agent's gate event lands, pull the produced decision.
  const gateSeen = events.some((e) => e.kind === 'gate' && e.agent === 'decision');
  useEffect(() => {
    if (!gateSeen || decision) return;
    let cancelled = false;
    getDecision(run?.decisionId ?? 'DEC-0042').then((d) => {
      if (!cancelled && d) setDecision(d);
    });
    return () => {
      cancelled = true;
    };
  }, [gateSeen, decision, run]);

  const lastEvent = events.length > 0 ? events[events.length - 1] : null;
  const complete = finished && events.length > 0;

  /* ── Derive agent node states from the stream ─────────────────────── */
  const agentStates = useMemo(() => {
    const states = {} as Record<AgentId, AgentNodeState>;
    ALL_AGENTS.forEach((a) => (states[a] = { status: 'idle', activity: null }));
    events.forEach((e) => {
      states[e.agent] = { status: 'done', activity: e.title };
    });
    if (lastEvent && streaming) {
      states[lastEvent.agent].status = 'thinking';
      // a tool_call means the deterministic tools are crunching too
      if (lastEvent.kind === 'tool_call') states.tools.status = 'thinking';
    }
    return states;
  }, [events, lastEvent, streaming]);

  /* ── Derive message pulses (edge animations) ──────────────────────── */
  const pulses = useMemo<AgentPulse[]>(() => {
    if (!streaming || !lastEvent) return [];
    if (lastEvent.kind === 'tool_call') {
      return [{ from: lastEvent.agent, to: 'tools' }];
    }
    if (lastEvent.agent === 'tools') {
      for (let i = events.length - 2; i >= 0; i--) {
        if (events[i].agent !== 'tools') return [{ from: 'tools', to: events[i].agent }];
      }
      return [];
    }
    for (let i = events.length - 2; i >= 0; i--) {
      if (events[i].agent !== lastEvent.agent) {
        return [{ from: events[i].agent, to: lastEvent.agent }];
      }
    }
    return [];
  }, [events, lastEvent, streaming]);

  const elapsedLabel = `${(elapsedMs / 1000).toFixed(1)}s`;

  return (
    <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
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
          <Workflow size={19} style={{ color: '#2DD4BF' }} />
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
            Multi-Agent Pipeline
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
            Agent Orchestration
          </h1>
        </div>

        {/* Run controls */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {run && hasRun && (
            <span
              style={{
                padding: '5px 10px',
                borderRadius: 7,
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
                color: '#7FA5D3',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {run.id} · {run.voyageId}
            </span>
          )}
          {hasRun && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                borderRadius: 7,
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
                color: streaming ? '#2DD4BF' : '#8BA8C8',
                background: streaming ? 'rgba(45,212,191,0.08)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${streaming ? 'rgba(45,212,191,0.3)' : 'rgba(255,255,255,0.08)'}`,
                minWidth: 78,
                justifyContent: 'center',
              }}
            >
              <Timer size={11} style={{ animation: streaming ? 'livePulse 1.4s ease-in-out infinite' : undefined }} />
              {elapsedLabel}
            </span>
          )}
          {streaming && (
            <button
              onClick={stopStream}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 14px',
                borderRadius: 9,
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                color: '#C75A5A',
                background: 'rgba(199,90,90,0.08)',
                border: '1px solid rgba(199,90,90,0.35)',
              }}
            >
              <Square size={12} />
              Stop
            </button>
          )}
          <motion.button
            onClick={startPipeline}
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.02 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 18px',
              borderRadius: 9,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              color: '#07111D',
              background: 'linear-gradient(135deg, #2DD4BF 0%, #38BDF8 100%)',
              border: '1px solid rgba(45,212,191,0.6)',
              boxShadow: '0 0 18px rgba(45,212,191,0.25)',
            }}
          >
            {streaming ? <RotateCcw size={13} /> : hasRun ? <RotateCcw size={13} /> : <Play size={13} />}
            {streaming ? 'Restart' : hasRun ? 'Replay pipeline' : 'Run pipeline'}
          </motion.button>
        </div>
      </div>

      <p style={{ fontSize: 13, color: '#8BA8C8', maxWidth: 720, margin: 0 }}>
        Detect → Explain → Simulate → Recommend → Approve. One event stream drives the whole page: the
        stage tracker, the agent world, the conversation and the reliability gate all replay the golden
        Red Sea scenario for voyage VYG-2026-0007.
      </p>

      {/* ── Stage tracker ─────────────────────────────────────────────── */}
      <StageTracker currentStage={lastEvent?.stage ?? null} complete={complete} />

      {/* ── Agent world + conversation ────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 400px)',
          gap: 18,
          alignItems: 'stretch',
        }}
      >
        <AgentGraph states={agentStates} pulses={pulses} streaming={streaming} />
        <AgentConversationStream events={events} streaming={streaming} height={430} />
      </div>

      {/* ── Causal DAG + reliability gate ─────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 400px)',
          gap: 18,
          alignItems: 'stretch',
        }}
      >
        <CausalDag />
        <ReliabilityGateCard decision={decision} streaming={streaming} />
      </div>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          borderTop: '1px solid rgba(255,255,255,0.07)',
          paddingTop: 16,
          paddingBottom: 4,
        }}
      >
        <div style={{ fontSize: 12, color: '#8BA8C8', fontStyle: 'italic' }}>
          Agents detect. The engine explains. Deterministic tools calculate.{' '}
          <span style={{ color: '#2DD4BF', fontWeight: 600 }}>Humans decide.</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 9,
              color: '#5A8AB4',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              fontWeight: 700,
              marginRight: 4,
            }}
          >
            Built with
          </span>
          {BUILT_WITH.map((tech) => (
            <span
              key={tech}
              style={{
                padding: '3px 10px',
                borderRadius: 999,
                fontSize: 9.5,
                fontFamily: "'JetBrains Mono', monospace",
                color: '#7FA5D3',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
              }}
            >
              {tech}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
