/**
 * Browser WebSocket client for Stars Hollow Top Trumps LAN multiplayer.
 *
 * Connects to the Bun relay server, tracks the assigned seat, and provides
 * a simple send/subscribe interface that Game.svelte and Lobby.svelte use.
 *
 * The WS URL defaults to ws://<same host>:3001 — this works because when
 * device 2 opens http://192.168.x.x:5173, `location.hostname` is the host's
 * LAN IP, so the same IP is used for the socket. No manual config needed.
 */

import type { Seat } from "./game-engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NetRole = "host" | "guest";

export type NetStatus =
	| "connecting"
	| "waiting"   // connected, waiting for peer
	| "ready"     // both peers joined
	| "closed";

export interface NetHandle {
	/** Send a JSON-serialisable message to the relay (forwarded to the peer). */
	send(msg: unknown): void;
	/** Subscribe to inbound messages. Returns an unsubscribe function. */
	onMessage(cb: (msg: unknown) => void): () => void;
	/** Subscribe to connection status changes. Returns an unsubscribe function. */
	onStatus(cb: (status: NetStatus) => void): () => void;
	/** The seat assigned by the server (available after status === "ready"). */
	readonly seat: Seat | null;
	/** Close the connection. */
	close(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const WS_PORT = 3001;

/**
 * Open a connection to the relay server and return a NetHandle.
 *
 * @param roomCode 4-char room code (uppercased before sending).
 * @param role     "host" or "guest".
 *
 * URL resolution (in priority order):
 *  1. VITE_RELAY_URL env var — full origin, e.g. "wss://relay.example.com".
 *     Set this in Vercel (or any deployed host) to point at the hosted relay.
 *     It is inlined at build time by Vite, so a redeploy is needed after changes.
 *  2. LAN dev fallback — same hostname as the page, port 3001, scheme derived
 *     from the page protocol (ws:// for http:, wss:// for https:) so the
 *     connection is never mixed-content blocked.
 */
export function createNet(roomCode: string, role: NetRole): NetHandle {
	const room = roomCode.toUpperCase();
	const query = `?room=${room}&role=${role}`;

	// Prefer an explicitly configured relay URL (required for deployed/HTTPS builds).
	// Env contract: bare origin, no trailing slash, e.g. "wss://top-girls-relay.deno.dev".
	const configured = import.meta.env.VITE_RELAY_URL as string | undefined;

	let url: string;
	if (configured && configured.length > 0) {
		url = `${configured.replace(/\/$/, "")}${query}`;
	} else {
		// LAN dev fallback: same host that served the page, port 3001.
		// Derive ws/wss from the page protocol to avoid mixed-content blocks.
		const scheme = window.location.protocol === "https:" ? "wss" : "ws";
		url = `${scheme}://${window.location.hostname}:${WS_PORT}${query}`;
	}

	const ws = new WebSocket(url);

	let seat: Seat | null = null;
	const messageListeners = new Set<(msg: unknown) => void>();
	const statusListeners = new Set<(status: NetStatus) => void>();
	let currentStatus: NetStatus = "connecting";

	function setStatus(s: NetStatus) {
		currentStatus = s;
		statusListeners.forEach((cb) => cb(s));
	}

	ws.addEventListener("open", () => {
		setStatus("waiting");
	});

	ws.addEventListener("message", (event) => {
		let parsed: unknown;
		try {
			parsed = JSON.parse(event.data as string);
		} catch {
			return; // ignore unparseable frames
		}

		if (
			parsed &&
			typeof parsed === "object" &&
			(parsed as Record<string, unknown>).type === "joined"
		) {
			seat = (parsed as Record<string, unknown>).yourSeat as Seat;
			setStatus("ready");
			// Fall through — also notify any onMessage listeners so Lobby.svelte
			// can react to the "joined" event directly.
		}

		messageListeners.forEach((cb) => cb(parsed));
	});

	ws.addEventListener("close", () => setStatus("closed"));
	ws.addEventListener("error", () => setStatus("closed"));

	return {
		send(msg: unknown) {
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify(msg));
			}
		},

		onMessage(cb) {
			messageListeners.add(cb);
			return () => messageListeners.delete(cb);
		},

		onStatus(cb) {
			statusListeners.add(cb);
			// Fire immediately with current status so late subscribers don't miss it.
			cb(currentStatus);
			return () => statusListeners.delete(cb);
		},

		get seat() {
			return seat;
		},

		close() {
			ws.close();
		},
	};
}
