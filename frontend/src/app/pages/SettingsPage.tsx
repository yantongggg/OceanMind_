import { useState } from 'react';
import { Settings, ShieldCheck, Bell, Bot, Leaf } from 'lucide-react';

const CARD: React.CSSProperties = {
  background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 14,
  boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
};

const LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  color: '#5A8AB4',
};

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      aria-pressed={on}
      style={{
        width: 40, height: 22, borderRadius: 999, position: 'relative',
        background: on ? 'rgba(45,212,191,0.35)' : 'rgba(255,255,255,0.08)',
        border: `1px solid ${on ? 'rgba(45,212,191,0.6)' : 'rgba(255,255,255,0.12)'}`,
        cursor: 'pointer', transition: 'all 200ms ease', flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute', top: 2, left: on ? 20 : 2,
          width: 16, height: 16, borderRadius: '50%',
          background: on ? '#2DD4BF' : '#5A8AB4',
          transition: 'all 200ms ease',
        }}
      />
    </button>
  );
}

/** Minimal OceanMind settings — demo-level controls only. */
export function SettingsPage() {
  const [autoRunPipeline, setAutoRunPipeline] = useState(true);
  const [criticalAlerts, setCriticalAlerts] = useState(true);
  const [carbonShadowPrice, setCarbonShadowPrice] = useState(72);
  const [requireApproval, setRequireApproval] = useState(true);

  const rows: {
    icon: typeof Bot;
    title: string;
    desc: string;
    control: React.ReactNode;
  }[] = [
    {
      icon: Bot,
      title: 'Auto-run pipeline on critical disruptions',
      desc: 'Launch Detect → Explain → Simulate → Recommend automatically when a CRITICAL cluster forms.',
      control: <Toggle on={autoRunPipeline} onChange={setAutoRunPipeline} />,
    },
    {
      icon: ShieldCheck,
      title: 'Require human approval for all recommendations',
      desc: 'Every decision — including READY ones — waits for a Voyage Operations Manager signature.',
      control: <Toggle on={requireApproval} onChange={setRequireApproval} />,
    },
    {
      icon: Bell,
      title: 'Critical alert notifications',
      desc: 'Notify on new CRITICAL signals and on decisions entering the approval queue.',
      control: <Toggle on={criticalAlerts} onChange={setCriticalAlerts} />,
    },
    {
      icon: Leaf,
      title: 'Carbon shadow price (€/tCO₂e)',
      desc: 'Applied to ALL emissions in decision ranking, not just the EU ETS scope.',
      control: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="range"
            min={0}
            max={200}
            step={1}
            value={carbonShadowPrice}
            onChange={(e) => setCarbonShadowPrice(parseInt(e.target.value, 10))}
            style={{ width: 140, cursor: 'pointer' }}
          />
          <span
            style={{
              minWidth: 58, padding: '5px 10px', borderRadius: 7, textAlign: 'center',
              background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.25)',
              fontSize: 12, fontWeight: 700, color: '#2DD4BF',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            €{carbonShadowPrice}
          </span>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 40, height: 40, borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(45,212,191,0.10)', border: '1px solid rgba(45,212,191,0.28)',
          }}
        >
          <Settings size={19} style={{ color: '#2DD4BF' }} />
        </div>
        <div>
          <div style={LABEL}>System Configuration</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#EAF4FF', lineHeight: 1.1, letterSpacing: '-0.02em', margin: 0 }}>
            Settings
          </h1>
        </div>
      </div>

      <div style={{ ...CARD, padding: '8px 24px' }}>
        {rows.map((row, i) => {
          const Icon = row.icon;
          return (
            <div
              key={row.title}
              style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '18px 0',
                borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}
            >
              <div
                style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.2)',
                }}
              >
                <Icon size={15} style={{ color: '#2DD4BF' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#EAF4FF', marginBottom: 2 }}>{row.title}</div>
                <div style={{ fontSize: 11.5, color: '#7FA5D3', lineHeight: 1.45 }}>{row.desc}</div>
              </div>
              {row.control}
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 11, color: '#3D5A75', margin: 0 }}>
        OceanMind v2.4 · Decision Engine deterministic core · demo configuration is session-local.
      </p>
    </div>
  );
}
