/**
 * FlyTo — swings the camera around to a lat/lon and holds there.
 *
 * Rotates the camera about the globe's centre rather than translating it, so
 * the sphere never appears to drift: the operator's mental model is "the
 * globe turned", which is what a rotating-earth display should feel like.
 * Distance to centre is preserved, so a user who has zoomed in stays zoomed.
 *
 * Eased and slow enough (~1.1s) to keep orientation. A cut would save time and
 * cost the viewer any sense of where they just went — on a sphere, that
 * matters more than on a map.
 */

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { latLonToVec3 } from './geo';

const DURATION_S = 1.1;

/** easeInOutCubic — settles rather than stops. */
function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

interface Props {
  /** Target position, or null to leave the camera alone. */
  target: { lat: number; lon: number } | null;
}

export function FlyTo({ target }: Props) {
  const { camera } = useThree();
  const from = useRef(new THREE.Vector3());
  const to = useRef(new THREE.Vector3());
  const elapsed = useRef(0);
  const active = useRef(false);
  const axis = useRef(new THREE.Vector3());
  const angle = useRef(0);

  useEffect(() => {
    if (!target) {
      active.current = false;
      return;
    }
    const radius = camera.position.length();
    from.current.copy(camera.position);
    to.current.copy(latLonToVec3(target.lat, target.lon, radius));

    // Rotate along the great circle between the two camera positions. Lerping
    // the vectors directly would dive the camera toward the globe's centre on
    // near-antipodal moves and clip through the surface.
    const a = from.current.clone().normalize();
    const b = to.current.clone().normalize();
    angle.current = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
    axis.current.crossVectors(a, b);

    if (axis.current.lengthSq() < 1e-8 || angle.current < 1e-4) {
      // Already there, or exactly antipodal (no unique arc) — skip the move.
      active.current = false;
      return;
    }
    axis.current.normalize();
    elapsed.current = 0;
    active.current = true;
  }, [target, camera]);

  useFrame((_, delta) => {
    if (!active.current) return;
    elapsed.current += delta;
    const t = Math.min(1, elapsed.current / DURATION_S);
    camera.position
      .copy(from.current)
      .applyAxisAngle(axis.current, angle.current * ease(t));
    camera.lookAt(0, 0, 0);
    if (t >= 1) active.current = false;
  });

  return null;
}
