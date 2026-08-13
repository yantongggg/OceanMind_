/**
 * Chokepoint markers + labels — a surface-tangent status ring at each of
 * the five strategic straits/canals plus a screen-space HTML label that is
 * hidden by drei's raycast occlusion when the chokepoint rotates behind
 * the globe.
 */

import { useEffect, useMemo } from 'react';
import type { RefObject } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { CHOKEPOINTS, CHOKEPOINT_STATUS_COLOR, hexAlpha } from './constants';
import type { ChokepointStatus } from './constants';
import { latLonToVec3, noRaycast } from './geo';

const Z_AXIS = new THREE.Vector3(0, 0, 1);

interface ChokepointLabelsProps {
  /** The globe sphere mesh — used as the HTML occluder. */
  globeRef: RefObject<THREE.Mesh | null>;
}

export function ChokepointLabels({ globeRef }: ChokepointLabelsProps) {
  const ringGeometry = useMemo(() => new THREE.RingGeometry(0.012, 0.0155, 40), []);
  const ringMaterials = useMemo(() => {
    const map = new Map<ChokepointStatus, THREE.MeshBasicMaterial>();
    (Object.keys(CHOKEPOINT_STATUS_COLOR) as ChokepointStatus[]).forEach((status) => {
      map.set(
        status,
        new THREE.MeshBasicMaterial({
          color: CHOKEPOINT_STATUS_COLOR[status],
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
    });
    return map;
  }, []);

  // Shared ring geometry/materials (consumed by dispose={null} meshes below)
  // are freed exactly once, when the label layer unmounts.
  useEffect(
    () => () => {
      ringGeometry.dispose();
      ringMaterials.forEach((m) => m.dispose());
    },
    [ringGeometry, ringMaterials],
  );

  const items = useMemo(
    () =>
      CHOKEPOINTS.map((cp) => ({
        cp,
        position: latLonToVec3(cp.lat, cp.lon, 1.006),
        quaternion: new THREE.Quaternion().setFromUnitVectors(
          Z_AXIS,
          latLonToVec3(cp.lat, cp.lon, 1).normalize(),
        ),
        color: CHOKEPOINT_STATUS_COLOR[cp.status],
      })),
    [],
  );

  return (
    <group>
      {items.map(({ cp, position, quaternion, color }) => (
        <group key={cp.name} position={position}>
          <mesh
            geometry={ringGeometry}
            material={ringMaterials.get(cp.status)}
            quaternion={quaternion}
            raycast={noRaycast}
            dispose={null}
          />
          <Html
            center
            occlude={[globeRef as unknown as RefObject<THREE.Object3D>]}
            zIndexRange={[20, 0]}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {/* A leader line to a quiet label, not a glowing tag.
             *
             * These are place names — permanent geography, true whether or not
             * anything is happening. They were rendered as bold, glowing,
             * wide-tracked uppercase, which read as alerts and collided with
             * each other wherever two chokepoints sit close (Suez against
             * Hormuz). Now they sit back: hairline tick, small mixed-case
             * type, no glow. Status shows in the tick and the ring, so a calm
             * strait is legible without being loud. */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                whiteSpace: 'nowrap',
                transform: 'translateY(-15px)',
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 500,
                  letterSpacing: '0.05em',
                  color: cp.status === 'watch' ? 'rgba(160, 184, 210, 0.62)' : color,
                  textShadow: '0 1px 8px rgba(2,8,16,0.9)',
                }}
              >
                {cp.name}
              </span>
              <span
                style={{
                  width: 1,
                  height: 7,
                  background: `linear-gradient(180deg, ${hexAlpha(color, 0.55)}, transparent)`,
                  marginTop: 2,
                }}
              />
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}
