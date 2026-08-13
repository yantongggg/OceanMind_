import { dnaTier } from './dna';

/**
 * Composite DNA score ring — a thin SVG arc gauge with the score in the
 * centre. Tier colour is derived from the score so cards and drawer stay
 * consistent without prop plumbing.
 */
export interface DnaRingProps {
  score: number;          // 0–100
  size?: number;          // px, default 74
  strokeWidth?: number;   // px, default 5.5
  /** Small caption under the number, defaults to "DNA". */
  caption?: string;
}

export function DnaRing({ score, size = 74, strokeWidth = 5.5, caption = 'DNA' }: DnaRingProps) {
  const tier = dnaTier(score);
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score));
  const dash = (pct / 100) * c;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }} title={`Composite DNA ${score}/100 — ${tier.label}`}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={tier.color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          style={{ filter: `drop-shadow(0 0 4px ${tier.soft})`, transition: 'stroke-dasharray 600ms cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 0,
        }}
      >
        <span style={{ fontSize: size * 0.28, fontWeight: 700, color: '#EAF4FF', lineHeight: 1, letterSpacing: '-0.02em' }}>
          {score}
        </span>
        <span style={{ fontSize: Math.max(8, size * 0.115), fontWeight: 700, color: tier.color, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 2 }}>
          {caption}
        </span>
      </div>
    </div>
  );
}
