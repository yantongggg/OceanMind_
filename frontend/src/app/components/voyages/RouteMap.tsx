/**
 * RouteMap — offline SVG world-projection route map.
 *
 * Deliberately dependency-free (no maplibre, no tiles, no API keys): an
 * equirectangular projection fitted to the voyage's route options, drawn
 * over embedded Natural Earth 110m coastlines. Reliability beats fancy —
 * this renders identically with zero network access.
 */

import { useMemo, useState } from 'react';
import type { Voyage } from '../../../data/types';
import { LAND_RINGS } from './landRings';
import type { MapFrame } from './geo';
import {
  CHOKEPOINTS,
  alignLon,
  buildFrame,
  linePath,
  projX,
  projY,
  routeVisual,
  unwrapLine,
} from './geo';

const OCEAN = '#050E1A';
const LAND_FILL = '#0D1B2C';
const LAND_STROKE = 'rgba(93, 138, 180, 0.35)';
const GRID = 'rgba(45, 212, 191, 0.05)';

/* Pre-compute each land ring's bbox once (module scope). */
interface Ring {
  pts: number[];
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}
const RINGS: Ring[] = LAND_RINGS.map((pts) => {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    if (pts[i] < minLon) minLon = pts[i];
    if (pts[i] > maxLon) maxLon = pts[i];
    if (pts[i + 1] < minLat) minLat = pts[i + 1];
    if (pts[i + 1] > maxLat) maxLat = pts[i + 1];
  }
  return { pts, minLon, maxLon, minLat, maxLat };
});

function landPath(frame: MapFrame): string {
  const parts: string[] = [];
  // Draw world copies at −360 / 0 / +360 so antimeridian-unwrapped frames
  // (Pacific routes) still see land on both sides.
  for (const offset of [-360, 0, 360]) {
    for (const ring of RINGS) {
      if (ring.maxLon + offset < frame.minLon || ring.minLon + offset > frame.maxLon) continue;
      if (ring.maxLat < frame.minLat || ring.minLat > frame.maxLat) continue;
      const pts = ring.pts;
      let d = `M${projX(frame, pts[0] + offset).toFixed(1)} ${projY(frame, pts[1]).toFixed(1)}`;
      for (let i = 2; i < pts.length; i += 2) {
        d += `L${projX(frame, pts[i] + offset).toFixed(1)} ${projY(frame, pts[i + 1]).toFixed(1)}`;
      }
      parts.push(d + 'Z');
    }
  }
  return parts.join('');
}

function graticule(frame: MapFrame, stepDeg = 15): string {
  const parts: string[] = [];
  const lonStart = Math.ceil(frame.minLon / stepDeg) * stepDeg;
  for (let lon = lonStart; lon <= frame.maxLon; lon += stepDeg) {
    parts.push(`M${projX(frame, lon).toFixed(1)} 0V${frame.height.toFixed(1)}`);
  }
  const latStart = Math.ceil(frame.minLat / stepDeg) * stepDeg;
  for (let lat = latStart; lat <= frame.maxLat; lat += stepDeg) {
    parts.push(`M0 ${projY(frame, lat).toFixed(1)}H${frame.width.toFixed(1)}`);
  }
  return parts.join('');
}

interface RouteMapProps {
  voyage: Voyage;
  selectedRouteId: string;
  onSelectRoute?: (routeId: string) => void;
  /** CSS height of the map container (default 460px). */
  height?: number;
}

export function RouteMap({ voyage, selectedRouteId, onSelectRoute, height = 460 }: RouteMapProps) {
  const [hoverId, setHoverId] = useState<string | null>(null);

  const frame = useMemo(() => buildFrame(voyage), [voyage]);
  const land = useMemo(() => landPath(frame), [frame]);
  const grid = useMemo(() => graticule(frame), [frame]);

  const routes = useMemo(
    () =>
      voyage.routeOptions.map((route) => ({
        route,
        visual: routeVisual(route, voyage),
        d: linePath(frame, unwrapLine(route.waypoints)),
      })),
    [voyage, frame],
  );

  // Chokepoints across every option, deduped, aligned into the frame.
  const chokepoints = useMemo(() => {
    const names = new Set<string>();
    voyage.routeOptions.forEach((r) => r.viaChokepoints.forEach((c) => names.add(c)));
    return [...names]
      .filter((name) => CHOKEPOINTS[name])
      .map((name) => {
        const [lon, lat] = CHOKEPOINTS[name];
        return { name, x: projX(frame, alignLon(lon, frame.minLon, frame.maxLon)), y: projY(frame, lat) };
      });
  }, [voyage, frame]);

  const ox = projX(frame, alignLon(voyage.originLon, frame.minLon, frame.maxLon));
  const oy = projY(frame, voyage.originLat);
  const dx = projX(frame, alignLon(voyage.destinationLon, frame.minLon, frame.maxLon));
  const dy = projY(frame, voyage.destinationLat);
  const vx = projX(frame, alignLon(voyage.currentLon, frame.minLon, frame.maxLon));
  const vy = projY(frame, voyage.currentLat);

  // Scale SVG-unit sizes so markers look the same regardless of frame height.
  const u = frame.width / 1000;

  const ordered = [...routes].sort((a, b) => {
    const rank = (id: string) => (id === selectedRouteId ? 2 : id === hoverId ? 1 : 0);
    return rank(a.route.id) - rank(b.route.id);
  });

  return (
    <div
      style={{
        position: 'relative',
        background: OCEAN,
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
        height,
      }}
    >
      <svg
        viewBox={`0 0 ${frame.width} ${frame.height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        role="img"
        aria-label={`Route map for ${voyage.id}: ${voyage.originPort} to ${voyage.destinationPort}`}
      >
        {/* Ocean + graticule + land */}
        <rect x={0} y={0} width={frame.width} height={frame.height} fill={OCEAN} />
        <path d={grid} stroke={GRID} strokeWidth={1 * u} fill="none" />
        <path d={land} fill={LAND_FILL} stroke={LAND_STROKE} strokeWidth={1.1 * u} strokeLinejoin="round" />

        {/* Routes (selected / hovered drawn last) */}
        {ordered.map(({ route, visual, d }) => {
          const isSelected = route.id === selectedRouteId;
          const isHover = route.id === hoverId;
          return (
            <g key={route.id}>
              <path
                d={d}
                fill="none"
                stroke={visual.color}
                strokeWidth={(isSelected ? 4 : isHover ? 3.2 : 2.2) * u}
                strokeDasharray={visual.dash ? visual.dash.split(' ').map((n) => Number(n) * u).join(' ') : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={isSelected ? 1 : isHover ? 0.9 : visual.role === 'alternative' ? 0.55 : 0.75}
                style={{ transition: 'opacity 200ms ease, stroke-width 200ms ease' }}
              />
              {/* generous invisible hit area */}
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={14 * u}
                style={{ cursor: onSelectRoute ? 'pointer' : 'default' }}
                onClick={() => onSelectRoute?.(route.id)}
                onMouseEnter={() => setHoverId(route.id)}
                onMouseLeave={() => setHoverId(null)}
              >
                <title>{route.label}</title>
              </path>
            </g>
          );
        })}

        {/* Chokepoints */}
        {chokepoints.map((cp) => (
          <g key={cp.name} transform={`translate(${cp.x} ${cp.y})`}>
            <rect
              x={-4 * u}
              y={-4 * u}
              width={8 * u}
              height={8 * u}
              transform="rotate(45)"
              fill="#0A1626"
              stroke="#E8A043"
              strokeWidth={1.4 * u}
            />
            <text
              x={0}
              y={-9 * u}
              textAnchor="middle"
              fontSize={11 * u}
              fontFamily="'JetBrains Mono', monospace"
              fill="#C89A5C"
              letterSpacing={0.6 * u}
              style={{ textTransform: 'uppercase' }}
            >
              {cp.name}
            </text>
            <title>{`Chokepoint — ${cp.name}`}</title>
          </g>
        ))}

        {/* Origin */}
        <g transform={`translate(${ox} ${oy})`}>
          <circle r={5 * u} fill="#050E1A" stroke="#8BA8C8" strokeWidth={1.6 * u} />
          <circle r={1.8 * u} fill="#8BA8C8" />
          <text x={0} y={16 * u} textAnchor="middle" fontSize={12 * u} fontWeight={600} fill="#BFD7F7">
            {voyage.originPort}
          </text>
        </g>

        {/* Destination */}
        <g transform={`translate(${dx} ${dy})`}>
          <circle r={6.5 * u} fill="none" stroke="#2DD4BF" strokeWidth={1.4 * u} opacity={0.6} />
          <circle r={3 * u} fill="#2DD4BF" />
          <text x={0} y={-11 * u} textAnchor="middle" fontSize={12 * u} fontWeight={600} fill="#BFD7F7">
            {voyage.destinationPort}
          </text>
        </g>

        {/* Live vessel position */}
        <g transform={`translate(${vx} ${vy})`}>
          <circle r={6 * u} fill="rgba(45,212,191,0.25)">
            <animate attributeName="r" values={`${6 * u};${16 * u};${6 * u}`} dur="2.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0;0.5" dur="2.6s" repeatCount="indefinite" />
          </circle>
          <circle r={5.5 * u} fill="#0A1626" stroke="#2DD4BF" strokeWidth={1.8 * u} />
          <circle r={2.2 * u} fill="#5EEAD4" />
          <text
            x={0}
            y={20 * u}
            textAnchor="middle"
            fontSize={11 * u}
            fontFamily="'JetBrains Mono', monospace"
            fill="#5EEAD4"
            letterSpacing={0.8 * u}
          >
            {voyage.vessel.name.replace(/^MV\s+/, '').toUpperCase()} · {voyage.progressPct}%
          </text>
          <title>{`${voyage.vessel.name} — live AIS position (${voyage.progressPct}% of route)`}</title>
        </g>
      </svg>

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          padding: '10px 12px',
          background: 'rgba(7,17,29,0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 10,
          maxWidth: 300,
        }}
      >
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#5A8AB4',
            marginBottom: 2,
          }}
        >
          Route options
        </div>
        {routes.map(({ route, visual }) => {
          const isSelected = route.id === selectedRouteId;
          return (
            <button
              key={route.id}
              onClick={() => onSelectRoute?.(route.id)}
              onMouseEnter={() => setHoverId(route.id)}
              onMouseLeave={() => setHoverId(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: isSelected ? 'rgba(45,212,191,0.08)' : 'transparent',
                border: '1px solid ' + (isSelected ? 'rgba(45,212,191,0.25)' : 'transparent'),
                borderRadius: 6,
                padding: '3px 6px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <svg width={22} height={6} style={{ flexShrink: 0 }}>
                <line
                  x1={1}
                  y1={3}
                  x2={21}
                  y2={3}
                  stroke={visual.color}
                  strokeWidth={2.5}
                  strokeDasharray={visual.dash}
                  strokeLinecap="round"
                />
              </svg>
              <span
                style={{
                  fontSize: 11,
                  color: isSelected ? '#EAF4FF' : '#8BA8C8',
                  fontWeight: isSelected ? 600 : 400,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {route.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Attribution / mode caption */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          right: 12,
          fontSize: 9,
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.08em',
          color: 'rgba(139,168,200,0.55)',
        }}
      >
        EQUIRECTANGULAR · NATURAL EARTH · OFFLINE
      </div>
    </div>
  );
}
