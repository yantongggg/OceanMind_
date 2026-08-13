import { motion } from 'motion/react';
import { Radar, Network, FlaskConical, Compass, UserCheck, Check } from 'lucide-react';
import type { PipelineStage } from '../../../data/types';

/**
 * StageTracker — animated Detect → Explain → Simulate → Recommend → Approve
 * progress rail. Driven entirely by the live event stream: the page passes
 * the stage of the newest AgentEvent and a `complete` flag.
 */

const STAGES: { id: PipelineStage; label: string; agent: string; icon: typeof Radar }[] = [
  { id: 'detect',    label: 'Detect',    agent: 'Disruption Intelligence', icon: Radar },
  { id: 'explain',   label: 'Explain',   agent: 'Causal Impact',           icon: Network },
  { id: 'simulate',  label: 'Simulate',  agent: 'Scenario Simulation',     icon: FlaskConical },
  { id: 'recommend', label: 'Recommend', agent: 'Decision Agent',          icon: Compass },
  { id: 'approve',   label: 'Approve',   agent: 'Human Approval',          icon: UserCheck },
];

type StageState = 'pending' | 'active' | 'done';

interface Props {
  currentStage: PipelineStage | null;
  complete: boolean;
}

export function StageTracker({ currentStage, complete }: Props) {
  const currentIdx = currentStage ? STAGES.findIndex((s) => s.id === currentStage) : -1;

  const stateOf = (i: number): StageState => {
    if (complete) return 'done';
    if (currentIdx === -1) return 'pending';
    if (i < currentIdx) return 'done';
    if (i === currentIdx) return 'active';
    return 'pending';
  };

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
        padding: '18px 26px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        overflowX: 'auto',
      }}
    >
      {STAGES.map((stage, i) => {
        const state = stateOf(i);
        const Icon = stage.icon;
        const circleColor =
          state === 'done' ? '#34D399' : state === 'active' ? '#2DD4BF' : '#5A8AB4';

        return (
          <div key={stage.id} style={{ display: 'flex', flex: i < STAGES.length - 1 ? 1 : '0 0 auto', minWidth: 0 }}>
            {/* Stage node */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 132, flexShrink: 0 }}>
              <motion.div
                animate={
                  state === 'active'
                    ? { boxShadow: ['0 0 0 0 rgba(45,212,191,0.35)', '0 0 0 9px rgba(45,212,191,0)'] }
                    : { boxShadow: '0 0 0 0 rgba(45,212,191,0)' }
                }
                transition={state === 'active' ? { duration: 1.4, repeat: Infinity, ease: 'easeOut' } : undefined}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  background:
                    state === 'done'
                      ? 'rgba(52,211,153,0.10)'
                      : state === 'active'
                        ? 'rgba(45,212,191,0.14)'
                        : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${
                    state === 'done'
                      ? 'rgba(52,211,153,0.42)'
                      : state === 'active'
                        ? 'rgba(45,212,191,0.55)'
                        : 'rgba(255,255,255,0.10)'
                  }`,
                }}
              >
                <Icon size={18} style={{ color: circleColor }} />
                {state === 'done' && (
                  <div
                    style={{
                      position: 'absolute',
                      right: -5,
                      top: -5,
                      width: 15,
                      height: 15,
                      borderRadius: '50%',
                      background: '#0E3B2C',
                      border: '1px solid rgba(52,211,153,0.6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check size={9} style={{ color: '#34D399' }} strokeWidth={3} />
                  </div>
                )}
              </motion.div>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    color: state === 'pending' ? '#5A8AB4' : '#EAF4FF',
                    textTransform: 'uppercase',
                  }}
                >
                  {stage.label}
                </div>
                <div style={{ fontSize: 9, color: state === 'active' ? '#2DD4BF' : '#5A8AB4', marginTop: 2 }}>
                  {stage.agent}
                </div>
              </div>
            </div>

            {/* Connector */}
            {i < STAGES.length - 1 && (
              <div style={{ flex: 1, minWidth: 24, display: 'flex', alignItems: 'center', height: 42 }}>
                <div
                  style={{
                    width: '100%',
                    height: 2,
                    borderRadius: 2,
                    background: 'rgba(255,255,255,0.07)',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <motion.div
                    initial={false}
                    animate={{ width: state === 'done' ? '100%' : state === 'active' ? '45%' : '0%' }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    style={{
                      height: '100%',
                      borderRadius: 2,
                      background:
                        state === 'done'
                          ? 'linear-gradient(90deg, #34D399, #2DD4BF)'
                          : 'linear-gradient(90deg, #2DD4BF, rgba(45,212,191,0.15))',
                    }}
                  />
                  {state === 'active' && (
                    <motion.div
                      animate={{ left: ['-18%', '104%'] }}
                      transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
                      style={{
                        position: 'absolute',
                        top: 0,
                        width: '16%',
                        height: '100%',
                        background: 'linear-gradient(90deg, transparent, rgba(45,212,191,0.8), transparent)',
                      }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
