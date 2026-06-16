/**
 * Stars Hollow Top Trumps — LAN WebSocket relay.
 *
 * A dead-simple message broker. Holds NO game state — authority lives in the
 * host browser. The server's only job is to pair two peers into a room and
 * relay messages between them.
 *
 * Usage: bun run server.ts   (or bun run dev:lan for Vite + server together)
 *
 * Connection URL: ws://<lan-ip>:3001?room=ABCD&role=host|guest
 */

import os from "os";

const PORT = 3001;

// ---------------------------------------------------------------------------
// LAN IP detection
// ---------------------------------------------------------------------------

function getLanIp(): string | null {
	const ifaces = os.networkInterfaces();
	for (const name of Object.keys(ifaces)) {
		for (const iface of ifaces[name] ?? []) {
			if (!iface.internal && iface.family === "IPv4") {
				return iface.address;
			}
		}
	}
	return null;
}

// ---------------------------------------------------------------------------
// Room management
// ---------------------------------------------------------------------------

type Role = "host" | "guest";
type Peer = { ws: import("bun").ServerWebSocket<ClientData>; role: Role };

interface ClientData {
	roomCode: string;
	role: Role;
}

interface Room {
	host?: Peer;
	guest?: Peer;
}

const rooms = new Map<string, Room>();

function getOrCreateRoom(code: string): Room {
	if (!rooms.has(code)) rooms.set(code, {});
	return rooms.get(code)!;
}

function peerOf(room: Room, role: Role): Peer | undefined {
	return role === "host" ? room.guest : room.host;
}

function broadcast(
	ws: import("bun").ServerWebSocket<ClientData>,
	msg: unknown,
): void {
	ws.send(JSON.stringify(msg));
}

// ---------------------------------------------------------------------------
// Bun WebSocket server
// ---------------------------------------------------------------------------

const server = Bun.serve<ClientData>({
	port: PORT,
	fetch(req, server) {
		const url = new URL(req.url);
		const room = url.searchParams.get("room")?.toUpperCase().trim();
		const role = url.searchParams.get("role") as Role | null;

		if (!room || (role !== "host" && role !== "guest")) {
			return new Response("Missing ?room=CODE&role=host|guest", { status: 400 });
		}

		const upgraded = server.upgrade(req, { data: { roomCode: room, role } });
		if (!upgraded) return new Response("WebSocket upgrade failed", { status: 500 });
		// Bun handles the response after a successful upgrade — return undefined.
	},

	websocket: {
		open(ws) {
			const { roomCode, role } = ws.data;
			const room = getOrCreateRoom(roomCode);

			if (role === "host") {
				if (room.host) {
					// Another host already in this room — reject.
					ws.send(JSON.stringify({ type: "error", message: "Room already has a host." }));
					ws.close();
					return;
				}
				room.host = { ws, role: "host" };
				console.log(`[room ${roomCode}] host joined`);
			} else {
				if (room.guest) {
					ws.send(JSON.stringify({ type: "error", message: "Room already full." }));
					ws.close();
					return;
				}
				room.guest = { ws, role: "guest" };
				console.log(`[room ${roomCode}] guest joined`);
			}

			// If both peers are present, introduce them.
			if (room.host && room.guest) {
				console.log(`[room ${roomCode}] both peers connected — starting game`);
				broadcast(room.host.ws, { type: "joined", yourSeat: 0 });
				broadcast(room.guest.ws, { type: "joined", yourSeat: 1 });
			}
		},

		message(ws, data) {
			const { roomCode, role } = ws.data;
			const room = rooms.get(roomCode);
			if (!room) return;

			const peer = peerOf(room, role);
			if (!peer) return; // Other player hasn't joined yet — drop the message.

			// Relay verbatim: host → guest and guest → host.
			peer.ws.send(typeof data === "string" ? data : JSON.stringify(data));
		},

		close(ws) {
			const { roomCode, role } = ws.data;
			const room = rooms.get(roomCode);
			if (!room) return;

			console.log(`[room ${roomCode}] ${role} disconnected`);

			// Notify the surviving peer.
			const peer = peerOf(room, role);
			if (peer) {
				broadcast(peer.ws, { type: "peerLeft" });
			}

			// Clean up the room entirely.
			rooms.delete(roomCode);
		},
	},
});

// ---------------------------------------------------------------------------
// Boot message
// ---------------------------------------------------------------------------

const lanIp = getLanIp();
const joinUrl = lanIp ? `http://${lanIp}:5173` : "http://localhost:5173";

console.log(`
╔════════════════════════════════════════════════╗
║   Stars Hollow Top Trumps — LAN relay          ║
║   WebSocket server: ws://0.0.0.0:${PORT}           ║
║                                                ║
║   Share with your opponent (same WiFi only):   ║
║   ${joinUrl.padEnd(45)}║
╚════════════════════════════════════════════════╝
`);
