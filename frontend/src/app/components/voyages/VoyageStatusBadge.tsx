import type { VoyageStatus } from '../../../data/types';
import { STATUS_META } from './geo';

/** Compact status pill used on the fleet board and the voyage header. */
export function VoyageStatusBadge({ status, size = 'sm' }: { status: VoyageStatus; size?: 'sm' | 'md' }) {
  const meta = STATUS_META[status];
  const isLive = status === 'underway' || status === 'rerouted';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: size === 'md' ? '4px 12px' : '2px 9px',
        borderRadius: 999,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        fontSize: size === 'md' ? 12 : 11,
        fontWeight: 600,
        color: meta.color,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: meta.color,
          boxShadow: isLive ? `0 0 6px ${meta.color}` : undefined,
          animation: isLive ? 'livePulse 2s ease-in-out infinite' : undefined,
        }}
      />
      {meta.label}
    </span>
  );
}
