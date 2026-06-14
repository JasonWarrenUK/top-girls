import type { CharacterCard } from "./data";

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
