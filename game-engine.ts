/**
 * Framework-free, synchronous game engine for Stars Hollow Top Trumps.
 *
 * All state is plain JSON-serialisable data — no class instances, no closures,
 * no framework reactivity. This lets it be:
 *   • shared between the host driver (Game.svelte) and the Bun WS server,
 *   • serialised over the wire as JSON.stringify(state),
 *   • unit-tested without a DOM.
 *
 * The two setTimeout calls (700ms reveal, 1400ms cleanup) live in Game.svelte,
 * not here. The engine only describes state transitions.
 */

import { dealDecks, type DealtCard, type Decks } from "./deck";
import { STATS } from "./data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Seat = 0 | 1;
export type Phase = "choose" | "reveal";

/** The single source of truth for the whole game, fully serialisable. */
export interface GameState {
	/** Each seat's hand of dealt cards. hands[0] is seat 0 (host / player 1). */
	hands: [DealtCard[], DealtCard[]];
	phase: Phase;
	pickedStat: number | null;
	pot: DealtCard[];
	/** Whose turn it is to call a stat. Winner of last round chooses next. */
	activeChooser: Seat;
	/**
	 * Snapshot of the contested pair held during the reveal phase.
	 * Populated at pick-time; cleared at cleanup. Ensures the same cards are shown
	 * on both sides throughout the reveal window even as the deck mutates.
	 */
	shown: [DealtCard | null, DealtCard | null];
	/**
	 * Result of the most recent round, used by asView() to build per-seat messages.
	 * null until the first round is resolved.
	 */
	lastResult: LastResult | null;
}

export interface LastResult {
	stat: number;
	/** Score for seat 0 on the chosen stat. */
	seat0Score: number;
	/** Score for seat 1 on the chosen stat. */
	seat1Score: number;
	/** Which seat won the round, or null for a draw. */
	winner: Seat | null;
}

/** Derived view from one seat's perspective — built client-side from GameState. */
export interface GameView {
	myHand: DealtCard[];
	theirHand: DealtCard[];
	myTop: DealtCard | undefined;
	theirTop: DealtCard | undefined;
	myShown: DealtCard | null;
	theirShown: DealtCard | null;
	iChoose: boolean;
	phase: Phase;
	pickedStat: number | null;
	pot: DealtCard[];
	iWon: boolean;
	theyWon: boolean;
	gameOver: boolean;
	message: string;
}

// ---------------------------------------------------------------------------
// Core engine functions
// ---------------------------------------------------------------------------

/** Create a fresh game state from a dealt deck (or a new deal if omitted). */
export function newGame(deal?: Decks): GameState {
	const d = deal ?? dealDecks();
	return {
		hands: [d.player, d.cpu],
		phase: "choose",
		pickedStat: null,
		pot: [],
		activeChooser: 0,
		shown: [null, null],
		lastResult: null,
	};
}

/** Top card for a seat, or undefined when the hand is empty. */
export function topCard(s: GameState, seat: Seat): DealtCard | undefined {
	return s.hands[seat][0];
}

/** Which seat has won (the other's hand hit zero), or null if game continues. */
export function winnerOf(s: GameState): Seat | null {
	if (s.hands[0].length === 0) return 1;
	if (s.hands[1].length === 0) return 0;
	return null;
}

/**
 * CPU-opponent pick: the stat index where this card's score is highest.
 * First index wins on ties. Moved verbatim from Game.svelte.
 */
export function cpuBestStat(card: DealtCard): number {
	let best = 0;
	for (let i = 1; i < card.s.length; i++) {
		if (card.s[i] > card.s[best]) best = i;
	}
	return best;
}

/**
 * Apply a stat pick.
 *
 * Returns TWO states, mirroring the existing two-phase timer split:
 *   reveal  — the snapshot is locked in, phase flips to "reveal".
 *             Broadcast this immediately; the 700ms timer then calls resolve().
 *   resolve — cards move, activeChooser updates, lastResult is set.
 *             Broadcast after the 700ms timer; the 1400ms timer then calls cleanup().
 *
 * Validation: callers should guard `phase === "choose"` and
 * `activeChooser === seat` before calling.
 */
export function applyPick(
	s: GameState,
	seat: Seat,
	stat: number,
): { reveal: GameState; resolve: () => GameState } {
	const top0 = s.hands[0][0];
	const top1 = s.hands[1][0];

	if (!top0 || !top1) {
		throw new Error("applyPick called with an empty hand");
	}

	// --- Reveal state: snapshot the contested pair, flip phase ---
	const reveal: GameState = {
		...s,
		phase: "reveal",
		pickedStat: stat,
		shown: [top0, top1],
	};

	// --- Resolve: compare stats and move cards ---
	function resolve(): GameState {
		const score0 = top0.s[stat];
		const score1 = top1.s[stat];
		// Stake = both top cards + any held pot.
		const stake = [top0, top1, ...s.pot];

		let hands: [DealtCard[], DealtCard[]];
		let activeChooser: Seat;
		let winner: Seat | null;

		if (score0 > score1) {
			// Seat 0 wins: takes the stake appended to their hand.
			hands = [
				[...s.hands[0].slice(1), ...stake],
				s.hands[1].slice(1),
			];
			activeChooser = 0;
			winner = 0;
		} else if (score1 > score0) {
			// Seat 1 wins.
			hands = [
				s.hands[0].slice(1),
				[...s.hands[1].slice(1), ...stake],
			];
			activeChooser = 1;
			winner = 1;
		} else {
			// Draw: both tops go into the pot; chooser unchanged.
			hands = [s.hands[0].slice(1), s.hands[1].slice(1)];
			activeChooser = s.activeChooser;
			winner = null;
		}

		return {
			...reveal,
			hands,
			pot: winner !== null ? [] : stake,
			activeChooser,
			lastResult: {
				stat,
				seat0Score: score0,
				seat1Score: score1,
				winner,
			},
		};
	}

	return { reveal, resolve };
}

/**
 * The 1400ms cleanup step: flip phase back to "choose", clear the snapshot.
 * Call this after the resolve state has been shown long enough.
 */
export function cleanup(s: GameState): GameState {
	return {
		...s,
		phase: "choose",
		pickedStat: null,
		shown: [null, null],
	};
}

// ---------------------------------------------------------------------------
// Perspective view-mapper
// ---------------------------------------------------------------------------

/**
 * Build a per-seat view from authoritative GameState.
 * Each device calls this with its own seat number so "my" / "their" map correctly.
 */
export function asView(s: GameState, me: Seat): GameView {
	const them = (1 - me) as Seat;
	const gameWinner = winnerOf(s);

	// During the reveal phase, show the snapshot; during choose, show the live top.
	const myCard =
		s.phase === "reveal" ? s.shown[me] ?? s.hands[me][0] : s.hands[me][0];
	const theirCard =
		s.phase === "reveal" ? s.shown[them] ?? s.hands[them][0] : s.hands[them][0];

	return {
		myHand: s.hands[me],
		theirHand: s.hands[them],
		myTop: myCard,
		theirTop: theirCard,
		myShown: s.shown[me],
		theirShown: s.shown[them],
		iChoose: s.activeChooser === me,
		phase: s.phase,
		pickedStat: s.pickedStat,
		pot: s.pot,
		iWon: gameWinner === me,
		theyWon: gameWinner === them,
		gameOver: gameWinner !== null,
		message: buildMessage(s, me),
	};
}

/**
 * Build a human-readable status message from one seat's perspective.
 * Derived entirely from GameState so no stored string is needed.
 */
export function buildMessage(s: GameState, me: Seat): string {
	const them = (1 - me) as Seat;
	const gameWinner = winnerOf(s);

	if (gameWinner !== null) {
		return gameWinner === me
			? "You cleaned them out. Coffee's on the house."
			: "They took the lot. Even Kirk wins sometimes.";
	}

	if (s.phase === "reveal" && s.lastResult) {
		const { stat, seat0Score, seat1Score, winner } = s.lastResult;
		const myScore = me === 0 ? seat0Score : seat1Score;
		const theirScore = me === 0 ? seat1Score : seat0Score;
		const statName = STATS[stat];

		if (winner === null) {
			return `${statName}: ${myScore} all. Cards held over — play again.`;
		}
		if (winner === me) {
			return `${statName}: ${myScore} beats ${theirScore}. You take the cards.`;
		}
		return `${statName}: ${theirScore} beats ${myScore}. They take the cards.`;
	}

	if (s.phase === "choose") {
		if (s.activeChooser === me) return "Your turn. Pick a stat.";
		return "Opponent is choosing…";
	}

	return "";
}
