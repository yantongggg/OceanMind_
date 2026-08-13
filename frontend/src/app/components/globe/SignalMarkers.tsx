/**
 * Signal markers — one pulsing point of light per captured signal.
 *
 * Core dot (shared geometry, one material per category) + additive glow
 * sprite pulsing at a severity-scaled rate + an oversized invisible hit
 * target so small markers are easy to click. All animation happens by
 * mutating existing objects inside useFrame — zero per-frame allocations.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import type { Signal, SignalCategory } from '../../../data/types';
import { CATEGORY_META, SEVERITY_META, ALL_CATEGORIES } from './constants';
import { latLonToVec3, getGlowTexture, GLOBE_RADIUS } from './geo';

interface MarkerDatum {
  signal: Signal;
  position: THREE.Vector3;
  size: number;
  color: string;
  phase: number;
  pulse: number;
}

interface SignalMarkersProps {
  signals: Signal[];
  selectedId: string | null;
  onSelect: (signal: Signal) => void;
}

export function SignalMarkers({ signals, selectedId, onSelect }: SignalMarkersProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  useCursor(hoveredId !== null);

  /* Shared resources — created once. */
  const coreGeometry = useMemo(() => new THREE.SphereGeometry(1, 16, 16), []);
  const coreMaterials = useMemo(() => {
    const map = new Map<SignalCategory, THREE.MeshBasicMaterial>();
    for (const cat of ALL_CATEGORIES) {
      map.set(cat, new THREE.MeshBasicMaterial({ color: CATEGORY_META[cat].color }));
    }
    return map;
  }, []);
  const hitMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    [],
  );
  const glowTexture = useMemo(() => getGlowTexture(), []);

  // Shared resources are consumed by many meshes (which carry dispose={null}
  // so r3f never disposes them mid-session on filter changes); free the GPU
  // buffers exactly once, when the whole marker layer unmounts.
  useEffect(
    () => () => {
      coreGeometry.dispose();
      coreMaterials.forEach((m) => m.dispose());
      hitMaterial.dispose();
    },
    [coreGeometry, coreMaterials, hitMaterial],
  );

  const markers = useMemo<MarkerDatum[]>(
    () =>
      signals.map((signal, i) => ({
        signal,
        position: latLonToVec3(signal.lat, signal.lon, GLOBE_RADIUS * 1.008),
        size: SEVERITY_META[signal.severity].size,
        color: CATEGORY_META[signal.category].color,
        phase: (i * 1.7) % (Math.PI * 2),
        pulse: SEVERITY_META[signal.severity].pulse,
      })),
    [signals],
  );

  /* Halo sprites keyed by signal id, mutated per frame. */
  const spriteRefs = useRef(new Map<string, THREE.Sprite>());

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    for (const m of markers) {
      const sprite = spriteRefs.current.get(m.signal.id);
      if (!sprite) continue;
      const active = m.signal.id === selectedId || m.signal.id === hoveredId;
      const wave = Math.sin(t * m.pulse + m.phase);
      const material = sprite.material as THREE.SpriteMaterial;
      material.opacity = (active ? 0.9 : 0.42) + 0.22 * wave;
      sprite.scale.setScalar(m.size * (active ? 7.5 : 5.2) * (1 + 0.16 * wave));
    }
  });

  return (
    <group>
      {markers.map((m) => (
        <group key={m.signal.id} position={m.position}>
          {/* core dot */}
          <mesh
            geometry={coreGeometry}
            material={coreMaterials.get(m.signal.category)}
            scale={m.size}
            dispose={null}
          />
          {/* pulsing additive halo */}
          <sprite
            scale={m.size * 5.2}
            ref={(el: THREE.Sprite | null) => {
              if (el) spriteRefs.current.set(m.signal.id, el);
              else spriteRefs.current.delete(m.signal.id);
            }}
          >
            <spriteMaterial
              map={glowTexture}
              color={m.color}
              transparent
              opacity={0.5}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
          {/* generous invisible hit target */}
          <mesh
            geometry={coreGeometry}
            material={hitMaterial}
            scale={Math.max(m.size * 2.6, 0.03)}
            dispose={null}
            onClick={(e) => {
              if (e.delta > 8) return; // was a drag, not a click
              e.stopPropagation();
              onSelect(m.signal);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredId(m.signal.id);
            }}
            onPointerOut={() => {
              setHoveredId((prev) => (prev === m.signal.id ? null : prev));
            }}
          />
        </group>
      ))}
    </group>
  );
}

/** Rotating reticle ring drawn around the selected signal. */
export function SelectionRing({ signal }: { signal: Signal | null }) {
  const ref = useRef<THREE.Mesh>(null);

  const placement = useMemo(() => {
    if (!signal) return null;
    const normal = latLonToVec3(signal.lat, signal.lon, 1).normalize();
    return {
      position: latLonToVec3(signal.lat, signal.lon, GLOBE_RADIUS * 1.012),
      quaternion: new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        normal,
      ),
    };
  }, [signal]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.scale.setScalar(1 + 0.1 * Math.sin(t * 2.4));
    ref.current.rotation.z = t * 0.6;
  });

  if (!placement || !signal) return null;
  return (
    <mesh ref={ref} position={placement.position} quaternion={placement.quaternion}>
      <ringGeometry args={[0.034, 0.0375, 48]} />
      <meshBasicMaterial
        color="#EAF4FF"
        transparent
        opacity={0.85}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}
