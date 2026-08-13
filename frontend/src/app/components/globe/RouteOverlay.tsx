/**
 * RouteOverlay — the two routes under consideration, and nothing else.
 *
 * Drawn only while a voyage is selected from the impact panel. The whole
 * point is a single comparison an operator can make in one look:
 *
 *   current plan  — solid, muted. What the ship is doing now.
 *   suggested     — teal, animated dashes flowing toward the destination.
 *                   What the assessment proposes instead.
 *
 * Two lines, two weights, one accent colour. Deliberately not a map: no
 * labels, no waypoint dots, no distance annotations along the path. Those
 * numbers live in the panel, where they can be read; on the globe they would
 * be noise over a rotating sphere. The geometry answers "where does it go",
 * the panel answers "what does it cost".
 *
 * If the assessment has no alternative to offer, only the current route
 * draws — an absence the operator should see, not one we paper over with a
 * speculative line.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import type { RouteOption } from '../../../data/types';
import { greatCircleArc, GLOBE_RADIUS } from './geo';
import { UI } from './constants';

const CURRENT_COLOR = '#8BA8C8';
const SUGGESTED_COLOR = UI.primary;

/** Lift routes just clear of the surface so they don't z-fight the land dots,
 *  and put the suggestion fractionally above the current plan so crossings
 *  read cleanly. */
const CURRENT_ALT = GLOBE_RADIUS * 1.004;
const SUGGESTED_ALT = GLOBE_RADIUS * 1.009;

type LineObject = THREE.Line & { material: THREE.LineDashedMaterial & { dashOffset: number } };

/** Chain waypoints into one polyline of great-circle hops. Straight segments
 *  between [lon, lat] pairs would cut through the sphere on long legs. */
function toPolyline(route: RouteOption, altitude: number): THREE.Vector3[] {
  const wp = route.waypoints;
  if (!wp || wp.length < 2) return [];
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < wp.length - 1; i++) {
    const hop = greatCircleArc(
      [wp[i][1], wp[i][0]],
      [wp[i + 1][1], wp[i + 1][0]],
      altitude,
      24,
    );
    points.push(...(i === 0 ? hop : hop.slice(1)));
  }
  return points;
}

interface Props {
  currentRoute: RouteOption | null;
  suggestedRoute: RouteOption | null;
}

export function RouteOverlay({ currentRoute, suggestedRoute }: Props) {
  const current = useMemo(
    () => (currentRoute ? toPolyline(currentRoute, CURRENT_ALT) : []),
    [currentRoute],
  );
  const suggested = useMemo(
    () => (suggestedRoute ? toPolyline(suggestedRoute, SUGGESTED_ALT) : []),
    [suggestedRoute],
  );

  const suggestedRef = useRef<LineObject | null>(null);

  useFrame((_, delta) => {
    // Dashes crawl toward the destination — the only motion here, and it
    // reads as direction rather than urgency.
    const line = suggestedRef.current;
    if (line) line.material.dashOffset -= delta * 0.06;
  });

  return (
    <group>
      {current.length > 1 && (
        <Line
          points={current}
          color={CURRENT_COLOR}
          lineWidth={1.2}
          transparent
          opacity={0.45}
          depthWrite={false}
        />
      )}
      {suggested.length > 1 && (
        <Line
          ref={suggestedRef as never}
          points={suggested}
          color={SUGGESTED_COLOR}
          lineWidth={1.8}
          transparent
          opacity={0.9}
          dashed
          dashScale={90}
          dashSize={2}
          gapSize={1.4}
          depthWrite={false}
        />
      )}
    </group>
  );
}
