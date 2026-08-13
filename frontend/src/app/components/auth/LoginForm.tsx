import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Label } from '../ui/label';

const DEMO_EMAIL = 'ops@oceanmind.ai';

/**
 * Demo sign-in form. Any credentials pass; on submit it writes the
 * localStorage 'om.auth' session (checked by the App-level RequireAuth
 * guard) and navigates to the page the visitor originally requested.
 */
export function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    // Demo auth — a brief pause sells the "establishing secure session" beat.
    setTimeout(() => {
      localStorage.setItem(
        'om.auth',
        JSON.stringify({
          email: email.trim() || DEMO_EMAIL,
          role: 'Voyage Operations Manager',
          at: new Date().toISOString(),
        }),
      );
      navigate(from, { replace: true });
    }, 700);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <Label
          htmlFor="login-email"
          className="text-[10.5px] font-bold uppercase"
          style={{ color: '#5A8AB4', letterSpacing: '0.12em' }}
        >
          Email
        </Label>
        <div className="relative">
          <Mail
            size={15}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
            style={{ color: '#5A8AB4' }}
          />
          <Input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={DEMO_EMAIL}
            autoComplete="username"
            className="h-11 rounded-xl pl-10 text-[14px]"
            style={{
              background: 'rgba(5,11,20,0.8)',
              borderColor: 'rgba(255,255,255,0.09)',
              color: '#EAF4FF',
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label
            htmlFor="login-password"
            className="text-[10.5px] font-bold uppercase"
            style={{ color: '#5A8AB4', letterSpacing: '0.12em' }}
          >
            Password
          </Label>
          <button
            type="button"
            onClick={() => {
              setEmail(DEMO_EMAIL);
              setPassword('harmony-2026');
            }}
            className="inline-flex items-center gap-1 text-[10.5px] font-semibold transition-colors hover:opacity-80"
            style={{ color: '#2DD4BF' }}
          >
            <Sparkles size={11} strokeWidth={2} />
            Use demo credentials
          </button>
        </div>
        <div className="relative">
          <Lock
            size={15}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
            style={{ color: '#5A8AB4' }}
          />
          <Input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Any password works in demo mode"
            autoComplete="current-password"
            className="h-11 rounded-xl pl-10 pr-11 text-[14px]"
            style={{
              background: 'rgba(5,11,20,0.8)',
              borderColor: 'rgba(255,255,255,0.09)',
              color: '#EAF4FF',
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:opacity-80"
            style={{ color: '#5A8AB4' }}
          >
            {showPassword ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
          </button>
        </div>
      </div>

      <motion.div whileTap={{ scale: 0.985 }}>
        <Button
          type="submit"
          disabled={submitting}
          className="h-11 w-full rounded-xl text-[14px] font-bold"
          style={{
            background: submitting
              ? 'rgba(45,212,191,0.4)'
              : 'linear-gradient(120deg, #2DD4BF 0%, #22B8CF 100%)',
            color: '#07111D',
            boxShadow: submitting ? 'none' : '0 4px 20px rgba(45,212,191,0.28)',
          }}
        >
          {submitting ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              Establishing secure session…
            </>
          ) : (
            <>
              Sign in to Command Center
              <ArrowRight size={16} strokeWidth={2.25} />
            </>
          )}
        </Button>
      </motion.div>

      <div
        className="flex items-start gap-2.5 rounded-lg px-3.5 py-3"
        style={{
          background: 'rgba(45,212,191,0.05)',
          border: '1px dashed rgba(45,212,191,0.28)',
        }}
      >
        <ShieldCheck size={13} strokeWidth={1.75} className="mt-0.5 shrink-0" style={{ color: '#2DD4BF' }} />
        <p className="text-[11px] leading-relaxed" style={{ color: '#7FA5D3' }}>
          Hackathon demo access — sign in as{' '}
          <strong style={{ color: '#BFD7F7' }}>{DEMO_EMAIL}</strong> with any password. You&apos;ll
          enter as the Voyage Operations Manager with full approval authority.
        </p>
      </div>
    </form>
  );
}
