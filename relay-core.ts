/**
 * Framework-free relay logic for Stars Hollow Top Trumps LAN multiplayer.
 *
 * Holds NO game state — authority lives in the host browser. The relay's
 * only job is to pair two peers into a room and forward messages between them.
 *
 * All functions are pure (no Bun/Deno globals) so they can be:
 *   • shared between the Bun entry (server.ts) and the Deno entry (relay.deno.ts),
 *   • unit-tested without a real WebSocket server.
 *
 * This mirrors the game-engine.ts extraction pattern (commit e809386).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Role = "host" | "guest";

/**
 * Minimal socket surface the relay handlers need.
 * Both Bun's ServerWebSocket and Deno's WebSocket satisfy this structurally,
 * so neither entry point needs a wrapper — pass the real socket directly.
 */
export interface PeerSocket {
	send(msg: string): void;
	close(): void;
}

export interface Peer {
	ws: PeerSocket;
	role: Role;
}

export interface Room {
	host?: Peer;
	guest?: Peer;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getOrCreateRoom(rooms: Map<string, Room>, code: string): Room {
	if (!rooms.has(code)) rooms.set(code, {});
	return rooms.get(code)!;
}

export function peerOf(room: Room, role: Role): Peer | undefined {
	return role === "host" ? room.guest : room.host;
}

/** Serialise a value and send it as a control frame. */
function send(socket: PeerSocket, msg: unknown): void {
	socket.send(JSON.stringify(msg));
}

// ---------------------------------------------------------------------------
// Core handlers — called by the thin runtime adapters in server.ts / relay.deno.ts
// ---------------------------------------------------------------------------

/**
 * Pair a connecting socket into its room.
 *
 * - Rejects a 2nd host/guest: sends an error frame and closes the socket.
 * - When both seats are filled, sends the host {type:"joined",yourSeat:0}
 *   and the guest {type:"joined",yourSeat:1}.
 *
 * Returns true if the peer was admitted, false if rejected.
 */
export function handleOpen(
	rooms: Map<string, Room>,
	roomCode: string,
	role: Role,
	socket: PeerSocket,
): boolean {
	const room = getOrCreateRoom(rooms, roomCode);

	if (role === "host") {
		if (room.host) {
			send(socket, { type: "error", message: "Room already has a host." });
			socket.close();
			return false;
		}
		room.host = { ws: socket, role: "host" };
		console.log(`[room ${roomCode}] host joined`);
	} else {
		if (room.guest) {
			send(socket, { type: "error", message: "Room already full." });
			socket.close();
			return false;
		}
		room.guest = { ws: socket, role: "guest" };
		console.log(`[room ${roomCode}] guest joined`);
	}

	// If both peers are now present, introduce them.
	if (room.host && room.guest) {
		console.log(`[room ${roomCode}] both peers connected — starting game`);
		send(room.host.ws, { type: "joined", yourSeat: 0 });
		send(room.guest.ws, { type: "joined", yourSeat: 1 });
	}

	return true;
}

/**
 * Relay a frame from `role` to its peer VERBATIM (raw string, no re-stringify).
 * Drops silently if the room is unknown or the peer has not joined yet.
 */
export function handleMessage(
	rooms: Map<string, Room>,
	roomCode: string,
	role: Role,
	data: string,
): void {
	const room = rooms.get(roomCode);
	if (!room) return;

	const peer = peerOf(room, role);
	if (!peer) return; // other player hasn't joined yet — drop

	peer.ws.send(data);
}

/**
 * Tear down on disconnect: notify the surviving peer with {type:"peerLeft"},
 * then delete the room entirely.
 */
export function handleClose(
	rooms: Map<string, Room>,
	roomCode: string,
	role: Role,
): void {
	const room = rooms.get(roomCode);
	if (!room) return;

	console.log(`[room ${roomCode}] ${role} disconnected`);

	const peer = peerOf(room, role);
	if (peer) {
		send(peer.ws, { type: "peerLeft" });
	}

	rooms.delete(roomCode);
}
