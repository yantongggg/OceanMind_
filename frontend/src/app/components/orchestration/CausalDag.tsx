import { useMemo, useState } from 'react';
import { Zap, MapPin, Anchor, Route as RouteIcon, Ship, Target, GitBranch } from 'lucide-react';
import type { CausalNode, CausalNodeKind, Severity } from '../../../data/types';
import { mockCausalGraph } from '../../../data/mock';

/**
 * CausalDag — layered root-cause graph for the golden scenario
 * (event → chokepoint/port → route → voyage → quantified impact).
 * Hover a node to highlight every causal path through it; everything
 * else dims. Node detail renders in the strip below the canvas.
 */

const W = 1320;
const H = 430;
const NODE_W = 176;
const NODE_HALF_H = 33;

const KIND_ICON: Record<CausalNodeKind, typeof Zap> = {
  event: Zap,
  chokepoint: MapPin,
  port: Anchor,
  route: RouteIcon,
  voyage: Ship,
  impact: Target,
};

const SEVERITY_COLOR: Record<Severity, string> = {
  low: '#34D399',
  medium: '#38BDF8',
  high: '#E8A043',
  critical: '#C75A5A',
};

interface Layout {
  pos: Record<string, { x: number; y: number }>;
  maxLayer: number;
}

function computeLayout(): Layout {
  const { nodes, edges } = mockCausalGraph;
  const layer: Record<string, number> = {};
  nodes.forEach((n) => (layer[n.id] = 0));
  // longest-path layering (graph is a small DAG — relax |V| times)
  for (let i = 0; i < nodes.length; i++) {
    let changed = false;
    for (const e of edges) {
      if (layer[e.source] === undefined || layer[e.target] === undefined) continue;
      if (layer[e.target] < layer[e.source] + 1) {
        layer[e.target] = layer[e.source] + 1;
        changed = true;
      }
    }
    if (!changed) break;
  }
  const maxLayer = Math.max(...Object.values(layer), 0);
  const colX = (l: number) => 100 + (maxLayer > 0 ? (l * (W - 200)) / maxLayer : 0);

  const byLayer: Record<number, CausalNode[]> = {};
  nodes.forEach((n) => {
    (byLayer[layer[n.id]] ??= []).push(n);
  });

  const pos: Record<string, { x: number; y: number }> = {};
  Object.entries(byLayer).forEach(([l, group]) => {
    group.forEach((n, i) => {
      pos[n.id] = {
        x: colX(Number(l)),
        y: H / 2 + (i - (group.length - 1) / 2) * 138,
      };
    });
  });
  return { pos, maxLayer };
}

export function CausalDag() {
  const { nodes, edges } = mockCausalGraph;
  const { pos } = useMemo(computeLayout, []);
  const [hovered, setHovered] = useState<string | null>(null);

  /** Ancestor + descendant sets of the hovered node. */
  const highlight = useMemo(() => {
    if (!hovered) return null;
    const up = new Set<string>();
    const down = new Set<string>();
    const walk = (start: string, set: Set<string>, dir: 'up' | 'down') => {
      const queue = [start];
      while (queue.length) {
        const id = queue.pop()!;
        for (const e of edges) {
          const next = dir === 'up' ? (e.target === id ? e.source : null) : e.source === id ? e.target : null;
          if (next && !set.has(next)) {
            set.add(next);
            queue.push(next);
          }
        }
      }
    };
    walk(hovered, up, 'up');
    walk(hovered, down, 'down');
    const nodeSet = new Set<string>([hovered, ...up, ...down]);
    const edgeSet = new Set<string>();
    for (const e of edges) {
      const onUpPath = (up.has(e.target) || e.target === hovered) && up.has(e.source);
      const onDownPath = (down.has(e.source) || e.source === hovered) && down.has(e.target);
      if (onUpPath || onDownPath) edgeSet.add(e.id);
    }
    return { nodeSet, edgeSet };
  }, [hovered, edges]);

  const hoveredNode = hovered ? nodes.find((n) => n.id === hovered) : null;

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, #102033 0%, #0E1C2D 100%)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <GitBranch size={13} style={{ color: '#A78BFA' }} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#EAF4FF' }}>Causal Root-Cause Graph</div>
          <div style={{ fontSize: 9, color: '#5A8AB4', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            DSR-001 → DEC-0042 · hover a node to trace causal paths
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
          {(Object.keys(SEVERITY_COLOR) as Severity[]).map((s) => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, color: '#8BA8C8' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: SEVERITY_COLOR[s] }} />
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ position: 'relative', width: W, height: H }}>
          <svg width={W} height={H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {edges.map((e) => {
              const s = pos[e.source];
              const t = pos[e.target];
              if (!s || !t) return null;
              const sx = s.x + NODE_W / 2 + 4;
              const tx = t.x - NODE_W / 2 - 4;
              const span = Math.abs(t.x - s.x) / ((W - 200) / 5 || 1);
              const bow = span > 1.5 ? (s.y >= H / 2 ? 82 : -82) : 0;
              const c = Math.max(34, (tx - sx) * 0.45);
              const c1y = s.y + bow;
              const c2y = t.y + bow;
              const d = `M ${sx} ${s.y} C ${sx + c} ${c1y}, ${tx - c} ${c2y}, ${tx} ${t.y}`;
              // exact bezier midpoint
              const mx = (sx + 3 * (sx + c) + 3 * (tx - c) + tx) / 8;
              const my = (s.y + 3 * c1y + 3 * c2y + t.y) / 8;
              const active = highlight ? highlight.edgeSet.has(e.id) : true;
              const stroke = active && highlight ? '#A78BFA' : 'rgba(139,168,200,0.9)';
              return (
                <g key={e.id} style={{ opacity: active ? (highlight ? 0.95 : 0.5) : 0.12, transition: 'opacity 200ms' }}>
                  <path d={d} fill="none" stroke={stroke} strokeOpacity={highlight && active ? 0.8 : 0.4} strokeWidth={highlight && active ? 1.8 : 1.1} />
                  {/* arrowhead */}
                  <path
                    d={`M ${tx} ${t.y} l -7 -3.6 l 0 7.2 z`}
                    fill={stroke}
                    fillOpacity={highlight && active ? 0.9 : 0.5}
                  />
                  <text
                    x={mx}
                    y={my - 6}
                    textAnchor="middle"
                    style={{
                      fontSize: 8.5,
                      fill: highlight && active ? '#CBB7FA' : '#7FA5D3',
                      paintOrder: 'stroke',
                      stroke: '#0C1929',
                      strokeWidth: 3,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {e.label} · {e.confidence.toFixed(2)}
                  </text>
                </g>
              );
            })}
          </svg>

          {nodes.map((n) => {
            const p = pos[n.id];
            if (!p) return null;
            const Icon = KIND_ICON[n.kind];
            const color = SEVERITY_COLOR[n.severity];
            const dimmed = highlight ? !highlight.nodeSet.has(n.id) : false;
            const isHover = hovered === n.id;
            return (
              <div
                key={n.id}
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  position: 'absolute',
                  left: p.x,
                  top: p.y,
                  transform: 'translate(-50%, -50%)',
                  width: NODE_W,
                  minHeight: NODE_HALF_H * 2,
                  borderRadius: 10,
                  padding: '8px 10px',
                  background: isHover
                    ? 'linear-gradient(180deg, rgba(20,38,60,0.99), rgba(16,32,51,0.99))'
                    : 'linear-gradient(180deg, rgba(13,26,42,0.97), rgba(11,23,37,0.97))',
                  border: `1px solid ${isHover ? color : `${color}55`}`,
                  borderLeft: `3px solid ${color}`,
                  boxShadow: isHover ? `0 0 18px ${color}33, 0 4px 14px rgba(0,0,0,0.5)` : '0 3px 10px rgba(0,0,0,0.4)',
                  opacity: dimmed ? 0.22 : 1,
                  transition: 'opacity 200ms, box-shadow 200ms, border-color 200ms',
                  cursor: 'default',
                  zIndex: isHover ? 3 : 2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon size={11} style={{ color, flexShrink: 0 }} />
                  <span
                    style={{
                      fontSize: 8.5,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      fontWeight: 700,
                      color: `${color}DD`,
                    }}
                  >
                    {n.kind}
                  </span>
                  {n.refId && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: 8,
                        color: '#5A8AB4',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {n.refId}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#EAF4FF', lineHeight: 1.3 }}>{n.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail strip */}
      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.07)',
          padding: '10px 18px',
          minHeight: 58,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {hoveredNode ? (
          <>
            <span
              style={{
                flexShrink: 0,
                padding: '2px 8px',
                borderRadius: 5,
                fontSize: 9,
                fontWeight: 800,
                fontFamily: "'JetBrains Mono', monospace",
                color: SEVERITY_COLOR[hoveredNode.severity],
                background: `${SEVERITY_COLOR[hoveredNode.severity]}16`,
                border: `1px solid ${SEVERITY_COLOR[hoveredNode.severity]}40`,
              }}
            >
              {hoveredNode.id}
            </span>
            <div style={{ fontSize: 11, color: '#BFD7F7', lineHeight: 1.5 }}>
              <span style={{ fontWeight: 700, color: '#EAF4FF' }}>{hoveredNode.label} — </span>
              {hoveredNode.detail}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 10.5, color: '#5A8AB4' }}>
            Single root cause traced: the Bab el-Mandeb escalation explains 100% of the plan-of-record risk
            delta across {nodes.length} nodes and {edges.length} causal edges. Hover any node for detail.
          </div>
        )}
      </div>
    </div>
  );
}
