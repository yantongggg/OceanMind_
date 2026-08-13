import { useEffect, useRef } from 'react';

/**
 * Animated deep-ocean backdrop: a slow drifting particle field ("marine
 * snow" / signal motes) plus layered sine swells along the lower third.
 * Pure canvas — no extra dependencies, DPR-aware, cleans up on unmount and
 * respects prefers-reduced-motion (renders a single static frame).
 */
export function OceanCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let raf = 0;

    interface Mote {
      x: number;      // 0–1 normalised
      y: number;      // 0–1 normalised
      r: number;      // radius px
      vx: number;     // drift px/s
      vy: number;
      alpha: number;
      phase: number;  // twinkle phase
    }

    const MOTE_COUNT = 90;
    const motes: Mote[] = Array.from({ length: MOTE_COUNT }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 1.6,
      vx: (Math.random() - 0.5) * 6,
      vy: -(3 + Math.random() * 9),
      alpha: 0.12 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
    }));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawWave = (
      t: number,
      baseY: number,
      amplitude: number,
      wavelength: number,
      speed: number,
      color: string,
      lineWidth: number,
    ) => {
      ctx.beginPath();
      const step = 6;
      for (let x = -step; x <= width + step; x += step) {
        const y =
          baseY +
          Math.sin((x / wavelength) * Math.PI * 2 + t * speed) * amplitude +
          Math.sin((x / (wavelength * 0.53)) * Math.PI * 2 - t * speed * 0.7) * amplitude * 0.35;
        if (x === -step) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    };

    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = now / 1000;

      ctx.clearRect(0, 0, width, height);

      // Abyssal glow — faint radial teal well below centre.
      const glow = ctx.createRadialGradient(
        width * 0.5, height * 0.85, 0,
        width * 0.5, height * 0.85, Math.max(width, height) * 0.9,
      );
      glow.addColorStop(0, 'rgba(45, 212, 191, 0.055)');
      glow.addColorStop(0.5, 'rgba(34, 184, 207, 0.02)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      // Marine snow / signal motes.
      for (const m of motes) {
        m.x += (m.vx * dt) / Math.max(width, 1);
        m.y += (m.vy * dt) / Math.max(height, 1);
        if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
        if (m.x < -0.02) m.x = 1.02;
        if (m.x > 1.02) m.x = -0.02;

        const twinkle = 0.65 + 0.35 * Math.sin(t * 1.4 + m.phase);
        ctx.beginPath();
        ctx.arc(m.x * width, m.y * height, m.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(94, 234, 212, ${(m.alpha * twinkle).toFixed(3)})`;
        ctx.fill();
      }

      // Layered swells across the lower third.
      drawWave(t, height * 0.78, 10, 340, 0.55, 'rgba(45, 212, 191, 0.10)', 1.2);
      drawWave(t, height * 0.84, 14, 260, 0.42, 'rgba(56, 189, 248, 0.07)', 1.1);
      drawWave(t, height * 0.90, 18, 420, 0.32, 'rgba(45, 212, 191, 0.05)', 1.0);

      if (!reduceMotion) raf = requestAnimationFrame(frame);
    };

    resize();
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}
