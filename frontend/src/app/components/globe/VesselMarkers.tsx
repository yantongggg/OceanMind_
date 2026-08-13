/**
 * VesselMarkers — the fleet, sailing.
 *
 * Each voyage advances along its active route's waypoints, starting from the
 * progress its data reports. The motion is honest about what it is: a smooth
 * interpolation of a plan of record, not an AIS feed. It exists so the globe
 * reads as a living operation rather than a scatter plot — but it must never
 * out-shout the signals, which are the actual intelligence. Hence: small,
 * cool-grey, no pulse, no halo. Signals glow; ships just go.
 *
 * Movement is deliberately slow (a full route takes ~10 minutes of wall
 * clock). Fast enough to notice on a second glance, slow enough that nobody
 * watching a demo mistakes it for real-time telemetry.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Voyage } from '../../../data/types';
import { latLonToVec3, GLOBE_RADIUS, noRaycast } from './geo';
import { UI } from './constants';

const HULL_COLOR = '#9FC0E4';
const SELECTED_COLOR = UI.primary;
const HULL_SIZE = 0.011;
const ALTITUDE = GLOBE_RADIUS * 1.012;

/** Fraction of the route traversed per second. 1/600 → ~10 min end to end. */
const SPEED = 1 / 600;

/* Converging locator ring: a faint circle that shrinks onto each sailing
 * hull. It answers "where are my ships" at a glance without adding another
 * glow to the globe — small radius, low opacity, phase-staggered so the
 * fleet never pulses in unison like an alarm. */
const RING_PERIOD_S = 2.8;
const RING_START_SCALE = 3.2;   // × hull size, converging to 1
const RING_MAX_OPACITY = 0.28;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

interface Track {
  voyageId: string;
  /** Sampled positions along the active route, on the globe surface. */
  points: THREE.Vector3[];
  /** Starting offset from the voyage's reported progress, 0–1. */
  start: number;
}

function buildTrack(voyage: Voyage): Track | null {
  const route =
    voyage.routeOptions.find((r) => r.id === voyage.activeRouteId) ??
    voyage.routeOptions[0];
  if (!route?.waypoints?.length) return null;

  // waypoints are [lon, lat] pairs — the GeoJSON convention, not lat/lon.
  const points = route.waypoints.map(([lon, lat]) =>
    latLonToVec3(lat, lon, ALTITUDE),
  );
  if (points.length < 2) return null;

  return {
    voyageId: voyage.id,
    points,
    start: Math.min(0.999, Math.max(0, voyage.progressPct / 100)),
  };
}

/** Position at fraction t along a polyline, by linear interpolation between
 *  the two bracketing waypoints. Good enough: waypoints are dense, and the
 *  claim is "roughly here", not a fix. */
function pointAt(points: THREE.Vector3[], t: number, out: THREE.Vector3): void {
  const span = points.length - 1;
  const scaled = t * span;
  const i = Math.min(span - 1, Math.floor(scaled));
  out.copy(points[i]).lerp(points[i + 1], scaled - i);
}

interface Props {
  voyages: Voyage[];
  selectedVoyageId: string | null;
  /** Dim the fleet when the operator is reading a signal — ships are context
   *  then, not the subject. */
  dimmed: boolean;
  /** Click a hull to inspect its plan of record. Null clears. */
  onSelect?: (voyageId: string | null) => void;
}

export function VesselMarkers({ voyages, selectedVoyageId, dimmed, onSelect }: Props) {
  const tracks = useMemo(
    () => voyages.map(buildTrack).filter((t): t is Track => t !== null),
    [voyages],
  );

  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);
  const scratch = useMemo(() => new THREE.Vector3(), []);
  const scratchNormal = useMemo(() => new THREE.Vector3(), []);
  const scratchQuat = useMemo(() => new THREE.Quaternion(), []);

  /* One shared ring geometry; one material per vessel so opacity animates
   * independently. Owned here, disposed on unmount. */
  const ringGeometry = useMemo(() => new THREE.RingGeometry(0.86, 1, 28), []);
  const ringMaterials = useMemo(
    () =>
      tracks.map(
        () =>
          new THREE.MeshBasicMaterial({
            color: HULL_COLOR,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
      ),
    [tracks],
  );
  useEffect(
    () => () => {
      ringGeometry.dispose();
      ringMaterials.forEach((m) => m.dispose());
    },
    [ringGeometry, ringMaterials],
  );

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    for (let i = 0; i < tracks.length; i++) {
      const g = groupRefs.current[i];
      if (!g) continue;
      const track = tracks[i];
      // Wrap at the destination and sail again — the fleet is a loop, not a
      // simulation with an end state.
      const t = (track.start + elapsed * SPEED) % 1;
      pointAt(track.points, t, scratch);
      g.position.copy(scratch);

      // Locator ring: tangent to the surface, shrinking onto the hull, gone
      // entirely while the fleet is dimmed for a signal read.
      const ring = ringRefs.current[i];
      if (ring) {
        scratchNormal.copy(scratch).normalize();
        scratchQuat.setFromUnitVectors(Z_AXIS, scratchNormal);
        ring.quaternion.copy(scratchQuat);
        const phase = (elapsed / RING_PERIOD_S + i * 0.31) % 1;
        ring.scale.setScalar(
          HULL_SIZE * (RING_START_SCALE - (RING_START_SCALE - 1) * phase),
        );
        ringMaterials[i].opacity = dimmed
          ? 0
          : RING_MAX_OPACITY * Math.sin(Math.PI * phase);
      }
    }
  });

  return (
    <group>
      {tracks.map((track, i) => {
        const selected = track.voyageId === selectedVoyageId;
        return (
          <group
            key={track.voyageId}
            ref={(el) => {
              groupRefs.current[i] = el;
            }}
          >
            {/* Generous invisible hit area — a 0.011-unit hull is a few
                pixels at default zoom and effectively unclickable. */}
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(selected ? null : track.voyageId);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'auto';
              }}
            >
              <sphereGeometry args={[HULL_SIZE * 3.2, 8, 8]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            <mesh raycast={noRaycast}>
              <sphereGeometry args={[selected ? HULL_SIZE * 1.5 : HULL_SIZE, 8, 8]} />
              <meshBasicMaterial
                color={selected ? SELECTED_COLOR : HULL_COLOR}
                transparent
                opacity={dimmed && !selected ? 0.25 : selected ? 1 : 0.75}
                depthWrite={false}
              />
            </mesh>
            <mesh
              ref={(el) => {
                ringRefs.current[i] = el;
              }}
              geometry={ringGeometry}
              material={ringMaterials[i]}
              raycast={noRaycast}
              dispose={null}
            />
          </group>
        );
      })}
    </group>
  );
}
