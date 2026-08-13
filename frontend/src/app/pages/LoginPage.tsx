import { motion } from 'motion/react';
import { Navigate } from 'react-router';
import { BrandPanel } from '../components/auth/BrandPanel';
import { LoginForm } from '../components/auth/LoginForm';
import { OceanCanvas } from '../components/auth/OceanCanvas';

/**
 * OceanMind sign-in — lives outside the app shell.
 *
 * Split hero: animated deep-ocean intelligence panel on the left (desktop),
 * focused sign-in column on the right. Demo credentials ops@oceanmind.ai /
 * any password; successful sign-in writes localStorage 'om.auth' (checked by
 * the App-level RequireAuth guard) and routes into the Command Center.
 * Already-authenticated visitors are bounced straight into the app —
 * the inverse of the RequireAuth guard.
 */
export function LoginPage() {
  let authed = false;
  try {
    authed = Boolean(localStorage.getItem('om.auth'));
  } catch {
    /* storage unavailable — show the sign-in screen */
  }
  if (authed) return <Navigate to="/" replace />;

  return (
    <div
      className="grid min-h-screen w-full lg:grid-cols-[1.15fr_1fr] xl:grid-cols-[1.25fr_1fr]"
      style={{ background: '#07111D' }}
    >
      <BrandPanel />

      {/* Sign-in column */}
      <div
        className="relative flex items-center justify-center overflow-hidden px-6 py-12 sm:px-12"
        style={{
          background:
            'radial-gradient(ellipse 700px 500px at 50% 0%, rgba(45,212,191,0.05) 0%, transparent 60%), linear-gradient(180deg, #08131F 0%, #07111D 60%, #060F1A 100%)',
        }}
      >
        {/* Mobile-only backdrop (the brand panel is hidden below lg) */}
        <div className="absolute inset-0 lg:hidden">
          <OceanCanvas />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-[400px]"
        >
          {/* Compact brand header (all breakpoints on the form side) */}
          <div className="mb-8 flex flex-col items-center text-center">
            <div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{
                background: 'rgba(45,212,191,0.08)',
                border: '1px solid rgba(45,212,191,0.30)',
                boxShadow: '0 0 36px rgba(45,212,191,0.14)',
              }}
            >
              <img src="/oceanmind-logo.svg" alt="OceanMind" className="h-11 w-11" />
            </div>
            <h1
              className="text-[26px] font-bold tracking-tight"
              style={{ color: '#EAF4FF', letterSpacing: '-0.02em' }}
            >
              Welcome back
            </h1>
            <p className="mt-1.5 text-[13px]" style={{ color: '#8BA8C8' }}>
              Sign in to the OceanMind operations console
            </p>
            {/* Tagline + track badge — shown here on mobile where BrandPanel is hidden */}
            <p
              className="mt-3 max-w-[320px] text-[10px] font-semibold uppercase lg:hidden"
              style={{ color: '#5A8AB4', letterSpacing: '0.13em', lineHeight: 1.6 }}
            >
              AI Decision Intelligence for Sustainable Maritime Operations
            </p>
          </div>

          {/* Card */}
          <div
            className="rounded-2xl p-7"
            style={{
              background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
              border: '1px solid rgba(255,255,255,0.09)',
              boxShadow:
                '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <LoginForm />
          </div>

          <div className="mt-7 flex flex-col items-center gap-2">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[9.5px] font-bold uppercase lg:hidden"
              style={{
                color: '#5EEAD4',
                letterSpacing: '0.14em',
                background: 'rgba(45,212,191,0.07)',
                border: '1px solid rgba(45,212,191,0.25)',
              }}
            >
              MAIC Nexus 2026 · Track 6 — AI for ESG &amp; SDG
            </span>
            <p className="text-center text-[10.5px]" style={{ color: '#3D5A75' }}>
              OceanMind Decision Engine v2.4 · Detect → Explain → Simulate → Recommend → Approve
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
