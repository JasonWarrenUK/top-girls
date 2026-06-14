import { CARDS, type CharacterCard } from "./data";

export interface DealtCard extends CharacterCard {
  id: number;
}

export interface Decks {
  player: DealtCard[];
  cpu: DealtCard[];
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffle the full deck and alternate cards between the two players. */
export function dealDecks(): Decks {
  const deck = shuffle(CARDS.map((c, i): DealtCard => ({ ...c, id: i })));
  const player: DealtCard[] = [];
  const cpu: DealtCard[] = [];
  deck.forEach((c, i) => (i % 2 === 0 ? player : cpu).push(c));
  return { player, cpu };
}
