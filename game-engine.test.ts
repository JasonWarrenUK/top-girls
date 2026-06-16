import { describe, it, expect } from "vitest";
import {
	newGame,
	topCard,
	winnerOf,
	cpuBestStat,
	applyPick,
	cleanup,
	asView,
	buildMessage,
	type GameState,
	type Seat,
} from "./game-engine";
import type { DealtCard } from "./deck";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal DealtCard for testing. */
function card(id: number, stats: [number, number, number, number, number, number]): DealtCard {
	return { id, name: `Card${id}`, hex: "#aaa", s: stats };
}

/** Build a minimal two-card GameState for testing specific matchups. */
function minimalGame(
	seat0Card: DealtCard,
	seat1Card: DealtCard,
	chooser: Seat = 0,
): GameState {
	return {
		hands: [[seat0Card], [seat1Card]],
		phase: "choose",
		pickedStat: null,
		pot: [],
		activeChooser: chooser,
		shown: [null, null],
		lastResult: null,
	};
}

// ---------------------------------------------------------------------------
// newGame
// ---------------------------------------------------------------------------

describe("newGame", () => {
	it("creates 32 dealt cards split 16/16", () => {
		const g = newGame();
		expect(g.hands[0].length).toBe(16);
		expect(g.hands[1].length).toBe(16);
	});

	it("starts in choose phase with seat 0 choosing", () => {
		const g = newGame();
		expect(g.phase).toBe("choose");
		expect(g.activeChooser).toBe(0);
	});

	it("has an empty pot and no result", () => {
		const g = newGame();
		expect(g.pot).toHaveLength(0);
		expect(g.lastResult).toBeNull();
	});

	it("all cards across both hands have unique ids", () => {
		const g = newGame();
		const ids = [...g.hands[0], ...g.hands[1]].map((c) => c.id);
		expect(new Set(ids).size).toBe(32);
	});
});

// ---------------------------------------------------------------------------
// topCard / winnerOf
// ---------------------------------------------------------------------------

describe("topCard", () => {
	it("returns first card of each seat's hand", () => {
		const g = newGame();
		expect(topCard(g, 0)).toBe(g.hands[0][0]);
		expect(topCard(g, 1)).toBe(g.hands[1][0]);
	});

	it("returns undefined for an empty hand", () => {
		const g: GameState = { ...newGame(), hands: [[], newGame().hands[1]] };
		expect(topCard(g, 0)).toBeUndefined();
	});
});

describe("winnerOf", () => {
	it("returns null when both hands have cards", () => {
		expect(winnerOf(newGame())).toBeNull();
	});

	it("returns seat 1 when seat 0 hand is empty", () => {
		const g: GameState = { ...newGame(), hands: [[], [card(1, [1, 1, 1, 1, 1, 1])]] };
		expect(winnerOf(g)).toBe(1);
	});

	it("returns seat 0 when seat 1 hand is empty", () => {
		const g: GameState = { ...newGame(), hands: [[card(1, [1, 1, 1, 1, 1, 1])], []] };
		expect(winnerOf(g)).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// cpuBestStat
// ---------------------------------------------------------------------------

describe("cpuBestStat", () => {
	it("picks the index of the highest stat", () => {
		const c = card(1, [1, 3, 2, 5, 4, 0]);
		expect(cpuBestStat(c)).toBe(3); // value 5 at index 3
	});

	it("picks the first index on ties", () => {
		const c = card(1, [5, 5, 3, 4, 5, 2]);
		expect(cpuBestStat(c)).toBe(0); // first 5 is at index 0
	});

	it("handles all-zero stats", () => {
		const c = card(1, [0, 0, 0, 0, 0, 0]);
		expect(cpuBestStat(c)).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// applyPick — reveal state
// ---------------------------------------------------------------------------

describe("applyPick reveal", () => {
	it("flips phase to reveal and sets pickedStat", () => {
		const c0 = card(0, [8, 3, 1, 2, 5, 4]);
		const c1 = card(1, [2, 7, 1, 3, 5, 4]);
		const g = minimalGame(c0, c1);
		const { reveal } = applyPick(g, 0, 0);
		expect(reveal.phase).toBe("reveal");
		expect(reveal.pickedStat).toBe(0);
	});

	it("snapshots both top cards into shown", () => {
		const c0 = card(0, [8, 3, 1, 2, 5, 4]);
		const c1 = card(1, [2, 7, 1, 3, 5, 4]);
		const g = minimalGame(c0, c1);
		const { reveal } = applyPick(g, 0, 0);
		expect(reveal.shown[0]).toBe(c0);
		expect(reveal.shown[1]).toBe(c1);
	});
});

// ---------------------------------------------------------------------------
// applyPick — resolve: seat 0 wins
// ---------------------------------------------------------------------------

describe("applyPick resolve — seat 0 wins", () => {
	const c0 = card(0, [9, 3, 1, 2, 5, 4]); // stat 0 = 9
	const c1 = card(1, [2, 7, 1, 3, 5, 4]); // stat 0 = 2
	let resolved: GameState;

	it("seat 0 has more cards (took the stake)", () => {
		const g = minimalGame(c0, c1);
		const { resolve } = applyPick(g, 0, 0);
		resolved = resolve();
		// Both top cards go to seat 0; each hand started with 1.
		expect(resolved.hands[0].length).toBe(2);
		expect(resolved.hands[1].length).toBe(0);
	});

	it("pot is empty after a win", () => {
		expect(resolved.pot).toHaveLength(0);
	});

	it("activeChooser passes to seat 0 (winner)", () => {
		expect(resolved.activeChooser).toBe(0);
	});

	it("lastResult records the winner as seat 0", () => {
		expect(resolved.lastResult?.winner).toBe(0);
		expect(resolved.lastResult?.stat).toBe(0);
		expect(resolved.lastResult?.seat0Score).toBe(9);
		expect(resolved.lastResult?.seat1Score).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// applyPick — resolve: seat 1 wins
// ---------------------------------------------------------------------------

describe("applyPick resolve — seat 1 wins", () => {
	const c0 = card(0, [2, 3, 1, 2, 5, 4]); // stat 1 = 3
	const c1 = card(1, [2, 9, 1, 3, 5, 4]); // stat 1 = 9

	it("seat 1 has more cards (took the stake)", () => {
		const g = minimalGame(c0, c1, 1);
		const { resolve } = applyPick(g, 1, 1);
		const resolved = resolve();
		expect(resolved.hands[1].length).toBe(2);
		expect(resolved.hands[0].length).toBe(0);
	});

	it("activeChooser passes to seat 1 (winner)", () => {
		const g = minimalGame(c0, c1, 1);
		const { resolve } = applyPick(g, 1, 1);
		expect(resolve().activeChooser).toBe(1);
	});

	it("lastResult records winner as seat 1", () => {
		const g = minimalGame(c0, c1, 1);
		const { resolve } = applyPick(g, 1, 1);
		expect(resolve().lastResult?.winner).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// applyPick — resolve: draw
// ---------------------------------------------------------------------------

describe("applyPick resolve — draw", () => {
	const c0 = card(0, [5, 3, 1, 2, 5, 4]); // stat 0 = 5
	const c1 = card(1, [5, 7, 1, 3, 5, 4]); // stat 0 = 5

	it("both top cards enter the pot", () => {
		const g = minimalGame(c0, c1);
		const { resolve } = applyPick(g, 0, 0);
		const resolved = resolve();
		expect(resolved.pot).toHaveLength(2);
		expect(resolved.pot).toContain(c0);
		expect(resolved.pot).toContain(c1);
	});

	it("both hands lose their top card on a draw", () => {
		const g = minimalGame(c0, c1);
		const { resolve } = applyPick(g, 0, 0);
		const resolved = resolve();
		expect(resolved.hands[0]).toHaveLength(0);
		expect(resolved.hands[1]).toHaveLength(0);
	});

	it("activeChooser is unchanged on a draw", () => {
		const g = minimalGame(c0, c1, 1);
		const { resolve } = applyPick(g, 1, 0);
		expect(resolve().activeChooser).toBe(1);
	});

	it("lastResult winner is null on a draw", () => {
		const g = minimalGame(c0, c1);
		const { resolve } = applyPick(g, 0, 0);
		expect(resolve().lastResult?.winner).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Pot carry-over: pot cards go to the next round's winner
// ---------------------------------------------------------------------------

describe("pot carry-over", () => {
	it("pot cards go to the winner of the next round", () => {
		// Two-card draw fills the pot with those two cards.
		const cA0 = card(0, [5, 5, 5, 5, 5, 5]);
		const cA1 = card(1, [5, 5, 5, 5, 5, 5]);
		const cB0 = card(2, [9, 1, 1, 1, 1, 1]); // will win next
		const cB1 = card(3, [1, 1, 1, 1, 1, 1]);

		// Set up a game where both hands have two cards.
		const g: GameState = {
			...minimalGame(cA0, cA1),
			hands: [[cA0, cB0], [cA1, cB1]],
		};

		// Round 1: draw at stat 0 — A0 and A1 go to pot.
		const { resolve: drawResolve } = applyPick(g, 0, 0);
		const afterDraw = drawResolve();
		expect(afterDraw.pot).toHaveLength(2);

		// Round 2: B0 (score 9) beats B1 (score 1) — stake is [B0, B1, A0, A1].
		const { resolve: winResolve } = applyPick(afterDraw, 0, 0);
		const afterWin = winResolve();
		expect(afterWin.hands[0]).toHaveLength(4); // won all 4 cards
		expect(afterWin.pot).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// cleanup
// ---------------------------------------------------------------------------

describe("cleanup", () => {
	it("flips phase back to choose", () => {
		const c0 = card(0, [8, 3, 1, 2, 5, 4]);
		const c1 = card(1, [2, 7, 1, 3, 5, 4]);
		const g = minimalGame(c0, c1);
		const { reveal, resolve } = applyPick(g, 0, 0);
		const resolved = resolve();
		expect(cleanup(resolved).phase).toBe("choose");
	});

	it("clears pickedStat and shown", () => {
		const c0 = card(0, [8, 3, 1, 2, 5, 4]);
		const c1 = card(1, [2, 7, 1, 3, 5, 4]);
		const g = minimalGame(c0, c1);
		const { resolve } = applyPick(g, 0, 0);
		const cleaned = cleanup(resolve());
		expect(cleaned.pickedStat).toBeNull();
		expect(cleaned.shown[0]).toBeNull();
		expect(cleaned.shown[1]).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// asView / buildMessage
// ---------------------------------------------------------------------------

describe("asView", () => {
	it("maps myHand to the chosen seat", () => {
		const g = newGame();
		expect(asView(g, 0).myHand).toBe(g.hands[0]);
		expect(asView(g, 1).myHand).toBe(g.hands[1]);
	});

	it("maps theirHand to the other seat", () => {
		const g = newGame();
		expect(asView(g, 0).theirHand).toBe(g.hands[1]);
		expect(asView(g, 1).theirHand).toBe(g.hands[0]);
	});

	it("iChoose is true when activeChooser matches the seat", () => {
		const g: GameState = { ...newGame(), activeChooser: 1 };
		expect(asView(g, 1).iChoose).toBe(true);
		expect(asView(g, 0).iChoose).toBe(false);
	});

	it("iWon is true for the seat with the non-empty hand when the other is empty", () => {
		const g: GameState = { ...newGame(), hands: [[], [card(1, [1, 1, 1, 1, 1, 1])]] };
		expect(asView(g, 1).iWon).toBe(true);
		expect(asView(g, 0).iWon).toBe(false);
	});

	it("gameOver is true when one hand is empty", () => {
		const g: GameState = { ...newGame(), hands: [[], [card(1, [1, 1, 1, 1, 1, 1])]] };
		expect(asView(g, 0).gameOver).toBe(true);
	});
});

describe("buildMessage", () => {
	it("says 'Your turn' when it is seat's turn in choose phase", () => {
		const g: GameState = { ...newGame(), phase: "choose", activeChooser: 0 };
		expect(buildMessage(g, 0)).toBe("Your turn. Pick a stat.");
	});

	it("says 'Opponent is choosing' when it is NOT the seat's turn", () => {
		const g: GameState = { ...newGame(), phase: "choose", activeChooser: 1 };
		expect(buildMessage(g, 0)).toContain("Opponent");
	});

	it("says 'You take' when seat wins (mid-game — two cards each so no game-over yet)", () => {
		// Use two cards each so the winner's hand doesn't empty after resolving.
		const c0a = card(0, [9, 1, 1, 1, 1, 1]);
		const c0b = card(2, [1, 1, 1, 1, 1, 1]);
		const c1a = card(1, [1, 1, 1, 1, 1, 1]);
		const c1b = card(3, [1, 1, 1, 1, 1, 1]);
		const g: GameState = { ...minimalGame(c0a, c1a), hands: [[c0a, c0b], [c1a, c1b]] };
		const { resolve } = applyPick(g, 0, 0);
		const resolved = resolve();
		// Game is NOT over (seat 1 still has c1b), so reveal branch fires.
		expect(buildMessage(resolved, 0)).toContain("You take");
	});

	it("says 'They take' when seat loses (mid-game)", () => {
		const c0a = card(0, [1, 1, 1, 1, 1, 1]);
		const c0b = card(2, [1, 1, 1, 1, 1, 1]);
		const c1a = card(1, [9, 1, 1, 1, 1, 1]);
		const c1b = card(3, [1, 1, 1, 1, 1, 1]);
		const g: GameState = { ...minimalGame(c0a, c1a), hands: [[c0a, c0b], [c1a, c1b]] };
		const { resolve } = applyPick(g, 0, 0);
		const resolved = resolve();
		expect(buildMessage(resolved, 0)).toContain("They take");
	});

	it("mentions 'all' on a draw (mid-game)", () => {
		const c0a = card(0, [5, 1, 1, 1, 1, 1]);
		const c0b = card(2, [1, 1, 1, 1, 1, 1]);
		const c1a = card(1, [5, 1, 1, 1, 1, 1]);
		const c1b = card(3, [1, 1, 1, 1, 1, 1]);
		const g: GameState = { ...minimalGame(c0a, c1a), hands: [[c0a, c0b], [c1a, c1b]] };
		const { resolve } = applyPick(g, 0, 0);
		const resolved = resolve();
		expect(buildMessage(resolved, 0)).toContain("all");
	});

	it("game-over message from winner seat mentions coffee", () => {
		const g: GameState = { ...newGame(), hands: [[card(1, [1, 1, 1, 1, 1, 1])], []] };
		expect(buildMessage(g, 0)).toContain("Coffee");
	});
});
