/**
 * Unit tests for the WebSocket relay protocol (relay-core.ts).
 *
 * Tests the pairing, rejection, relay, and disconnect invariants using a
 * fake socket that captures sent frames verbatim. No Bun/Deno globals needed.
 *
 * Mirrors the game-engine.test.ts pattern: fresh state per test, no shared
 * mutable singletons, vitest describe/it conventions.
 */

import { describe, it, expect } from "vitest";
import {
	handleOpen,
	handleMessage,
	handleClose,
	type Room,
	type PeerSocket,
} from "./relay-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A PeerSocket implementation that records every raw frame sent and whether
 * it was closed. Tests assert on raw strings for relay frames (verbatim) and
 * use json() for control frames (authored by the handlers).
 */
function fakeSocket() {
	const raw: string[] = [];
	let closed = false;
	const socket: PeerSocket = {
		send(msg: string) { raw.push(msg); },
		close() { closed = true; },
	};
	return {
		socket,
		raw,
		/** Parse every captured frame as JSON (for control frames authored by handlers). */
		json(): unknown[] { return raw.map((s) => JSON.parse(s)); },
		/** Last parsed frame, convenience accessor. */
		get last(): unknown { return JSON.parse(raw[raw.length - 1]); },
		get closed(): boolean { return closed; },
	};
}

/** Build a fresh room map for each test — no cross-test state bleed. */
function freshRooms(): Map<string, Room> {
	return new Map<string, Room>();
}

const CODE = "ABCD";

// ---------------------------------------------------------------------------
// 1. Pairing
// ---------------------------------------------------------------------------

describe("handleOpen — pairing", () => {
	it("first peer (host) is admitted with no 'joined' frame yet", () => {
		const rooms = freshRooms();
		const h = fakeSocket();

		const admitted = handleOpen(rooms, CODE, "host", h.socket);

		expect(admitted).toBe(true);
		expect(h.raw).toHaveLength(0);           // no joined frame yet
		expect(rooms.get(CODE)?.host).toBeDefined();
		expect(rooms.get(CODE)?.guest).toBeUndefined();
	});

	it("first peer (guest) is admitted with no 'joined' frame yet", () => {
		const rooms = freshRooms();
		const g = fakeSocket();

		const admitted = handleOpen(rooms, CODE, "guest", g.socket);

		expect(admitted).toBe(true);
		expect(g.raw).toHaveLength(0);
		expect(rooms.get(CODE)?.guest).toBeDefined();
		expect(rooms.get(CODE)?.host).toBeUndefined();
	});

	it("host-first then guest → host gets yourSeat:0, guest gets yourSeat:1", () => {
		const rooms = freshRooms();
		const h = fakeSocket();
		const g = fakeSocket();

		handleOpen(rooms, CODE, "host", h.socket);
		handleOpen(rooms, CODE, "guest", g.socket);

		expect(h.last).toEqual({ type: "joined", yourSeat: 0 });
		expect(g.last).toEqual({ type: "joined", yourSeat: 1 });
	});

	it("guest-first then host → host still gets yourSeat:0, guest yourSeat:1", () => {
		const rooms = freshRooms();
		const h = fakeSocket();
		const g = fakeSocket();

		handleOpen(rooms, CODE, "guest", g.socket);
		handleOpen(rooms, CODE, "host", h.socket);

		expect(h.last).toEqual({ type: "joined", yourSeat: 0 });
		expect(g.last).toEqual({ type: "joined", yourSeat: 1 });
	});
});

// ---------------------------------------------------------------------------
// 2. Rejection
// ---------------------------------------------------------------------------

describe("handleOpen — rejection", () => {
	it("rejects a 2nd host with an error frame, closes the socket, returns false", () => {
		const rooms = freshRooms();
		const h1 = fakeSocket();
		const h2 = fakeSocket();

		handleOpen(rooms, CODE, "host", h1.socket);
		const admitted = handleOpen(rooms, CODE, "host", h2.socket);

		expect(admitted).toBe(false);
		expect(h2.last).toEqual({ type: "error", message: "Room already has a host." });
		expect(h2.closed).toBe(true);
		// Original host is retained.
		expect(rooms.get(CODE)?.host?.ws).toBe(h1.socket);
	});

	it("rejects a 2nd guest with an error frame and closes the socket", () => {
		const rooms = freshRooms();
		const g1 = fakeSocket();
		const g2 = fakeSocket();

		handleOpen(rooms, CODE, "guest", g1.socket);
		const admitted = handleOpen(rooms, CODE, "guest", g2.socket);

		expect(admitted).toBe(false);
		expect(g2.last).toEqual({ type: "error", message: "Room already full." });
		expect(g2.closed).toBe(true);
		expect(rooms.get(CODE)?.guest?.ws).toBe(g1.socket);
	});
});

// ---------------------------------------------------------------------------
// 3. Relay
// ---------------------------------------------------------------------------

describe("handleMessage — relay", () => {
	/** Helper: pair a host and guest and clear their initial 'joined' frames. */
	function pairedRoom() {
		const rooms = freshRooms();
		const h = fakeSocket();
		const g = fakeSocket();
		handleOpen(rooms, CODE, "host", h.socket);
		handleOpen(rooms, CODE, "guest", g.socket);
		// Clear the joined control frames so relay assertions are unambiguous.
		h.raw.length = 0;
		g.raw.length = 0;
		return { rooms, h, g };
	}

	it("forwards a host frame to the guest VERBATIM (exact string identity)", () => {
		const { rooms, h, g } = pairedRoom();
		const payload = JSON.stringify({ type: "state", n: 42 });

		handleMessage(rooms, CODE, "host", payload);

		expect(g.raw).toHaveLength(1);
		expect(g.raw[0]).toBe(payload);   // verbatim — same string, not re-serialised
		expect(h.raw).toHaveLength(0);    // host receives nothing
	});

	it("forwards a guest frame to the host VERBATIM", () => {
		const { rooms, h, g } = pairedRoom();
		const payload = JSON.stringify({ type: "pickStat", stat: 2 });

		handleMessage(rooms, CODE, "guest", payload);

		expect(h.raw).toHaveLength(1);
		expect(h.raw[0]).toBe(payload);
		expect(g.raw).toHaveLength(0);
	});

	it("drops a message sent before the peer joins — no throw", () => {
		const rooms = freshRooms();
		const h = fakeSocket();
		handleOpen(rooms, CODE, "host", h.socket);
		h.raw.length = 0;

		expect(() =>
			handleMessage(rooms, CODE, "host", JSON.stringify({ type: "state" })),
		).not.toThrow();

		expect(h.raw).toHaveLength(0);
	});

	it("drops a message for an unknown room — no throw", () => {
		const rooms = freshRooms();

		expect(() =>
			handleMessage(rooms, "ZZZZ", "host", "{}"),
		).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// 4. Disconnect
// ---------------------------------------------------------------------------

describe("handleClose — disconnect", () => {
	function pairedRoom() {
		const rooms = freshRooms();
		const h = fakeSocket();
		const g = fakeSocket();
		handleOpen(rooms, CODE, "host", h.socket);
		handleOpen(rooms, CODE, "guest", g.socket);
		h.raw.length = 0;
		g.raw.length = 0;
		return { rooms, h, g };
	}

	it("notifies the surviving guest with {type:'peerLeft'} when host disconnects", () => {
		const { rooms, g } = pairedRoom();

		handleClose(rooms, CODE, "host");

		expect(g.last).toEqual({ type: "peerLeft" });
	});

	it("notifies the surviving host with {type:'peerLeft'} when guest disconnects", () => {
		const { rooms, h } = pairedRoom();

		handleClose(rooms, CODE, "guest");

		expect(h.last).toEqual({ type: "peerLeft" });
	});

	it("deletes the room after any disconnect", () => {
		const { rooms } = pairedRoom();

		handleClose(rooms, CODE, "host");

		expect(rooms.has(CODE)).toBe(false);
	});

	it("closing when the peer hasn't joined yet removes the room and notifies nobody", () => {
		const rooms = freshRooms();
		const h = fakeSocket();
		handleOpen(rooms, CODE, "host", h.socket);
		h.raw.length = 0;

		handleClose(rooms, CODE, "host");

		expect(rooms.has(CODE)).toBe(false);
		expect(h.raw).toHaveLength(0);  // the departing peer gets nothing
	});

	it("is a no-op for an unknown room — no throw", () => {
		const rooms = freshRooms();

		expect(() => handleClose(rooms, "ZZZZ", "host")).not.toThrow();
	});
});
