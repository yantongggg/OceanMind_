/**
 * Map a supplier (by stable id or by name fragment) to its logo URL.
 *
 * Files live in `public/suppliers/` and ship statically with the bundle —
 * no CDN, no external storage. Drop a PNG named after the supplier id
 * (e.g. `sup-001.png`) into that folder and add it to BY_ID.
 *
 * The OceanMind demo dataset currently ships no brand PNGs — every
 * supplier renders the textual initials chip fallback in SupplierLogo,
 * which keeps the layout identical and never crashes.
 */

const BY_ID: Record<string, string> = {
  // 'SUP-001': '/suppliers/sup-001.png',
};

/** Keyword fallback when the id isn't in the table. */
const BY_KEYWORD: Array<[RegExp, string]> = [];

export function supplierLogoFor(idOrName: string | null | undefined): string | null {
  if (!idOrName) return null;
  if (BY_ID[idOrName]) return BY_ID[idOrName];
  for (const [re, url] of BY_KEYWORD) {
    if (re.test(idOrName)) return url;
  }
  return null;
}

/** Two-letter initials for the fallback chip — first letters of the first
 *  two words ("Straits Marine Energy" → "SM"), or the first two letters of
 *  a single-word name. */
export function supplierInitials(name: string): string {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
