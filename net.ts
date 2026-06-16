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
 */
export function createNet(roomCode: string, role: NetRole): NetHandle {
	const wsHost = window.location.hostname; // same machine that served the page
	const url = `ws://${wsHost}:${WS_PORT}?room=${roomCode.toUpperCase()}&role=${role}`;

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
