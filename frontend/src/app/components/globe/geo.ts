/**
 * Intelligence Globe — geometry helpers.
 *
 * Pure functions that turn lat/lon data (signals, ports, Natural Earth
 * GeoJSON in public/geo/) into three.js-ready positions. Everything here is
 * computed ONCE per dataset (memoised by callers) — no per-frame work.
 */

import * as THREE from 'three';

export const GLOBE_RADIUS = 1;

const DEG = Math.PI / 180;

/* ── Projection ─────────────────────────────────────────────────────────── */

/**
 * WGS84 lat/lon → position on the sphere. Mapping matches three-globe:
 * (0°N, 0°E) faces +z (the default camera), east is screen-right.
 */
export function latLonToVec3(lat: number, lon: number, radius = GLOBE_RADIUS): THREE.Vector3 {
  const phi = (90 - lat) * DEG;
  const theta = (90 - lon) * DEG;
  const sinPhi = Math.sin(phi);
  return new THREE.Vector3(
    radius * sinPhi * Math.cos(theta),
    radius * Math.cos(phi),
    radius * sinPhi * Math.sin(theta),
  );
}

/* ── Solar position ─────────────────────────────────────────────────────── */

/**
 * Subsolar point — the lat/lon where the sun is directly overhead at `date`.
 *
 * Drives the globe's day/night terminator off the real clock: place the
 * directional light at this point and the hemisphere in shadow is the
 * hemisphere where it is actually night right now, which is operational
 * information on a maritime display, not decoration.
 *
 * Approximations (cosine declination + polynomial equation of time) are the
 * standard almanac short forms — good to well under 1° all year, i.e. a few
 * pixels of terminator at globe scale. Full ephemeris accuracy would change
 * nothing visible.
 */
export function subsolarPoint(date: Date): { lat: number; lon: number } {
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = (date.getTime() - yearStart) / 86_400_000;

  // Solar declination: ±23.44°, extremes at the solstices.
  const lat = -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10));

  // Equation of time (minutes): true solar noon vs clock noon, ±~15 min.
  const b = ((2 * Math.PI) / 364) * (dayOfYear - 81);
  const eotMinutes = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);

  // Sun sits over lon 180° at 00:00 UTC and moves west 15°/hour.
  const utcHours =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const lon = ((180 - (utcHours + eotMinutes / 60) * 15 + 540) % 360) - 180;

  return { lat, lon };
}

/* ── Great-circle arcs ──────────────────────────────────────────────────── */

/**
 * Sampled great-circle arc between two lat/lon points, lifted off the
 * sphere with a sinusoidal altitude profile proportional to arc length.
 */
export function greatCircleArc(
  a: [number, number],
  b: [number, number],
  radius = GLOBE_RADIUS,
  segments = 48,
): THREE.Vector3[] {
  const va = latLonToVec3(a[0], a[1], 1);
  const vb = latLonToVec3(b[0], b[1], 1);
  const angle = va.angleTo(vb);
  const altitude = Math.min(0.20, 0.012 + angle * 0.10);
  const sinTotal = Math.sin(angle);
  const points: THREE.Vector3[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = new THREE.Vector3();
    if (sinTotal < 1e-6) {
      p.copy(va);
    } else {
      p.addScaledVector(va, Math.sin((1 - t) * angle) / sinTotal);
      p.addScaledVector(vb, Math.sin(t * angle) / sinTotal);
    }
    p.normalize().multiplyScalar(radius * (1 + altitude * Math.sin(Math.PI * t)));
    points.push(p);
  }
  return points;
}

/** Flatten polyline paths into a LineSegments position buffer (pairs). */
export function pathsToSegmentPositions(paths: THREE.Vector3[][]): Float32Array {
  let segments = 0;
  for (const path of paths) segments += Math.max(0, path.length - 1);
  const out = new Float32Array(segments * 6);
  let o = 0;
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i++) {
      const p = path[i];
      const q = path[i + 1];
      out[o++] = p.x; out[o++] = p.y; out[o++] = p.z;
      out[o++] = q.x; out[o++] = q.y; out[o++] = q.z;
    }
  }
  return out;
}

/* ── GeoJSON (Natural Earth 110m, served from /geo/) ────────────────────── */

type GeoPosition = [number, number];

export interface GeoFeatureCollection {
  type: string;
  features: {
    geometry: {
      type: 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon';
      coordinates: unknown;
    } | null;
  }[];
}

function collectRings(geo: GeoFeatureCollection): GeoPosition[][] {
  const rings: GeoPosition[][] = [];
  for (const feature of geo.features) {
    const g = feature.geometry;
    if (!g) continue;
    if (g.type === 'LineString') {
      rings.push(g.coordinates as GeoPosition[]);
    } else if (g.type === 'MultiLineString' || g.type === 'Polygon') {
      for (const line of g.coordinates as GeoPosition[][]) rings.push(line);
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates as GeoPosition[][][]) {
        for (const ring of poly) rings.push(ring);
      }
    }
  }
  return rings;
}

/**
 * GeoJSON line/polygon-outline geometry → LineSegments position buffer on
 * the sphere. ~10.5k vertices for Natural Earth 110m coastline.
 */
export function geoToSegmentPositions(
  geo: GeoFeatureCollection,
  radius = GLOBE_RADIUS,
): Float32Array {
  const rings = collectRings(geo);
  let segments = 0;
  for (const ring of rings) segments += Math.max(0, ring.length - 1);
  const out = new Float32Array(segments * 6);
  let o = 0;
  const v = new THREE.Vector3();
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      for (let k = 0; k < 2; k++) {
        const [lon, lat] = ring[i + k];
        const phi = (90 - lat) * DEG;
        const theta = (90 - lon) * DEG;
        const sinPhi = Math.sin(phi);
        v.set(
          radius * sinPhi * Math.cos(theta),
          radius * Math.cos(phi),
          radius * sinPhi * Math.sin(theta),
        );
        out[o++] = v.x; out[o++] = v.y; out[o++] = v.z;
      }
    }
  }
  return out;
}

/* ── Land dot matrix ────────────────────────────────────────────────────── */

interface PreparedPolygon {
  rings: GeoPosition[][];
  bbox: [number, number, number, number]; // minLon, minLat, maxLon, maxLat
}

function preparePolygons(geo: GeoFeatureCollection): PreparedPolygon[] {
  const polys: PreparedPolygon[] = [];
  const push = (rings: GeoPosition[][]) => {
    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    for (const ring of rings) {
      for (const [lon, lat] of ring) {
        if (lon < minLon) minLon = lon;
        if (lat < minLat) minLat = lat;
        if (lon > maxLon) maxLon = lon;
        if (lat > maxLat) maxLat = lat;
      }
    }
    polys.push({ rings, bbox: [minLon, minLat, maxLon, maxLat] });
  };
  for (const feature of geo.features) {
    const g = feature.geometry;
    if (!g) continue;
    if (g.type === 'Polygon') push(g.coordinates as GeoPosition[][]);
    else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates as GeoPosition[][][]) push(poly);
    }
  }
  return polys;
}

/** Even-odd point-in-ring test (lon/lat degrees). */
function pointInRing(lon: number, lat: number, ring: GeoPosition[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (
      (yi > lat) !== (yj > lat) &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Sample land polygons on an equal-arc lat/lon grid → Points position
 * buffer (the classic "dotted globe" continents). Runs once at load
 * (~30–80 ms for Natural Earth 110m, ≈8k dots at the default step).
 */
export function landDotPositions(
  geo: GeoFeatureCollection,
  radius = GLOBE_RADIUS,
  latStep = 1.15,
): Float32Array {
  const polygons = preparePolygons(geo);
  const coords: number[] = [];

  for (let lat = -84; lat <= 85; lat += latStep) {
    const cosLat = Math.max(Math.cos(lat * DEG), 0.12);
    const lonStep = latStep / cosLat;
    const rowOffset = (Math.round(lat / latStep) % 2) * (lonStep / 2);
    for (let lon = -180 + rowOffset; lon < 180; lon += lonStep) {
      let inside = false;
      for (const poly of polygons) {
        const [minLon, minLat, maxLon, maxLat] = poly.bbox;
        if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) continue;
        // even-odd across all rings handles holes (e.g. the Caspian)
        let hit = false;
        for (const ring of poly.rings) {
          if (pointInRing(lon, lat, ring)) hit = !hit;
        }
        if (hit) { inside = true; break; }
      }
      if (!inside) continue;
      const phi = (90 - lat) * DEG;
      const theta = (90 - lon) * DEG;
      const sinPhi = Math.sin(phi);
      coords.push(
        radius * sinPhi * Math.cos(theta),
        radius * Math.cos(phi),
        radius * sinPhi * Math.sin(theta),
      );
    }
  }
  return Float32Array.from(coords);
}

/* ── Shared canvas textures (lazy singletons) ───────────────────────────── */

let glowTexture: THREE.Texture | null = null;

/** Soft radial glow used by marker halo sprites. */
export function getGlowTexture(): THREE.Texture {
  if (glowTexture) return glowTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.22, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.14)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  glowTexture = new THREE.CanvasTexture(canvas);
  return glowTexture;
}

let dotTexture: THREE.Texture | null = null;

/** Hard-edged round dot for the land dot matrix / port points. */
export function getDotTexture(): THREE.Texture {
  if (dotTexture) return dotTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.72, 'rgba(255,255,255,1)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  dotTexture = new THREE.CanvasTexture(canvas);
  return dotTexture;
}

/** No-op raycast for decorative objects so they never intercept clicks. */
export const noRaycast = () => undefined;
