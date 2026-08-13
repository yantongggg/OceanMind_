import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { getSignals } from '../../../lib/api';
import {
  LayoutDashboard,
  Globe2,
  Workflow,
  Scale,
  Ship,
  Leaf,
  Users,
  FileText,
  Settings,
  Waves,
} from 'lucide-react';

const navigationItems = [
  { path: '/',              label: 'Command Center',      icon: LayoutDashboard },
  { path: '/globe',         label: 'Intelligence Globe',  icon: Globe2 },
  { path: '/orchestration', label: 'Agent Orchestration', icon: Workflow },
  { path: '/decisions',     label: 'Decisions',           icon: Scale },
  { path: '/voyages',       label: 'Voyages',             icon: Ship },
  { path: '/esg',           label: 'ESG & Carbon',        icon: Leaf },
  { path: '/suppliers',     label: 'Suppliers',           icon: Users },
  { path: '/reports',       label: 'Reports',             icon: FileText },
  { path: '/settings',      label: 'Settings',            icon: Settings },
];

const ACCENT = '#2DD4BF';

export function Sidebar() {
  const location = useLocation();
  /* React-controlled image-load state — falls back to the Waves icon when
   * the SVG asset fails to fetch, so the header never renders empty. */
  const [logoFailed, setLogoFailed] = useState(false);

  /* Real signal count. Live ingestion moves this number; it used to read a
   * hardcoded 40 (the curated dataset's size) regardless of the feed. */
  const [signalCount, setSignalCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    getSignals().then((s) => {
      if (!cancelled) setSignalCount(s.length);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /* match nested paths, e.g. /decisions/DEC-0042 */
  function isActive(path: string) {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  }

  return (
    <div
      className="w-64 h-screen flex flex-col"
      style={{
        background: '#08131F',
        borderRight: '1px solid rgba(255,255,255,0.09)',
      }}
    >
      {/* Wordmark — wave/compass mark at public/oceanmind-logo.svg */}
      <div className="px-6 py-7" style={{ borderBottom: '1px solid rgba(255,255,255,0.09)' }}>
        <div className="flex items-center gap-2.5 mb-0.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden relative"
            style={{
              background: 'rgba(45,212,191,0.08)',
              border: '1px solid rgba(45,212,191,0.28)',
            }}
          >
            {logoFailed ? (
              <Waves className="w-4 h-4" style={{ color: ACCENT }} />
            ) : (
              <img
                src="/oceanmind-logo.svg"
                alt="OceanMind"
                draggable={false}
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                onError={() => setLogoFailed(true)}
              />
            )}
          </div>
          <h1 className="text-base font-bold tracking-tight" style={{ color: '#EFF4F9' }}>
            OceanMind
          </h1>
        </div>
        <p
          className="text-[10px] mt-1.5"
          style={{
            color: '#4A6B88',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: 600,
            lineHeight: 1.5,
          }}
        >
          AI Decision Intelligence for Sustainable Maritime Operations
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 flex flex-col gap-0.5">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          /* Settings gets pushed toward the bottom */
          const isSettings = item.path === '/settings';

          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg"
              style={{
                transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                borderLeft: active ? `3px solid ${ACCENT}` : '3px solid transparent',
                background: active ? 'rgba(45,212,191,0.12)' : 'transparent',
                color: active ? '#E7FFFB' : '#557A96',
                marginTop: isSettings ? 'auto' : undefined,
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(45,212,191,0.07)';
                  (e.currentTarget as HTMLElement).style.color = '#8BB4D6';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = '#557A96';
                }
              }}
            >
              <Icon
                className="w-4 h-4 flex-shrink-0"
                strokeWidth={active ? 2 : 1.5}
                style={{ color: active ? ACCENT : 'currentColor' }}
              />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* System status */}
      <div className="px-4 py-5" style={{ borderTop: '1px solid rgba(255,255,255,0.09)' }}>
        <div
          className="px-3.5 py-3 rounded-lg"
          style={{
            background: 'rgba(7,17,29,0.8)',
            border: '1px solid rgba(255,255,255,0.09)',
          }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: '#00D47E',
                boxShadow: '0 0 6px rgba(0,212,126,0.55)',
                animation: 'livePulse 3s ease-in-out infinite',
              }}
            />
            <span
              className="text-[10px] font-semibold"
              style={{ color: '#3D5A75', textTransform: 'uppercase', letterSpacing: '0.12em' }}
            >
              Agents Online
            </span>
          </div>
          <p className="text-[10px] pl-3.5" style={{ color: 'rgba(61,90,117,0.55)' }}>
            {signalCount === null
              ? '6 agents ready'
              : `6 agents ready · ${signalCount} signals monitored`}
          </p>
        </div>
      </div>
    </div>
  );
}
