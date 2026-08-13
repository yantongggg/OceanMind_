import { Bot, Check, FileSearch, UserCheck } from 'lucide-react';
import type { ChainStep } from './reportMeta';

/**
 * The human-in-the-loop verification chain:
 *   AI generated → evidence attached → human sign-off.
 *
 * `compact` renders the inline 3-dot version used inside report cards;
 * the full version is the explainer strip at the top of the Reports page.
 */
const STEP_ICONS = { generated: Bot, evidence: FileSearch, signoff: UserCheck } as const;

export function VerificationChain({ steps, compact = false }: { steps: ChainStep[]; compact?: boolean }) {
  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {steps.map((step, i) => {
          const color = step.done ? '#00D47E' : '#E8A043';
          const Icon = STEP_ICONS[step.key];
          return (
            <div key={step.key} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && (
                <div
                  style={{
                    width: 26, height: 1.5, margin: '0 2px',
                    background: step.done
                      ? 'linear-gradient(90deg, rgba(0,212,126,0.5), rgba(0,212,126,0.5))'
                      : 'repeating-linear-gradient(90deg, rgba(232,160,67,0.55) 0 4px, transparent 4px 8px)',
                  }}
                />
              )}
              <div
                title={`${step.label} — ${step.detail}`}
                style={{
                  width: 24, height: 24, borderRadius: 999,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: step.done ? 'rgba(0,212,126,0.1)' : 'rgba(232,160,67,0.12)',
                  border: `1.5px solid ${step.done ? 'rgba(0,212,126,0.45)' : 'rgba(232,160,67,0.5)'}`,
                }}
              >
                <Icon size={11.5} style={{ color }} strokeWidth={2} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, flexWrap: 'wrap' }}>
      {steps.map((step, i) => {
        const color = step.done ? '#00D47E' : '#E8A043';
        const Icon = STEP_ICONS[step.key];
        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: '1 1 200px', minWidth: 0 }}>
            {i > 0 && (
              <div
                style={{
                  flex: '0 0 34px', height: 2, margin: '0 10px',
                  background: step.done
                    ? 'rgba(0,212,126,0.4)'
                    : 'repeating-linear-gradient(90deg, rgba(232,160,67,0.5) 0 5px, transparent 5px 10px)',
                }}
              />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
              <div
                style={{
                  width: 36, height: 36, borderRadius: 999, flexShrink: 0, position: 'relative',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: step.done ? 'rgba(0,212,126,0.09)' : 'rgba(232,160,67,0.1)',
                  border: `1.5px solid ${step.done ? 'rgba(0,212,126,0.4)' : 'rgba(232,160,67,0.45)'}`,
                }}
              >
                <Icon size={15} style={{ color }} strokeWidth={1.75} />
                {step.done && (
                  <div
                    style={{
                      position: 'absolute', right: -3, bottom: -3,
                      width: 14, height: 14, borderRadius: 999,
                      background: '#00D47E', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '2px solid #0A1826',
                    }}
                  >
                    <Check size={8} style={{ color: '#04240F' }} strokeWidth={3.5} />
                  </div>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: step.done ? '#EAF4FF' : '#E8A043', letterSpacing: '-0.01em' }}>
                  {step.label}
                </div>
                <div style={{ fontSize: 10.5, color: '#8BA8C8', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {step.detail}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
