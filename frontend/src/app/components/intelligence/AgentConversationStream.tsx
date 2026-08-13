import { useEffect, useRef } from 'react';
import { Bot, Wrench, GitBranch, ShieldCheck, Sparkles, Eye, UserCheck } from 'lucide-react';
import type { AgentEvent, AgentId, AgentEventKind } from '../../../data/types';

/**
 * AgentConversationStream — scrollable live feed of multi-agent pipeline
 * events (Detect → Explain → Simulate → Recommend → Approve).
 *
 * Pure presentational: feed it AgentEvent[] (from api.streamPipeline or a
 * completed PipelineRun) and it renders the running conversation. The
 * orchestration page owns playback state; this component just displays and
 * auto-scrolls.
 */

export const AGENT_META: Record<AgentId, { glyph: string; name: string; color: string }> = {
  disruption: { glyph: 'DI', name: 'Disruption Intelligence', color: '#2DD4BF' },
  causal:     { glyph: 'CI', name: 'Causal Impact',           color: '#A78BFA' },
  simulation: { glyph: 'SS', name: 'Scenario Simulation',     color: '#38BDF8' },
  decision:   { glyph: 'DA', name: 'Decision Agent',          color: '#34D399' },
  tools:      { glyph: 'DT', name: 'Deterministic Tools',     color: '#E8A043' },
  human:      { glyph: 'HA', name: 'Human Approval',          color: '#BFD7F7' },
};

const KIND_META: Record<AgentEventKind, { label: string; icon: typeof Bot; color: string }> = {
  observation:    { label: 'Observation',    icon: Eye,         color: '#8BA8C8' },
  analysis:       { label: 'Analysis',       icon: Sparkles,    color: '#A78BFA' },
  tool_call:      { label: 'Tool call',      icon: Wrench,      color: '#E8A043' },
  tool_result:    { label: 'Tool result',    icon: Wrench,      color: '#E8A043' },
  handoff:        { label: 'Handoff',        icon: GitBranch,   color: '#38BDF8' },
  recommendation: { label: 'Recommendation', icon: Bot,         color: '#34D399' },
  gate:           { label: 'Gate',           icon: ShieldCheck, color: '#2DD4BF' },
};

interface Props {
  events: AgentEvent[];
  /** True while the pipeline is still streaming — shows the live cursor. */
  streaming?: boolean;
  /** Fixed height for the scroll container (default 460). */
  height?: number | string;
  /** Optional click handler for a rendered event row. */
  onEventClick?: (event: AgentEvent) => void;
}

export function AgentConversationStream({ events, streaming = false, height = 460, onEventClick }: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the newest event.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [events.length]);

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
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
            background: streaming ? '#2DD4BF' : '#34D399',
            boxShadow: `0 0 8px ${streaming ? '#2DD4BF' : '#34D399'}`,
            animation: streaming ? 'livePulse 1.6s ease-in-out infinite' : undefined,
          }}
        />
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#EAF4FF' }}>Agent Conversation</div>
          <div style={{ fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {streaming ? `${events.length} events · streaming` : `${events.length} events · complete`}
          </div>
        </div>
      </div>

      {/* Event list */}
      <div
        ref={listRef}
        style={{
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          height,
          overflowY: 'auto',
        }}
      >
        {events.length === 0 && (
          <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 11, color: '#5A8AB4' }}>
            {streaming ? 'Waiting for the first agent event…' : 'Run the pipeline to see the agent conversation.'}
          </div>
        )}

        {events.map((event) => {
          const agent = AGENT_META[event.agent];
          const kind = KIND_META[event.kind];
          const KindIcon = kind.icon;
          const time = event.ts.slice(11, 19);
          return (
            <div
              key={event.id}
              onClick={onEventClick ? () => onEventClick(event) : undefined}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                animation: 'fadeInUp 280ms ease-out',
                cursor: onEventClick ? 'pointer' : 'default',
              }}
            >
              {/* Meta line */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: `${agent.color}18`,
                    border: `1px solid ${agent.color}38`,
                    color: agent.color,
                    fontWeight: 800,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                  }}
                >
                  {event.agent === 'human' ? <UserCheck size={11} /> : <Bot size={11} />}
                  {agent.name}
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    color: kind.color,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    fontWeight: 700,
                    fontSize: 9,
                  }}
                >
                  <KindIcon size={10} />
                  {kind.label}
                </span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 9,
                    color: '#5A8AB4',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {event.stage.toUpperCase()} · {time}Z
                </span>
              </div>

              {/* Body */}
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 7,
                  background: 'rgba(4,10,18,0.55)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderLeft: `3px solid ${agent.color}`,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: '#EAF4FF', marginBottom: 3 }}>
                  {event.title}
                </div>
                <div style={{ fontSize: 11.5, color: '#BFD7F7', lineHeight: 1.55 }}>{event.detail}</div>
                {event.dataRefs.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {event.dataRefs.map((ref) => (
                      <span
                        key={ref}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 10,
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          fontSize: 9.5,
                          color: '#7FA5D3',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {ref}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Streaming cursor */}
        {streaming && events.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px' }}>
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#2DD4BF',
                animation: 'livePulse 1.2s ease-in-out infinite',
                boxShadow: '0 0 8px rgba(45,212,191,0.8)',
              }}
            />
            <span style={{ fontSize: 10, color: '#5A8AB4', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Agents working…
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
