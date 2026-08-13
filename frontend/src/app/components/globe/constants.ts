/**
 * Intelligence Globe — static presentation constants.
 *
 * Category colors, severity scaling, chokepoint registry, port registry and
 * the shipping-lane catalogue rendered as great-circle arcs. Pure data — no
 * three.js imports here so it stays cheap to import from overlay components.
 */

import type { SignalCategory, Severity } from '../../../data/types';

/* ── Signal categories ──────────────────────────────────────────────────── */

export interface CategoryMeta {
  label: string;
  color: string;      // marker + chip color
}

/**
 * Category is a filter facet, not an alarm. These colours identify WHAT a
 * signal is about; severity carries HOW BAD it is, on its own escalation
 * ramp below. Keeping the two vocabularies apart is the whole trick — when
 * category also shouted in reds and oranges, a low-severity geopolitical
 * explainer looked identical to a missile strike.
 *
 * So: cool, desaturated, sits back. Only severity is allowed to be loud.
 */
export const CATEGORY_META: Record<SignalCategory, CategoryMeta> = {
  geopolitical: { label: 'Geopolitical', color: '#8FA6C4' },
  piracy:       { label: 'Piracy',       color: '#A98FC4' },
  weather:      { label: 'Weather',      color: '#6FA8C4' },
  port:         { label: 'Port',         color: '#7FC4B8' },
  regulatory:   { label: 'Regulatory',   color: '#9CB4A0' },
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_META) as SignalCategory[];

/* ── Severity ───────────────────────────────────────────────────────────── */

export interface SeverityMeta {
  label: string;
  color: string;
  /** Marker core radius in globe units (globe radius = 1). */
  size: number;
  /** Pulse speed (rad/s) for the halo animation. */
  pulse: number;
  rank: number;
}

/**
 * The escalation ramp: quiet → yellow → orange → red.
 *
 * One hue family, increasing temperature. An operator reads urgency by
 * warmth alone, without decoding a legend — and 44 criticals in a live feed
 * means the top of the ramp has to earn its red rather than share it with
 * every category chip on screen.
 *
 * `low` is deliberately colourless. Most of a live feed is low, and if the
 * noise floor glows the signal cannot.
 */
export const SEVERITY_META: Record<Severity, SeverityMeta> = {
  low:      { label: 'Low',      color: '#5C7391', size: 0.0060, pulse: 0.0, rank: 0 },
  medium:   { label: 'Medium',   color: '#E8C547', size: 0.0095, pulse: 0.9, rank: 1 },
  high:     { label: 'High',     color: '#F08A24', size: 0.0135, pulse: 1.6, rank: 2 },
  critical: { label: 'Critical', color: '#E33B3B', size: 0.0180, pulse: 2.6, rank: 3 },
};

export type SeverityFilter = 'all' | 'high' | 'critical';

/* ── Chokepoints ────────────────────────────────────────────────────────── */

export type ChokepointStatus = 'critical' | 'elevated' | 'watch';

export interface Chokepoint {
  name: string;
  lat: number;
  lon: number;
  status: ChokepointStatus;
}

/** Same escalation ramp as signal severity — a chokepoint in trouble and a
 *  signal about it should not be two different reds. */
export const CHOKEPOINT_STATUS_COLOR: Record<ChokepointStatus, string> = {
  critical: '#E33B3B',
  elevated: '#F08A24',
  watch:    '#4A5D78',
};

/** The five demo chokepoints; statuses mirror the golden signal set. */
export const CHOKEPOINTS: Chokepoint[] = [
  { name: 'Bab el-Mandeb',    lat: 12.58, lon: 43.33,  status: 'critical' },
  { name: 'Suez Canal',       lat: 30.45, lon: 32.35,  status: 'elevated' },
  { name: 'Malacca Strait',   lat: 2.30,  lon: 101.20, status: 'elevated' },
  { name: 'Strait of Hormuz', lat: 26.57, lon: 56.25,  status: 'watch' },
  { name: 'Panama Canal',     lat: 9.08,  lon: -79.68, status: 'watch' },
];

/* ── Ports (dots on the sphere; anchors for lane arcs) ──────────────────── */

export interface PortPoint {
  name: string;
  lat: number;
  lon: number;
}

export const PORTS: PortPoint[] = [
  { name: 'Port Klang',   lat: 3.00,   lon: 101.40 },
  { name: 'Singapore',    lat: 1.26,   lon: 103.85 },
  { name: 'Rotterdam',    lat: 51.95,  lon: 4.14 },
  { name: 'Shanghai',     lat: 31.23,  lon: 121.50 },
  { name: 'Los Angeles',  lat: 33.73,  lon: -118.26 },
  { name: 'Long Beach',   lat: 33.75,  lon: -118.20 },
  { name: 'Yokohama',     lat: 35.45,  lon: 139.65 },
  { name: 'Chiba',        lat: 35.57,  lon: 140.09 },
  { name: 'Qingdao',      lat: 36.08,  lon: 120.32 },
  { name: 'Kaohsiung',    lat: 22.60,  lon: 120.28 },
  { name: 'Port Hedland', lat: -20.31, lon: 118.58 },
  { name: 'Ras Tanura',   lat: 26.64,  lon: 50.16 },
  { name: 'Santos',       lat: -23.98, lon: -46.30 },
  { name: 'Richards Bay', lat: -28.80, lon: 32.05 },
  { name: 'Durban',       lat: -29.87, lon: 31.03 },
  { name: 'Cape Town',    lat: -33.91, lon: 18.43 },
];

/* ── Shipping lanes (great-circle arc chains between waypoints) ─────────── */

export type LaneStatus = 'active' | 'disrupted' | 'recommended';

export interface ShippingLane {
  id: string;
  label: string;
  status: LaneStatus;
  /** Ordered [lat, lon] waypoints; consecutive pairs become one arc hop. */
  waypoints: [number, number][];
}

export const LANE_STATUS_COLOR: Record<LaneStatus, string> = {
  active:      '#2DD4BF',
  disrupted:   '#E5484D',
  recommended: '#00D47E',
};

export const LANE_STATUS_OPACITY: Record<LaneStatus, number> = {
  active:      0.34,
  disrupted:   0.72,
  recommended: 0.78,
};

/**
 * Demo lane catalogue. The two Asia–Europe strings tell the golden story:
 * the Suez baseline is DISRUPTED at Bab el-Mandeb, the Cape of Good Hope
 * reroute is the RECOMMENDED alternative.
 */
export const SHIPPING_LANES: ShippingLane[] = [
  {
    id: 'lane-suez',
    label: 'Asia–Europe via Suez (baseline — disrupted)',
    status: 'disrupted',
    waypoints: [
      [3.0, 101.4],    // Port Klang
      [5.6, 80.2],     // south of Sri Lanka
      [12.58, 43.33],  // Bab el-Mandeb
      [30.0, 32.5],    // Suez
      [36.0, -5.8],    // Gibraltar
      [51.95, 4.14],   // Rotterdam
    ],
  },
  {
    id: 'lane-cape',
    label: 'Asia–Europe via Cape of Good Hope (recommended reroute)',
    status: 'recommended',
    waypoints: [
      [3.0, 101.4],    // Port Klang
      [5.6, 80.2],     // south of Sri Lanka
      [-34.9, 18.9],   // Cape of Good Hope
      [14.5, -18.2],   // off Dakar
      [51.95, 4.14],   // Rotterdam
    ],
  },
  {
    id: 'lane-transpacific',
    label: 'Transpacific — Shanghai → Los Angeles',
    status: 'active',
    waypoints: [
      [31.23, 121.5],
      [33.73, -118.26],
    ],
  },
  {
    id: 'lane-intra-asia',
    label: 'Intra-Asia — Singapore → Yokohama',
    status: 'active',
    waypoints: [
      [1.26, 103.85],
      [35.45, 139.65],
    ],
  },
  {
    id: 'lane-iron-ore',
    label: 'Iron ore — Port Hedland → Qingdao',
    status: 'active',
    waypoints: [
      [-20.31, 118.58],
      [36.08, 120.32],
    ],
  },
  {
    id: 'lane-tanker',
    label: 'Crude — Ras Tanura → Chiba',
    status: 'active',
    waypoints: [
      [26.64, 50.16],
      [26.57, 56.25],  // Hormuz
      [1.26, 103.85],  // Singapore
      [35.57, 140.09], // Chiba
    ],
  },
  {
    id: 'lane-panama',
    label: 'Shanghai → Panama → Santos',
    status: 'active',
    waypoints: [
      [31.23, 121.5],
      [9.08, -79.68],  // Panama
      [-23.98, -46.3], // Santos
    ],
  },
  {
    id: 'lane-coal',
    label: 'Coal — Richards Bay → Rotterdam',
    status: 'active',
    waypoints: [
      [-28.8, 32.05],
      [-34.9, 18.9],
      [14.5, -18.2],
      [51.95, 4.14],
    ],
  },
  {
    id: 'lane-transpac-south',
    label: 'Kaohsiung → Long Beach',
    status: 'active',
    waypoints: [
      [22.6, 120.28],
      [33.75, -118.2],
    ],
  },
];

/* ── Shared UI tokens (match src/styles/theme.css) ──────────────────────── */

/** '#RRGGBB' → 'rgba(r,g,b,a)' for tinted chip/badge backgrounds. */
export function hexAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const UI = {
  panelBg: 'rgba(7, 16, 28, 0.86)',
  panelBorder: 'rgba(255, 255, 255, 0.08)',
  text: '#EAF4FF',
  textSecondary: '#BFD7F7',
  textMuted: '#8BA8C8',
  label: '#5A8AB4',
  primary: '#2DD4BF',
} as const;

/**
 * Panel surface — the reference's editorial warmth, translated to the dark
 * terminal instead of transplanted onto it.
 *
 * The first attempt put a literal ivory card over the dark globe and it read
 * as a sticky note on someone else's app. The lesson: borrow the reference's
 * PALETTE RELATIONSHIPS (warm ground, cream type, burnt-orange + oxblood
 * accents, one hairline ornament), not its lightness. So: espresso-warm
 * near-black surface that sits in the same world as the globe, cream ink
 * hierarchy doing the print-typography job, terracotta doing what maroon did
 * on paper.
 *
 * Colour on this surface has exactly two jobs, as everywhere else: urgency,
 * and whether a number got worse.
 *
 * Panels are 280px, down from 320. Two of them at 320 walled off a third of
 * the viewport on a 1002px-wide screen and the globe — the actual subject —
 * had nowhere to be.
 */
export const PANEL = {
  width: 280,
  surface:
    'linear-gradient(180deg, rgba(27, 21, 16, 0.95) 0%, rgba(20, 15, 11, 0.96) 55%, rgba(15, 11, 8, 0.97) 100%)',
  /** Burnt-orange → oxblood hairline across the top edge — the card's one
   *  ornament, kept from the reference art direction. */
  edge: 'linear-gradient(90deg, transparent 0%, rgba(217, 119, 66, 0.6) 26%, rgba(158, 63, 48, 0.45) 70%, transparent 100%)',
  border: 'rgba(217, 178, 130, 0.14)',
  divider: 'rgba(242, 233, 219, 0.06)',

  /* ink hierarchy — cream on espresso, same print logic as ink on ivory */
  ink: '#F2E9DB',        // headlines, vessel names
  inkSoft: '#C6B9A5',    // body prose
  inkMuted: '#877B6C',   // metadata, captions
  label: '#C97B4A',      // small-caps section labels — the terracotta voice

  /* accents */
  accent: '#D97742',     // burnt orange: interactive, selected
  maroon: '#C96A55',     // the reasoned-judgement voice, lifted to read on dark
  good: '#58B98E',       // a delta that improved
  bad: '#E25B4A',        // a delta that got worse / immediate urgency
  warn: '#E2A23B',       // monitor urgency
  rowActive: 'rgba(217, 119, 66, 0.10)',
} as const;
