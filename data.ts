export const STATS = [
  "Wit",
  "Coffee Craving",
  "Drama",
  "Book Smarts",
  "Charm",
  "Peppiness",
] as const;

export type Stat = (typeof STATS)[number];

/** Six stat values, 0–10, in STATS order. */
export type StatLine = [number, number, number, number, number, number];

export interface CharacterCard {
  name: string;
  /** Signature colour for the generated avatar. */
  hex: string;
  s: StatLine;
}

/**
 * Stats are distributed on a bell curve per column: each stat independently
 * runs 0 → 10 with the field clustered around the midpoint. Rank order within
 * a stat is preserved, so relative gags hold (e.g. Davey is the single dimmest
 * card on Book Smarts, one below Rune).
 */
export const CARDS: CharacterCard[] = [
  { name: "Lorelai Gilmore", hex: "#b5485d", s: [10, 10, 7, 6, 10, 9] },
  { name: "Rory Gilmore", hex: "#5d7fb5", s: [7, 8, 4, 10, 7, 7] },
  { name: "Emily Gilmore", hex: "#7a5da3", s: [9, 2, 10, 7, 5, 3] },
  { name: "Richard Gilmore", hex: "#3f5d4a", s: [6, 4, 4, 9, 6, 3] },
  { name: "Luke Danes", hex: "#3a6e6e", s: [6, 9, 3, 5, 6, 2] },
  { name: "Sookie St. James", hex: "#c77d3a", s: [7, 6, 7, 5, 9, 8] },
  { name: "Lane Kim", hex: "#a3475d", s: [7, 8, 5, 6, 7, 8] },
  { name: "Paris Geller", hex: "#8a3a4a", s: [8, 8, 9, 8, 3, 6] },
  { name: "Michel Gerard", hex: "#4a4a6e", s: [8, 7, 6, 6, 2, 2] },
  { name: "Kirk Gleason", hex: "#6e6e3a", s: [5, 4, 8, 4, 4, 6] },
  { name: "Taylor Doose", hex: "#7a6e3a", s: [4, 2, 8, 4, 1, 5] },
  { name: "Miss Patty", hex: "#a3478a", s: [6, 4, 8, 4, 8, 7] },
  { name: "Babette Dell", hex: "#9a5d8a", s: [6, 6, 7, 3, 7, 8] },
  { name: "Dean Forester", hex: "#5d6e7a", s: [2, 4, 5, 3, 5, 4] },
  { name: "Jess Mariano", hex: "#3a3a4a", s: [8, 7, 6, 8, 5, 1] },
  { name: "Logan Huntzberger", hex: "#8a7a3a", s: [6, 7, 6, 6, 8, 6] },
  { name: "Christopher Hayden", hex: "#6e5d7a", s: [5, 6, 6, 4, 6, 5] },
  { name: "Max Medina", hex: "#3a5d6e", s: [5, 5, 2, 8, 5, 4] },
  { name: "Sebastian 'Digger' Stiles", hex: "#5d4a3a", s: [4, 5, 5, 6, 4, 4] },
  { name: "Mrs. Kim", hex: "#7a3a4a", s: [5, 1, 6, 5, 2, 0] },
  { name: "Zack Van Gerbig", hex: "#4a6e5d", s: [4, 5, 2, 2, 5, 6] },
  { name: "Brian Fuller", hex: "#5d7a6e", s: [3, 3, 2, 5, 4, 4] },
  { name: "Gypsy", hex: "#6e4a3a", s: [5, 5, 4, 5, 3, 4] },
  { name: "Andrew", hex: "#5d6e4a", s: [2, 3, 1, 5, 3, 5] },
  { name: "Liz Danes", hex: "#a36e8a", s: [4, 5, 5, 2, 6, 6] },
  { name: "T.J.", hex: "#6e5d4a", s: [3, 5, 5, 2, 5, 7] },
  { name: "Doyle McMaster", hex: "#4a5d7a", s: [5, 6, 5, 7, 2, 5] },
  { name: "Headmaster Charleston", hex: "#3a4a5d", s: [4, 3, 4, 7, 4, 2] },
  { name: "Jackson Belleville", hex: "#5d7a3a", s: [3, 4, 3, 4, 6, 5] },
  { name: "Rune", hex: "#7a4a4a", s: [1, 2, 3, 1, 0, 3] },
  { name: "Caesar", hex: "#4a6e7a", s: [2, 6, 0, 3, 4, 5] },
  { name: "Davey Belleville", hex: "#9a8a5d", s: [0, 0, 4, 0, 8, 10] },
];
