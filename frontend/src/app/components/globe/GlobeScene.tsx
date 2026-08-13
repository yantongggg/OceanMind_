/**
 * GlobeScene — the WebGL intelligence globe.
 *
 * NASA Blue Marble photo texture with topographic relief (both local files in
 * public/textures/ — never a runtime CDN), overlaid with signal markers,
 * chokepoint labels, the sailing fleet and on-demand route comparisons. If
 * the textures fail to load, the original procedural look (dark sphere +
 * land dot-matrix from GeoJSON) is the fallback, so the globe never renders
 * blank.
 *
 * Rotation etiquette: any touch stops the spin; it resumes only after 30
 * idle seconds, and never while a signal or voyage is under inspection. A
 * globe that turns while someone is reading it is fighting its operator.
 *
 * Performance: every geometry is memoised, total draw points stay well
 * under 60k, and all animation mutates existing objects (no per-frame
 * allocations).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { Signal, Voyage, AffectedVoyage } from '../../../data/types';
import {
  latLonToVec3,
  subsolarPoint,
  geoToSegmentPositions,
  landDotPositions,
  getDotTexture,
  noRaycast,
  GLOBE_RADIUS,
} from './geo';
import type { GeoFeatureCollection } from './geo';
import { PORTS } from './constants';
import { SignalMarkers, SelectionRing } from './SignalMarkers';
import { ChokepointLabels } from './ChokepointLabels';
import { VesselMarkers } from './VesselMarkers';
import { RouteOverlay } from './RouteOverlay';
import { FlyTo } from './FlyTo';

/* Initial view: Indian Ocean between Malacca and Bab el-Mandeb — the
 * golden-scenario theatre — facing the camera on load. */
const INITIAL_CAMERA = latLonToVec3(16, 64, 2.95);

/* Idle time before the globe resumes its slow spin after being touched. */
const RESUME_SPIN_AFTER_MS = 30_000;

/* The sun drifts 15°/hour; re-aim every 5 minutes (1.25°, sub-pixel). */
const SUN_REFRESH_MS = 300_000;

/**
 * Where the sun actually is, as a light position — so the terminator on the
 * globe matches the real clock. Only computed in photo-texture mode; the
 * procedural fallback keeps its fixed stage light, where "day side" is a
 * look, not a claim.
 */
function useSunPosition(enabled: boolean): THREE.Vector3 | null {
  const [pos, setPos] = useState<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (!enabled) {
      setPos(null);
      return;
    }
    const aim = () => {
      const { lat, lon } = subsolarPoint(new Date());
      setPos(latLonToVec3(lat, lon, 10));
    };
    aim();
    const timer = setInterval(aim, SUN_REFRESH_MS);
    return () => clearInterval(timer);
  }, [enabled]);

  return pos;
}

/**
 * Earth photo textures, loaded once from public/textures/.
 *
 * Loaded manually (not useLoader/Suspense) because failure must be survivable:
 * missing files fall back to the procedural globe instead of suspending the
 * whole canvas. Returns null until the colour map is ready; the bump map is
 * best-effort on top.
 */
interface EarthTextures {
  map: THREE.Texture;
  bump: THREE.Texture | null;
  /** NASA Black Marble city lights — emissive on the night side. */
  night: THREE.Texture | null;
}

function useEarthTextures(): EarthTextures | null {
  const [maps, setMaps] = useState<EarthTextures | null>(null);

  useEffect(() => {
    let disposed = false;
    const owned: THREE.Texture[] = [];
    const loader = new THREE.TextureLoader();

    /** Best-effort secondary texture: resolve with the texture or null —
     *  relief and night lights are niceties; colour alone is still earth. */
    const optional = (url: string, srgb = false) =>
      new Promise<THREE.Texture | null>((resolve) => {
        loader.load(
          url,
          (t) => {
            if (srgb) t.colorSpace = THREE.SRGBColorSpace;
            owned.push(t);
            resolve(t);
          },
          undefined,
          () => resolve(null),
        );
      });

    loader.load(
      '/textures/earth-blue-marble.jpg',
      async (map) => {
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = 8;
        owned.push(map);
        if (disposed) return;
        const [bump, night] = await Promise.all([
          optional('/textures/earth-topology.png'),
          optional('/textures/earth-night.jpg', true),
        ]);
        if (!disposed) setMaps({ map, bump, night });
      },
      undefined,
      () => {
        /* stay procedural — the fallback branch renders instead */
      },
    );

    return () => {
      disposed = true;
      owned.forEach((t) => t.dispose());
    };
  }, []);

  return maps;
}

export interface GlobeSceneProps {
  signals: Signal[];
  selected: Signal | null;
  onSelect: (signal: Signal | null) => void;
  coast: GeoFeatureCollection | null;
  land: GeoFeatureCollection | null;
  /** The fleet, sailing. Empty until voyages load. */
  voyages?: Voyage[];
  /** Voyage picked in the impact panel — draws BOTH routes: the plan of
   *  record and the proposed alternative, because the panel's whole job is
   *  that comparison. */
  focused?: AffectedVoyage | null;
  /** Hull clicked on the globe — draws ONLY its plan of record. Asking "where
   *  is this ship going" is a different question from "should it turn". */
  inspectedVoyageId?: string | null;
  onInspectVoyage?: (voyageId: string | null) => void;
}

export function GlobeScene({
  signals,
  selected,
  onSelect,
  coast,
  land,
  voyages = [],
  focused = null,
  inspectedVoyageId = null,
  onInspectVoyage,
}: GlobeSceneProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{
        position: [INITIAL_CAMERA.x, INITIAL_CAMERA.y, INITIAL_CAMERA.z],
        fov: 40,
        near: 0.1,
        far: 120,
      }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Scene
        signals={signals}
        selected={selected}
        onSelect={onSelect}
        coast={coast}
        land={land}
        voyages={voyages}
        focused={focused}
        inspectedVoyageId={inspectedVoyageId}
        onInspectVoyage={onInspectVoyage}
      />
    </Canvas>
  );
}

function Scene({
  signals,
  selected,
  onSelect,
  coast,
  land,
  voyages = [],
  focused = null,
  inspectedVoyageId = null,
  onInspectVoyage,
}: GlobeSceneProps) {
  /* Plan of record for a hull clicked directly on the globe. */
  const inspected = useMemo(() => {
    if (!inspectedVoyageId) return null;
    const v = voyages.find((x) => x.id === inspectedVoyageId);
    if (!v) return null;
    return v.routeOptions.find((r) => r.id === v.activeRouteId) ?? null;
  }, [inspectedVoyageId, voyages]);
  const globeRef = useRef<THREE.Mesh>(null);
  const earth = useEarthTextures();
  const sun = useSunPosition(Boolean(earth));

  /* Touch → stop; resume after 30 idle seconds. Driven per-frame off a
   * timestamp rather than React state so a drag doesn't re-render the tree. */
  const controlsRef = useRef<import('three-stdlib').OrbitControls | null>(null);
  const lastTouch = useRef(Number.NEGATIVE_INFINITY);
  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const idle = performance.now() - lastTouch.current > RESUME_SPIN_AFTER_MS;
    controls.autoRotate = idle && !selected && !focused;
  });

  return (
    <>
      {/* Day/night is REAL here: one strong sun, almost no fill. The night
          hemisphere must actually be dark or the city lights cannot carry it
          — the earlier 1.05 ambient (added to "brighten the globe") flooded
          the night side with the day texture and drowned the lights
          entirely. Day-side brightness now comes from the sun alone; the
          faint ambient is just enough for continents to ghost through the
          dark, as in the Black Marble reference. The procedural fallback
          keeps its old flat stage light. */}
      <ambientLight intensity={earth ? 0.18 : 1.1} />
      {/* In photo mode the sun is placed at the real subsolar point, so the
          dark hemisphere is the one where it is actually night right now. */}
      <directionalLight
        position={sun ? [sun.x, sun.y, sun.z] : [4, 2.5, 3]}
        intensity={earth ? 1.9 : 1.15}
        color={earth ? '#FFF3DC' : '#BFD9F2'}
      />
      <directionalLight
        position={sun ? [-sun.x, -sun.y, -sun.z] : [-4, -2, -3]}
        intensity={earth ? 0.05 : 0.35}
        color={earth ? '#7FA5C9' : '#2DD4BF'}
      />

      <Starfield />

      {/* base sphere — also the click-to-deselect surface */}
      {earth ? (
        /* rotation.y = -π/2 aligns the equirectangular map with latLonToVec3:
         * three's SphereGeometry puts texture lon 0 at +x, our projection puts
         * it at +z. Without this the markers sit 90° east of their coasts. */
        <mesh
          ref={globeRef}
          rotation={[0, -Math.PI / 2, 0]}
          onClick={(e) => {
            if (e.delta > 8) return; // drag, not click
            e.stopPropagation();
            lastTouch.current = performance.now();
            onSelect(null);
          }}
        >
          <sphereGeometry args={[GLOBE_RADIUS * 0.997, 96, 96]} />
          <meshStandardMaterial
            map={earth.map}
            bumpMap={earth.bump ?? undefined}
            bumpScale={earth.bump ? 0.35 : 0}
            roughness={0.95}
            metalness={0}
            /* Near-white multiplier — barely tinted. The first pass muted the
               texture to #D9DFE4 (~85% brightness) to protect marker contrast
               and the planet read as overcast; the escalation oranges/reds
               stay legible well past this. */
            color="#F4F6F8"
            /* City lights, now over a genuinely dark night hemisphere. Amber
               tint to match the Black Marble look; intensity high because the
               light pixels are tiny dots that mip-average toward zero at
               globe scale — tone mapping absorbs the overshoot. On the sunlit
               side the day texture washes them out, which is the physics they
               imitate. Emissive must be non-black or the map multiplies to
               nothing. */
            emissiveMap={earth.night ?? undefined}
            emissive={earth.night ? '#FFC98C' : '#000000'}
            emissiveIntensity={earth.night ? 2.4 : 0}
          />
        </mesh>
      ) : (
        <mesh
          ref={globeRef}
          onClick={(e) => {
            if (e.delta > 8) return;
            e.stopPropagation();
            lastTouch.current = performance.now();
            onSelect(null);
          }}
        >
          <sphereGeometry args={[GLOBE_RADIUS * 0.997, 64, 64]} />
          <meshPhongMaterial
            color="#0A1830"
            emissive="#04101E"
            specular="#0E2A44"
            shininess={8}
          />
        </mesh>
      )}

      <Atmosphere />

      {/* The dot-matrix continents belong to the procedural fallback only —
          stencilled dots over a photograph read as noise. */}
      {!earth && land && <LandDots land={land} />}
      {!earth && coast && <Coastlines coast={coast} />}

      <PortDots />
      {/* No standing lane network. When a voyage is under inspection, the
          ONLY lines on the sphere are that voyage's plan of record and the
          proposed alternative (RouteOverlay below) — the catalogue of world
          shipping lanes drew every fleet's geometry over the one comparison
          that mattered. */}
      <ChokepointLabels globeRef={globeRef} />
      <SignalMarkers signals={signals} selectedId={selected?.id ?? null} onSelect={onSelect} />
      <SelectionRing signal={selected} />

      <VesselMarkers
        voyages={voyages}
        selectedVoyageId={focused?.voyageId ?? inspectedVoyageId}
        dimmed={Boolean(selected)}
        onSelect={onInspectVoyage}
      />
      {focused ? (
        <RouteOverlay
          currentRoute={focused.currentRoute}
          suggestedRoute={focused.suggestedRoute}
        />
      ) : (
        inspected && <RouteOverlay currentRoute={inspected} suggestedRoute={null} />
      )}
      <FlyTo
        target={
          focused ? { lat: focused.currentLat, lon: focused.currentLon } : null
        }
      />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan
        panSpeed={0.4}
        screenSpacePanning={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.45}
        zoomSpeed={0.8}
        // Close enough to read a strait, far enough to see both hemispheres.
        // The old 1.55 floor stopped well short of the surface, so zooming in
        // on a chokepoint bottomed out before it was legible.
        minDistance={1.12}
        maxDistance={6.0}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI - 0.35}
        // Spin is managed per-frame above: any touch stops it, 30 idle
        // seconds restart it, and inspection always holds it still.
        autoRotate={false}
        autoRotateSpeed={0.35}
        onStart={() => {
          lastTouch.current = performance.now();
        }}
      />
    </>
  );
}

/* ── Continents ─────────────────────────────────────────────────────────── */

function LandDots({ land }: { land: GeoFeatureCollection }) {
  const positions = useMemo(() => landDotPositions(land, GLOBE_RADIUS * 1.0025), [land]);
  const texture = useMemo(() => getDotTexture(), []);
  return (
    <points raycast={noRaycast}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={texture}
        color="#2E5470"
        size={0.011}
        sizeAttenuation
        transparent
        alphaTest={0.3}
        opacity={0.9}
      />
    </points>
  );
}

function Coastlines({ coast }: { coast: GeoFeatureCollection }) {
  const positions = useMemo(() => geoToSegmentPositions(coast, GLOBE_RADIUS * 1.0015), [coast]);
  return (
    <lineSegments raycast={noRaycast}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#2DD4BF" transparent opacity={0.22} />
    </lineSegments>
  );
}

/* ── Ports ──────────────────────────────────────────────────────────────── */

function PortDots() {
  const positions = useMemo(() => {
    const arr = new Float32Array(PORTS.length * 3);
    PORTS.forEach((p, i) => {
      const v = latLonToVec3(p.lat, p.lon, GLOBE_RADIUS * 1.005);
      arr[i * 3] = v.x;
      arr[i * 3 + 1] = v.y;
      arr[i * 3 + 2] = v.z;
    });
    return arr;
  }, []);
  const texture = useMemo(() => getDotTexture(), []);
  return (
    <points raycast={noRaycast}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={texture}
        color="#7FA5C9"
        size={0.017}
        sizeAttenuation
        transparent
        alphaTest={0.3}
        opacity={0.95}
      />
    </points>
  );
}

/* ── Ambience ───────────────────────────────────────────────────────────── */

/** Teal fresnel rim so the dark sphere reads against the dark page. */
function Atmosphere() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vNormal;
          void main() {
            float intensity = pow(0.66 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.2);
            intensity = clamp(intensity, 0.0, 1.0);
            // Sky-blue rim — reads as atmosphere over the photo texture where
            // the old teal read as UI chrome leaking onto the planet.
            gl_FragColor = vec4(vec3(0.28, 0.47, 0.82) * intensity, intensity);
          }
        `,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );

  // Prop-passed materials are not auto-disposed by r3f — free the compiled
  // shader program when the globe unmounts so repeat /globe visits don't leak.
  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh scale={1.17} material={material} raycast={noRaycast}>
      <sphereGeometry args={[GLOBE_RADIUS, 48, 48]} />
    </mesh>
  );
}

/** Sparse faint starfield shell far behind the globe. */
function Starfield() {
  const positions = useMemo(() => {
    const count = 700;
    const arr = new Float32Array(count * 3);
    // Deterministic pseudo-random so the sky never "re-rolls" on remount.
    let seed = 42;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < count; i++) {
      const u = rand() * 2 - 1;
      const t = rand() * Math.PI * 2;
      const r = 28 + rand() * 16;
      const s = Math.sqrt(1 - u * u);
      arr[i * 3] = r * s * Math.cos(t);
      arr[i * 3 + 1] = r * u;
      arr[i * 3 + 2] = r * s * Math.sin(t);
    }
    return arr;
  }, []);
  return (
    <points raycast={noRaycast} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#8FB4D9"
        size={0.06}
        sizeAttenuation
        transparent
        opacity={0.45}
        depthWrite={false}
      />
    </points>
  );
}
