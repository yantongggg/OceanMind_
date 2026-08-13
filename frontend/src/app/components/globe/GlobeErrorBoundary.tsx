/**
 * Error boundary around the WebGL globe canvas.
 *
 * If the browser cannot create a WebGL context (headless environments,
 * exotic GPU/driver combos, disabled hardware acceleration) react-three-fiber
 * throws during render. Without a boundary that exception unmounts the whole
 * app shell — with it, the rest of the intelligence terminal (filters,
 * briefing panel, news ticker) keeps working and we show a notice where the
 * globe would be.
 *
 * The notice SHOWS THE ACTUAL ERROR. The first version printed a generic
 * "WebGL could not be initialised" for every failure, which made a transient
 * HMR hiccup indistinguishable from a real GPU problem — and left the person
 * looking at it with nothing to report. It also offers a retry: React error
 * boundaries never reset themselves, so a one-frame glitch (dev-server module
 * reload, driver reset, GPU context loss) used to wedge the fallback until a
 * full page refresh.
 */

import { Component, type ReactNode } from 'react';
import { Globe2, RotateCcw } from 'lucide-react';
import { UI } from './constants';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
  message: string | null;
  /** Remount key — bumping it gives the canvas a genuinely fresh start. */
  attempt: number;
}

export class GlobeErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, message: null, attempt: 0 };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    const message =
      error instanceof Error ? error.message : String(error ?? 'unknown error');
    return { failed: true, message: message.slice(0, 300) };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error('[OceanMind] Globe renderer failed:', error);
  }

  private retry = () => {
    this.setState((s) => ({ failed: false, message: null, attempt: s.attempt + 1 }));
  };

  render() {
    if (!this.state.failed) {
      // key forces a full remount on retry — same tree, clean slate.
      return <div key={this.state.attempt} style={{ position: 'absolute', inset: 0 }}>{this.props.children}</div>;
    }
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        <Globe2 size={28} style={{ color: UI.label, opacity: 0.7 }} />
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.2em',
            color: UI.label,
            textTransform: 'uppercase',
          }}
        >
          3D globe unavailable
        </span>
        <span style={{ fontSize: 11.5, color: UI.textMuted, maxWidth: 340, textAlign: 'center' }}>
          The globe renderer crashed. Signal filters, the briefing panel and
          the live ticker remain fully operational.
        </span>
        {this.state.message && (
          <code
            style={{
              fontSize: 10.5,
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              color: '#E2A23B',
              background: 'rgba(226, 162, 59, 0.08)',
              border: '1px solid rgba(226, 162, 59, 0.25)',
              borderRadius: 6,
              padding: '6px 10px',
              maxWidth: 420,
              textAlign: 'center',
              wordBreak: 'break-word',
            }}
          >
            {this.state.message}
          </code>
        )}
        <button
          onClick={this.retry}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 4,
            padding: '7px 14px',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: UI.text,
            background: 'rgba(45, 212, 191, 0.10)',
            border: '1px solid rgba(45, 212, 191, 0.35)',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={11} />
          Retry renderer
        </button>
      </div>
    );
  }
}
