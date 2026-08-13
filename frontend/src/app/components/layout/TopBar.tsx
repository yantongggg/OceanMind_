import { Search, Bell, User, X, AlertTriangle, CheckCircle2, Scale, Radio, Ship } from 'lucide-react';
import { useEffect, useMemo, useState, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { useNow, SyncBadge } from '../../../lib/useNowClock';
import { getDecisions, getSignals, getVoyages } from '../../../lib/api';
import type { Decision, Signal, Voyage } from '../../../data/types';

const ACCENT = '#2DD4BF';

/** Session written by LoginForm on sign-in; shape is untrusted. */
function readAuthSession(): { email: string; role: string } {
  const fallback = { email: 'ops@oceanmind.ai', role: 'Voyage Operations Manager' };
  try {
    const raw = localStorage.getItem('om.auth');
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return fallback;
    const { email, role } = parsed as { email?: unknown; role?: unknown };
    return {
      email: typeof email === 'string' && email.trim() ? email.trim() : fallback.email,
      role: typeof role === 'string' && role.trim() ? role.trim() : fallback.role,
    };
  } catch {
    return fallback;
  }
}

interface QuickHit {
  key: string;
  kind: 'Decision' | 'Voyage' | 'Signal';
  title: string;
  sub: string;
  path: string;
}

const HIT_META: Record<QuickHit['kind'], { icon: typeof Scale; color: string }> = {
  Decision: { icon: Scale, color: '#2DD4BF' },
  Voyage: { icon: Ship, color: '#4D9FFF' },
  Signal: { icon: Radio, color: '#FFB84D' },
};

export function TopBar() {
  const navigate = useNavigate();
  // Wall clock comes from the single NowClockProvider at the App root so
  // every page derives "now" from the same source.
  const nowMs = useNow();
  const currentTime = new Date(nowMs);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Signed-in identity (LoginForm accepts any email — reflect it here).
  const [session] = useState(readAuthSession);

  /* ── Quick search over signals / voyages / decisions ────────────────── */
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const indexRef = useRef<{ decisions: Decision[]; voyages: Voyage[]; signals: Signal[] } | null>(null);
  const [indexVersion, setIndexVersion] = useState(0);

  // Signal counter — real count, not a hardcoded 40. Live ingestion means the
  // number moves, and a frozen figure next to a "LIVE" badge is a lie the
  // moment the feed grows past the curated dataset.
  const [signalCount, setSignalCount] = useState<number | null>(null);
  const [liveCount, setLiveCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getSignals().then((signals) => {
        if (cancelled) return;
        setSignalCount(signals.length);
        setLiveCount(signals.filter((s) => s.origin === 'live').length);
      });
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // Lazily build the search index on first focus (api.ts falls back to mock).
  const ensureIndex = () => {
    if (indexRef.current) return;
    Promise.all([getDecisions(), getVoyages(), getSignals()]).then(
      ([decisions, voyages, signals]) => {
        indexRef.current = { decisions, voyages, signals };
        setIndexVersion((v) => v + 1);
      },
      () => {
        /* unreachable — every getter has a mock fallback */
      },
    );
  };

  const hits = useMemo<QuickHit[]>(() => {
    const q = query.trim().toLowerCase();
    const data = indexRef.current;
    if (!q || !data) return [];
    const matches = (...fields: (string | undefined)[]) =>
      fields.some((f) => f?.toLowerCase().includes(q));
    const out: QuickHit[] = [];
    for (const d of data.decisions) {
      if (matches(d.id, d.title)) {
        out.push({
          key: d.id,
          kind: 'Decision',
          title: d.title,
          sub: `${d.id} · ${d.status}`,
          path: `/decisions/${d.id}`,
        });
      }
    }
    for (const v of data.voyages) {
      if (matches(v.id, v.vessel.name, v.originPort, v.destinationPort)) {
        out.push({
          key: v.id,
          kind: 'Voyage',
          title: v.vessel.name,
          sub: `${v.id} · ${v.originPort} → ${v.destinationPort}`,
          path: `/voyages/${v.id}`,
        });
      }
    }
    for (const s of data.signals) {
      if (matches(s.id, s.title, s.source)) {
        out.push({
          key: s.id,
          kind: 'Signal',
          title: s.title,
          sub: `${s.id} · ${s.source}`,
          path: '/globe',
        });
      }
    }
    return out.slice(0, 8);
    // indexVersion re-runs the memo once the lazily-loaded index arrives.
  }, [query, indexVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  const goToHit = (hit: QuickHit) => {
    navigate(hit.path);
    setQuery('');
    setSearchOpen(false);
    searchInputRef.current?.blur();
  };

  const handleSearchKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => (hits.length ? (i + 1) % hits.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => (hits.length ? (i - 1 + hits.length) % hits.length : 0));
    } else if (e.key === 'Enter') {
      const hit = hits[activeIdx] ?? hits[0];
      if (hit) goToHit(hit);
    } else if (e.key === 'Escape') {
      setSearchOpen(false);
      searchInputRef.current?.blur();
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

  const handleSignOut = () => {
    localStorage.removeItem('om.auth');
    setUserMenuOpen(false);
    navigate('/login', { replace: true });
  };

  return (
    <div
      className="h-16 border-b flex items-center justify-between px-8"
      style={{
        background: '#08131F',
        borderBottom: '1px solid rgba(255,255,255,0.09)',
        boxShadow: '0 1px 0 rgba(0,0,0,0.3)',
      }}
    >
      <div className="flex items-center gap-4 flex-1">
        <div className="relative flex-1 max-w-md" ref={searchRef}>
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground-muted" />
          <input
            ref={searchInputRef}
            type="text"
            role="combobox"
            aria-expanded={searchOpen && query.trim().length > 0}
            aria-label="Search signals, voyages, decisions"
            placeholder="Search signals, voyages, decisions…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
            }}
            onKeyDown={handleSearchKeyDown}
            className="w-full rounded-2xl pl-11 pr-4 py-2.5 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none transition-all"
            style={{
              background: '#0E1C2D',
              border: '1px solid rgba(255,255,255,0.09)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(45,212,191,0.35)';
              ensureIndex();
              setSearchOpen(true);
            }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}
          />

          {searchOpen && query.trim().length > 0 && (
            <div
              className="absolute left-0 right-0 mt-2 rounded-lg shadow-xl z-50 overflow-hidden"
              style={{
                background: '#0A1521',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              {hits.length === 0 ? (
                <div className="px-4 py-4 text-xs text-foreground-muted">
                  No signals, voyages or decisions match{' '}
                  <span className="text-foreground-secondary font-semibold">“{query.trim()}”</span>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto py-1">
                  {hits.map((hit, i) => {
                    const meta = HIT_META[hit.kind];
                    const Icon = meta.icon;
                    const active = i === activeIdx;
                    return (
                      <button
                        key={`${hit.kind}-${hit.key}`}
                        onMouseDown={(e) => e.preventDefault() /* keep input focus */}
                        onClick={() => goToHit(hit)}
                        onMouseEnter={() => setActiveIdx(i)}
                        className="w-full px-3.5 py-2.5 flex items-center gap-3 text-left transition-colors"
                        style={{ background: active ? 'rgba(45,212,191,0.08)' : 'transparent' }}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}30` }}
                        >
                          <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-foreground truncate">{hit.title}</div>
                          <div className="text-[10.5px] text-foreground-muted truncate">{hit.sub}</div>
                        </div>
                        <span
                          className="text-[9px] font-bold uppercase tracking-wider flex-shrink-0"
                          style={{ color: meta.color, letterSpacing: '0.12em' }}
                        >
                          {hit.kind}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div
                className="px-3.5 py-2 text-[9.5px] text-foreground-muted border-t"
                style={{ borderColor: 'rgba(255,255,255,0.08)' }}
              >
                ↑↓ navigate · Enter open · Esc dismiss
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-8">
        {/* Live indicators */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2.5 px-3.5 py-2 rounded"
            style={{
              background: 'rgba(0,212,126,0.07)',
              border: '1px solid rgba(0,212,126,0.18)',
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full bg-success"
              style={{ boxShadow: '0 0 6px rgba(0,212,126,0.5)', animation: 'livePulse 2s ease-in-out infinite' }}
            />
            <span className="text-xs font-bold text-success tracking-wider">LIVE</span>
          </div>

          {/* Signal-intake ticker */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded"
            title={
              liveCount > 0
                ? `${liveCount} signals ingested live from news search + maritime RSS feeds`
                : 'Curated scenario dataset — live ingestion is off'
            }
            style={{
              background: 'rgba(45,212,191,0.07)',
              border: '1px solid rgba(45,212,191,0.22)',
            }}
          >
            <Radio size={11} style={{ color: ACCENT }} />
            <span className="text-[10px] font-bold tracking-wider" style={{ color: ACCENT }}>SIGNALS</span>
            <span className="text-xs font-bold text-foreground tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {signalCount ?? '—'}
            </span>
            <span className="text-[9px] text-foreground-muted">
              {liveCount > 0 ? 'live' : '/96h'}
            </span>
          </div>

          <SyncBadge />
          <div className="text-right">
            <div className="text-sm font-semibold text-foreground tabular-nums">{formatTime(currentTime)}</div>
            <div className="text-xs text-foreground-muted">{formatDate(currentTime)}</div>
          </div>
        </div>

        {/* Notifications */}
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative p-2.5 rounded-2xl transition-all"
            style={{
              background: '#0E1C2D',
              border: '1px solid rgba(255,255,255,0.09)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#102033';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#0E1C2D';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)';
            }}
          >
            <Bell className="w-5 h-5 text-foreground-secondary" strokeWidth={1.5} />
            <span
              className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-critical rounded-full"
              style={{ border: '1px solid #08131F' }}
            />
          </button>

          {notificationsOpen && (
            <div
              className="absolute right-0 mt-2 w-96 rounded-lg shadow-xl z-50"
              style={{
                background: '#0A1521',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">Notifications</h3>
                <button onClick={() => setNotificationsOpen(false)}>
                  <X className="w-4 h-4 text-foreground-muted" />
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {[
                  { icon: Scale, color: '#2DD4BF', title: 'Decision awaiting approval', desc: 'DEC-0042 — Cape reroute for VYG-2026-0007, reliability READY', time: '4 min ago', path: '/decisions/DEC-0042' },
                  { icon: AlertTriangle, color: '#FF5A5A', title: 'Critical disruption active', desc: 'Red Sea / Bab el-Mandeb escalation — 9 corroborated signals', time: '2 h ago', path: '/globe' },
                  { icon: AlertTriangle, color: '#FFB84D', title: 'Typhoon Mirinae — Category 3', desc: 'VYG-2026-0005 southern deviation under REVIEW', time: '6 h ago', path: '/decisions/DEC-0040' },
                  { icon: CheckCircle2, color: '#00D98E', title: 'Decision approved', desc: 'DEC-0041 — Meridian bunker window locked for VYG-2026-0003', time: 'Yesterday', path: '/decisions/DEC-0041' },
                ].map((notif, i) => {
                  const Icon = notif.icon;
                  return (
                    <div
                      key={i}
                      onClick={() => { navigate(notif.path); setNotificationsOpen(false); }}
                      className="p-4 border-b border-border hover:bg-surface-secondary/30 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `${notif.color}15`, border: `1px solid ${notif.color}30` }}
                        >
                          <Icon className="w-4 h-4" style={{ color: notif.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-foreground mb-1">{notif.title}</div>
                          <div className="text-xs text-foreground-muted mb-2">{notif.desc}</div>
                          <div className="text-xs text-foreground-secondary">{notif.time}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-3 border-t border-border text-center">
                <button
                  onClick={() => { navigate('/decisions'); setNotificationsOpen(false); }}
                  className="text-xs font-semibold text-primary hover:text-primary/80"
                >
                  View decision queue
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User profile */}
        <div className="relative" ref={userMenuRef}>
          <div
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-3 pl-6 border-l border-border cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="text-right">
              <div className="text-sm font-semibold text-foreground">Voyage Ops Manager</div>
              <div className="text-xs text-foreground-muted">OceanMind Fleet Control</div>
            </div>
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{
                background: 'rgba(45,212,191,0.10)',
                border: '1px solid rgba(45,212,191,0.25)',
              }}
            >
              <User className="w-5 h-5" strokeWidth={2} style={{ color: ACCENT }} />
            </div>
          </div>

          {userMenuOpen && (
            <div
              className="absolute right-0 mt-2 w-64 rounded-lg shadow-xl z-50"
              style={{
                background: '#0A1521',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <div className="p-4 border-b border-border">
                <div className="text-sm font-bold text-foreground mb-1">{session.role}</div>
                <div className="text-xs text-foreground-muted truncate">{session.email}</div>
              </div>
              <div className="py-2">
                {[
                  { label: 'Profile & preferences', path: '/settings' },
                  { label: 'My approvals', path: '/decisions' },
                  { label: 'Fleet overview', path: '/voyages' },
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={() => { navigate(item.path); setUserMenuOpen(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-surface-secondary/30 transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="p-3 border-t border-border">
                <button
                  onClick={handleSignOut}
                  className="w-full px-4 py-2 text-sm font-semibold text-critical hover:bg-critical/10 rounded transition-colors"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
