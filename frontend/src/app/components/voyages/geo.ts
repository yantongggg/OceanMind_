/**
 * Voyages — shared geo / formatting helpers.
 *
 * Pure functions only: equirectangular projection math, antimeridian
 * unwrapping, chokepoint coordinates, port/flag lookups and the small
 * formatters used by the fleet board and the voyage detail page.
 */

import type { RouteOption, Voyage, VoyageStatus } from '../../../data/types';

/* ── Antimeridian-safe unwrapping ─────────────────────────────────────── */

/**
 * Unwrap a [lon, lat] polyline so consecutive longitudes never jump more
 * than 180° — Pacific routes render as one continuous line instead of a
 * streak across the map.
 */
export function unwrapLine(points: [number, number][]): [number, number][] {
  if (points.length === 0) return [];
  const out: [number, number][] = [[points[0][0], points[0][1]]];
  for (let i = 1; i < points.length; i++) {
    let lon = points[i][0];
    const prev = out[i - 1][0];
    while (lon - prev > 180) lon -= 360;
    while (lon - prev < -180) lon += 360;
    out.push([lon, points[i][1]]);
  }
  return out;
}

/** Shift a single longitude into the frame [minLon, maxLon] if a ±360
 *  alias fits better; otherwise return the alias closest to the centre. */
export function alignLon(lon: number, minLon: number, maxLon: number): number {
  const centre = (minLon + maxLon) / 2;
  let best = lon;
  let bestDist = Math.abs(lon - centre);
  for (const cand of [lon - 360, lon + 360]) {
    const d = Math.abs(cand - centre);
    if (d < bestDist) {
      best = cand;
      bestDist = d;
    }
  }
  return best;
}

/* ── Projection (plain equirectangular fitted to a bbox) ──────────────── */

export interface MapFrame {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
  width: number;   // SVG viewBox width
  height: number;  // SVG viewBox height
}

/**
 * Build a projection frame around every route of a voyage (plus its live
 * position), padded and clamped to a pleasant aspect ratio.
 */
export function buildFrame(voyage: Voyage, width = 1000): MapFrame {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  const include = (lon: number, lat: number) => {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  };

  for (const route of voyage.routeOptions) {
    for (const [lon, lat] of unwrapLine(route.waypoints)) include(lon, lat);
  }
  if (voyage.routeOptions.length === 0) {
    include(voyage.originLon, voyage.originLat);
    include(voyage.destinationLon, voyage.destinationLat);
  }
  // Live position, aligned into the current frame.
  include(alignLon(voyage.currentLon, minLon, maxLon), voyage.currentLat);

  // Padding: 6% of span each side (min 4°) + headroom for labels.
  const padLon = Math.max((maxLon - minLon) * 0.07, 4);
  const padLat = Math.max((maxLat - minLat) * 0.1, 4);
  minLon -= padLon;
  maxLon += padLon;
  minLat -= padLat;
  maxLat += padLat;

  // Clamp aspect (H/W) between 0.34 and 0.72 by growing the short side.
  let lonSpan = maxLon - minLon;
  let latSpan = maxLat - minLat;
  const aspect = latSpan / lonSpan;
  if (aspect < 0.34) {
    const grow = (0.34 * lonSpan - latSpan) / 2;
    minLat -= grow;
    maxLat += grow;
  } else if (aspect > 0.72) {
    const grow = (latSpan / 0.72 - lonSpan) / 2;
    minLon -= grow;
    maxLon += grow;
  }
  lonSpan = maxLon - minLon;
  latSpan = maxLat - minLat;

  return { minLon, maxLon, minLat, maxLat, width, height: (width * latSpan) / lonSpan };
}

export function projX(frame: MapFrame, lon: number): number {
  return ((lon - frame.minLon) / (frame.maxLon - frame.minLon)) * frame.width;
}

export function projY(frame: MapFrame, lat: number): number {
  return ((frame.maxLat - lat) / (frame.maxLat - frame.minLat)) * frame.height;
}

/** Polyline → SVG path string (already-unwrapped [lon, lat] points). */
export function linePath(frame: MapFrame, points: [number, number][]): string {
  return points
    .map(([lon, lat], i) => `${i === 0 ? 'M' : 'L'}${projX(frame, lon).toFixed(1)} ${projY(frame, lat).toFixed(1)}`)
    .join('');
}

/* ── Chokepoints ──────────────────────────────────────────────────────── */

export const CHOKEPOINTS: Record<string, [number, number]> = {
  'Malacca Strait': [100.3, 2.4],
  'Singapore Strait': [103.85, 1.2],
  'Bab el-Mandeb': [43.4, 12.6],
  'Suez Canal': [32.55, 29.93],
  'Gibraltar': [-5.4, 35.95],
  'Dover Strait': [1.5, 50.9],
  'Cape of Good Hope': [18.3, -34.9],
  'Strait of Hormuz': [56.5, 26.3],
  'Panama Canal': [-79.68, 9.08],
  'Luzon Strait': [121.0, 20.5],
  'Taiwan Strait': [119.5, 24.5],
  'Taiwan Strait approaches': [119.5, 24.5],
  'Makassar Strait': [117.5, -2.0],
};

/* ── Ports & flags ────────────────────────────────────────────────────── */

const PORT_ISO2: Record<string, string> = {
  'Port Klang': 'MY',
  Rotterdam: 'NL',
  Singapore: 'SG',
  Yokohama: 'JP',
  Chiba: 'JP',
  Shanghai: 'CN',
  Qingdao: 'CN',
  'Ningbo-Zhoushan': 'CN',
  'Los Angeles': 'US',
  'Long Beach': 'US',
  'Port Hedland': 'AU',
  Newcastle: 'AU',
  'Ras Tanura': 'SA',
  Fujairah: 'AE',
  'Jebel Ali': 'AE',
  Kaohsiung: 'TW',
  Santos: 'BR',
  'Richards Bay': 'ZA',
  Durban: 'ZA',
  'Cape Town': 'ZA',
  Balboa: 'PA',
  'Panama Canal': 'PA',
  Colombo: 'LK',
  Suez: 'EG',
};

const FLAG_STATE_ISO2: Record<string, string> = {
  Singapore: 'SG',
  'Marshall Islands': 'MH',
  'Hong Kong': 'HK',
  Panama: 'PA',
  Liberia: 'LR',
  Malta: 'MT',
  Greece: 'GR',
  Bahamas: 'BS',
  Cyprus: 'CY',
  Denmark: 'DK',
};

function iso2ToEmoji(iso2: string): string {
  return String.fromCodePoint(
    ...iso2
      .toUpperCase()
      .split('')
      .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

/** Flag emoji for a port name (falls back to a neutral marker). */
export function portFlag(port: string): string {
  const iso = PORT_ISO2[port];
  return iso ? iso2ToEmoji(iso) : '🏳️';
}

/** Flag emoji for a vessel's flag state. */
export function flagStateEmoji(flagState: string): string {
  const iso = FLAG_STATE_ISO2[flagState];
  return iso ? iso2ToEmoji(iso) : '🏳️';
}

/* ── Status / risk styling ────────────────────────────────────────────── */

export const STATUS_META: Record<VoyageStatus, { label: string; color: string; bg: string; border: string }> = {
  underway: { label: 'Underway', color: '#2DD4BF', bg: 'rgba(45,212,191,0.10)', border: 'rgba(45,212,191,0.30)' },
  at_anchor: { label: 'At anchor', color: '#8BA8C8', bg: 'rgba(139,168,200,0.10)', border: 'rgba(139,168,200,0.30)' },
  in_port: { label: 'In port', color: '#38BDF8', bg: 'rgba(56,189,248,0.10)', border: 'rgba(56,189,248,0.30)' },
  rerouted: { label: 'Rerouted', color: '#5EEAD4', bg: 'rgba(94,234,212,0.10)', border: 'rgba(94,234,212,0.30)' },
  delayed: { label: 'Delayed', color: '#E8A043', bg: 'rgba(232,160,67,0.10)', border: 'rgba(232,160,67,0.32)' },
  completed: { label: 'Completed', color: '#7A94B4', bg: 'rgba(122,148,180,0.10)', border: 'rgba(122,148,180,0.28)' },
};

export function riskColor(score: number): string {
  if (score < 35) return '#00D47E';
  if (score < 60) return '#E8A043';
  return '#C75A5A';
}

/* ── Route colouring (current / recommended / rejected) ───────────────── */

export interface RouteVisual {
  color: string;
  role: 'current' | 'recommended' | 'alternative';
  dash?: string;
}

export function routeVisual(route: RouteOption, voyage: Voyage): RouteVisual {
  if (route.id === voyage.activeRouteId) return { color: '#2DD4BF', role: 'current' };
  if (route.recommended) return { color: '#00D47E', role: 'recommended', dash: '10 6' };
  return { color: '#64809F', role: 'alternative', dash: '3 7' };
}

/* ── EU ETS estimate (display-only, labelled as estimate) ─────────────── */

const EU_PORTS = new Set(['Rotterdam', 'Antwerp', 'Hamburg', 'Valencia', 'Piraeus', 'Algeciras', 'Le Havre']);

/**
 * Rough EU ETS liability for a full route, USD.
 * 50% scope on extra-EU voyages × 70% 2026 phase-in × €72/EUA × 1.08 USD/EUR.
 * Returns null when the voyage does not touch an EU port.
 */
export function estimateEuEtsUsd(route: RouteOption, voyage: Voyage): number | null {
  const touchesEu = EU_PORTS.has(voyage.destinationPort) || EU_PORTS.has(voyage.originPort);
  if (!touchesEu) return null;
  return Math.round(route.co2Tonnes * 0.5 * 0.7 * 72 * 1.08);
}

/* ── Formatters ───────────────────────────────────────────────────────── */

export function fmtUsd(v: number, sign = false): string {
  const s = sign && v > 0 ? '+' : v < 0 ? '−' : '';
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${s}$${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000) return `${s}$${Math.round(a / 1_000)}k`;
  return `${s}$${Math.round(a)}`;
}

export function fmtInt(v: number): string {
  return Math.round(v).toLocaleString('en-US');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "14 Jul 09:12Z" — compact UTC timestamp. */
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${hh}:${mm}Z`;
}

/** "4 Aug 2026" — compact UTC date. */
export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Signed hour delta between current and original ETA. */
export function etaDeltaHours(voyage: Voyage): number {
  return Math.round((new Date(voyage.etaCurrent).getTime() - new Date(voyage.etaOriginal).getTime()) / 3_600_000);
}

/** "+7.5 d" / "+18 h" / "on schedule". */
export function fmtEtaDelta(hours: number): string {
  if (hours === 0) return 'on schedule';
  const sign = hours > 0 ? '+' : '−';
  const a = Math.abs(hours);
  if (a >= 48) return `${sign}${(a / 24).toFixed(1)} d`;
  return `${sign}${a} h`;
}

/** Total days a voyage has been underway (for context lines). */
export function daysUnderway(voyage: Voyage, nowMs: number): number {
  return Math.max(0, (nowMs - new Date(voyage.departedAt).getTime()) / 86_400_000);
}
