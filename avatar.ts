import type { CharacterCard } from "./data";

/**
 * Filename-safe slug from a character name.
 * e.g. "Sookie St. James" → "sookie-st-james"
 *      "Sebastian 'Digger' Stiles" → "sebastian-digger-stiles"
 */
export function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['".]/g, "")          // strip apostrophes, quotes, full stops
    .replace(/[^a-z0-9]+/g, "-")    // any non-alphanumeric run → single hyphen
    .replace(/^-+|-+$/g, "");       // trim leading/trailing hyphens
}

/**
 * Resolve a card's portrait image URL.
 * Explicit card.img wins; otherwise the slug convention path is tried first
 * (the caller handles the 404 with an onerror fallback to the SVG avatar).
 */
export function imageSrc(card: CharacterCard): string {
  return card.img ?? `/cards/${slug(card.name)}.jpg`;
}

/** Two-letter initials from a character name. */
export function initials(name: string): string {
  const parts = name.replace(/['".]/g, "").split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Lighten a #rrggbb hex by a flat per-channel amount, returns an rgb() string. */
export function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + amt);
  const g = Math.min(255, ((n >> 8) & 255) + amt);
  const b = Math.min(255, (n & 255) + amt);
  return `rgb(${r},${g},${b})`;
}

/** Stable, valid SVG gradient id derived from the character name. */
export function gradientId(card: CharacterCard): string {
  return "grad-" + card.name.replace(/[^a-zA-Z]/g, "");
}
