/**
 * Shipping-lane arcs — great-circle curves between major ports rendered as
 * animated dashed Line2 strips (drei <Line>). The dash offset advances each
 * frame so cargo appears to flow along the lane. The golden-scenario lanes
 * are highlighted: Suez baseline = disrupted red, Cape reroute = emerald.
 */

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { SHIPPING_LANES, LANE_STATUS_COLOR, LANE_STATUS_OPACITY } from './constants';
import { greatCircleArc, GLOBE_RADIUS } from './geo';

/** Structural type for the bit of LineMaterial we animate. */
interface DashedLineObject {
  material: { dashOffset: number };
}

export function LaneArcs() {
  const lanes = useMemo(
    () =>
      SHIPPING_LANES.map((lane) => {
        // Chain consecutive waypoints into one continuous polyline.
        const points: THREE.Vector3[] = [];
        for (let i = 0; i < lane.waypoints.length - 1; i++) {
          const hop = greatCircleArc(
            lane.waypoints[i],
            lane.waypoints[i + 1],
            GLOBE_RADIUS,
            48,
          );
          points.push(...(i === 0 ? hop : hop.slice(1)));
        }
        return {
          lane,
          points,
          color: LANE_STATUS_COLOR[lane.status],
          opacity: LANE_STATUS_OPACITY[lane.status],
          width: lane.status === 'active' ? 1.1 : 1.7,
          speed: lane.status === 'active' ? 0.045 : 0.09,
        };
      }),
    [],
  );

  const lineRefs = useRef<Array<DashedLineObject | null>>([]);

  useFrame((_, delta) => {
    for (let i = 0; i < lanes.length; i++) {
      const line = lineRefs.current[i];
      if (line) line.material.dashOffset -= delta * lanes[i].speed;
    }
  });

  return (
    <group>
      {lanes.map((l, i) => (
        <Line
          key={l.lane.id}
          ref={(el: unknown) => {
            lineRefs.current[i] = el as DashedLineObject | null;
          }}
          points={l.points}
          color={l.color}
          lineWidth={l.width}
          dashed
          dashSize={0.03}
          gapSize={0.022}
          transparent
          opacity={l.opacity}
          depthWrite={false}
        />
      ))}
    </group>
  );
}
