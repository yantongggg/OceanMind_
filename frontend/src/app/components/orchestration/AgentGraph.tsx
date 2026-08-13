import { motion, AnimatePresence } from 'motion/react';
import { Bot, Check, Wrench, UserCheck } from 'lucide-react';
import type { AgentId } from '../../../data/types';
import { AGENT_META } from '../intelligence/AgentConversationStream';

/**
 * AgentGraph — the MiroFish-style "living agent world".
 *
 * Six agent cards positioned on a canvas, connected by SVG edges. When the
 * pipeline streams, message pulses travel along the edge between the agent
 * that just spoke and the agent now speaking; the speaking agent card glows.
 * Pure presentational — the page derives node states + pulses from the same
 * event stream that drives the stage tracker and the conversation.
 */

export type AgentNodeStatus = 'idle' | 'thinking' | 'done';

export interface AgentNodeState {
  status: AgentNodeStatus;
  activity: string | null;          // latest event title from this agent
}

export interface AgentPulse {
  from: AgentId;
  to: AgentId;
}

/** Node centers as % of the canvas. */
const NODE_POS: Record<AgentId, { x: number; y: number }> = {
  disruption: { x: 11.5, y: 30 },
  causal:     { x: 34.0, y: 20 },
  simulation: { x: 56.5, y: 30 },
  decision:   { x: 78.5, y: 20 },
  tools:      { x: 45.5, y: 76 },
  human:      { x: 88.0, y: 68 },
};

/** Idle-state role line per agent. */
const AGENT_ROLE: Record<AgentId, string> = {
  disruption: 'Signal ingestion · clustering · corroboration',
  causal:     'Root-cause DAG · counterfactuals',
  simulation: 'Scenario enumeration · feasibility pruning',
  decision:   'Hard constraints · carbon-aware ranking · gate',
  tools:      'carbon · voyage_calc · reliability · OR-Tools',
  human:      'Voyage Operations Manager — final authority',
};

const EDGES: { id: string; a: AgentId; b: AgentId }[] = [
  { id: 'e-dis-cau', a: 'disruption', b: 'causal' },
  { id: 'e-cau-sim', a: 'causal',     b: 'simulation' },
  { id: 'e-sim-dec', a: 'simulation', b: 'decision' },
  { id: 'e-sim-too', a: 'simulation', b: 'tools' },
  { id: 'e-dec-too', a: 'decision',   b: 'tools' },
  { id: 'e-dec-hum', a: 'decision',   b: 'human' },
];

function findEdge(from: AgentId, to: AgentId) {
  return EDGES.find((e) => (e.a === from && e.b === to) || (e.a === to && e.b === from));
}

interface Props {
  states: Record<AgentId, AgentNodeState>;
  pulses: AgentPulse[];
  streaming: boolean;
}

export function AgentGraph({ states, pulses, streaming }: Props) {
  const validPulses = pulses.filter((p) => findEdge(p.from, p.to));
  const activeEdgeIds = new Set(validPulses.map((p) => findEdge(p.from, p.to)!.id));

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: streaming ? '#2DD4BF' : '#5A8AB4',
            boxShadow: streaming ? '0 0 8px #2DD4BF' : 'none',
            animation: streaming ? 'livePulse 1.6s ease-in-out infinite' : undefined,
          }}
        />
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#EAF4FF' }}>Agent World</div>
          <div style={{ fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {streaming ? 'multi-agent runtime · live' : 'multi-agent runtime · standby'}
          </div>
        </div>
        {/* Legend */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          {(
            [
              { label: 'idle', color: '#5A8AB4' },
              { label: 'thinking', color: '#2DD4BF' },
              { label: 'done', color: '#34D399' },
            ] as const
          ).map((l) => (
            <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, color: '#8BA8C8' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: l.color }} />
              {l.label}
            </span>
          ))}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, color: '#8BA8C8' }}>
            <span style={{ width: 14, height: 2, borderRadius: 2, background: 'linear-gradient(90deg, transparent, #2DD4BF)' }} />
            message
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ position: 'relative', height: 430, minWidth: 900 }}>
          {/* dotted backdrop */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'radial-gradient(rgba(139,168,200,0.10) 1px, transparent 1px)',
              backgroundSize: '26px 26px',
              pointerEvents: 'none',
            }}
          />

          {/* Edges */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          >
            {EDGES.map((edge) => {
              const a = NODE_POS[edge.a];
              const b = NODE_POS[edge.b];
              const active = activeEdgeIds.has(edge.id);
              return (
                <line
                  key={edge.id}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={active ? '#2DD4BF' : 'rgba(139,168,200,0.9)'}
                  strokeOpacity={active ? 0.55 : 0.16}
                  strokeWidth={active ? 1.6 : 1}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>

          {/* Message pulses */}
          <AnimatePresence>
            {streaming &&
              validPulses.map((pulse) => {
                const from = NODE_POS[pulse.from];
                const to = NODE_POS[pulse.to];
                const color = AGENT_META[pulse.to].color;
                return (
                  <motion.div
                    key={`${pulse.from}->${pulse.to}`}
                    initial={{ left: `${from.x}%`, top: `${from.y}%`, opacity: 0 }}
                    animate={{
                      left: [`${from.x}%`, `${to.x}%`],
                      top: [`${from.y}%`, `${to.y}%`],
                      opacity: [0, 1, 1, 0],
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.05, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.12 }}
                    style={{
                      position: 'absolute',
                      width: 9,
                      height: 9,
                      marginLeft: -4.5,
                      marginTop: -4.5,
                      borderRadius: '50%',
                      background: color,
                      boxShadow: `0 0 12px ${color}`,
                      zIndex: 3,
                      pointerEvents: 'none',
                    }}
                  />
                );
              })}
          </AnimatePresence>

          {/* Agent cards */}
          {(Object.keys(NODE_POS) as AgentId[]).map((agentId) => (
            <AgentNodeCard
              key={agentId}
              agentId={agentId}
              state={states[agentId]}
              pos={NODE_POS[agentId]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentNodeCard({
  agentId,
  state,
  pos,
}: {
  agentId: AgentId;
  state: AgentNodeState;
  pos: { x: number; y: number };
}) {
  const meta = AGENT_META[agentId];
  const thinking = state.status === 'thinking';
  const done = state.status === 'done';
  const AvatarIcon = agentId === 'human' ? UserCheck : agentId === 'tools' ? Wrench : Bot;

  return (
    <motion.div
      initial={false}
      animate={
        thinking
          ? {
              boxShadow: [
                `0 0 0 1px ${meta.color}55, 0 0 14px ${meta.color}22, 0 4px 14px rgba(0,0,0,0.45)`,
                `0 0 0 1px ${meta.color}88, 0 0 26px ${meta.color}44, 0 4px 14px rgba(0,0,0,0.45)`,
                `0 0 0 1px ${meta.color}55, 0 0 14px ${meta.color}22, 0 4px 14px rgba(0,0,0,0.45)`,
              ],
            }
          : {
              boxShadow: done
                ? `0 0 0 1px ${meta.color}33, 0 3px 10px rgba(0,0,0,0.4)`
                : '0 0 0 1px rgba(255,255,255,0.08), 0 3px 10px rgba(0,0,0,0.4)',
            }
      }
      transition={thinking ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.35 }}
      style={{
        position: 'absolute',
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: 'translate(-50%, -50%)',
        width: 188,
        borderRadius: 11,
        background: thinking
          ? `linear-gradient(180deg, rgba(16,32,51,0.99) 0%, rgba(14,28,45,0.99) 100%)`
          : 'linear-gradient(180deg, rgba(13,26,42,0.97) 0%, rgba(11,23,37,0.97) 100%)',
        padding: '10px 12px',
        zIndex: 2,
      }}
    >
      {/* header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 27,
            height: 27,
            borderRadius: 8,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `${meta.color}16`,
            border: `1px solid ${meta.color}40`,
            color: meta.color,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9.5,
            fontWeight: 800,
          }}
        >
          {meta.glyph}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#EAF4FF',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {meta.name}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 8.5,
              textTransform: 'uppercase',
              letterSpacing: '0.09em',
              fontWeight: 700,
              color: thinking ? meta.color : done ? '#34D399' : '#5A8AB4',
            }}
          >
            {done && !thinking ? (
              <Check size={9} strokeWidth={3} />
            ) : (
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: thinking ? meta.color : '#5A8AB4',
                  animation: thinking ? 'livePulse 1.1s ease-in-out infinite' : undefined,
                  boxShadow: thinking ? `0 0 6px ${meta.color}` : 'none',
                }}
              />
            )}
            {thinking ? 'thinking' : done ? 'done' : 'idle'}
          </div>
        </div>
        <AvatarIcon size={13} style={{ color: `${meta.color}AA`, flexShrink: 0 }} />
      </div>

      {/* activity line */}
      <div
        style={{
          marginTop: 8,
          paddingTop: 7,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          fontSize: 9.5,
          lineHeight: 1.45,
          color: state.activity ? '#BFD7F7' : '#5A8AB4',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          minHeight: 27,
        }}
      >
        {state.activity ?? AGENT_ROLE[agentId]}
      </div>
    </motion.div>
  );
}
