import { Zap, Cog, Globe2, Waves } from 'lucide-react';
import type { EsgSummary } from '../../../data/types';
import { CARD, LABEL, MONO } from './esgTheme';

/** Official UN SDG palette + icon per goal. */
const SDG_META: Record<number, { color: string; icon: typeof Zap }> = {
  7: { color: '#FCC30B', icon: Zap },
  9: { color: '#FD6925', icon: Cog },
  13: { color: '#3F7E44', icon: Globe2 },
  14: { color: '#0A97D9', icon: Waves },
};

/** SDG alignment — Track 6 storytelling cards (SDG 7 / 9 / 13 / 14). */
export function SdgCards({ esg }: { esg: EsgSummary }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={LABEL}>UN Sustainable Development Goals · Platform Alignment</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 14,
        }}
      >
        {esg.sdgAlignment.map((item) => {
          const meta = SDG_META[item.sdg] ?? SDG_META[13];
          const Icon = meta.icon;
          return (
            <div
              key={item.sdg}
              style={{
                ...CARD,
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                borderTop: `2px solid ${meta.color}`,
                minWidth: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: meta.color, color: '#FFFFFF',
                  }}
                >
                  <Icon size={18} strokeWidth={1.9} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: meta.color, fontFamily: MONO }}>
                    SDG {item.sdg}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#EAF4FF', lineHeight: 1.25 }}>
                    {item.title}
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 11.5, color: '#8BA8C8', lineHeight: 1.55, margin: 0, flex: 1 }}>
                {item.contribution}
              </p>
              <div
                style={{
                  padding: '7px 10px', borderRadius: 8,
                  background: 'rgba(8,19,31,0.6)', border: '1px solid rgba(255,255,255,0.06)',
                  fontSize: 11, fontWeight: 600, color: '#BFD7F7', fontFamily: MONO,
                }}
              >
                {item.metric}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
