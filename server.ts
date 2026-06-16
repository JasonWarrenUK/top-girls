/**
 * Stars Hollow Top Trumps — LAN WebSocket relay (Bun entry point).
 *
 * A dead-simple message broker. Holds NO game state — authority lives in the
 * host browser. The server's only job is to pair two peers into a room and
 * relay messages between them.
 *
 * The pairing/relay logic lives in relay-core.ts (shared with the Deno entry
 * and the unit-test suite). This file is a thin Bun.serve adapter.
 *
 * Usage: bun run server.ts   (or bun run dev for Vite + server together)
 *
 * Connection URL: ws://<lan-ip>:3001?room=ABCD&role=host|guest
 */

import os from "os";
import { handleOpen, handleMessage, handleClose, type Role, type Room } from "./relay-core";

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
// Per-connection data attached to each WebSocket by Bun
// ---------------------------------------------------------------------------

interface ClientData {
	roomCode: string;
	role: Role;
}

// ---------------------------------------------------------------------------
// Shared room state — passed into every pure handler call
// ---------------------------------------------------------------------------

const rooms = new Map<string, Room>();

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
			handleOpen(rooms, ws.data.roomCode, ws.data.role, ws);
		},

		message(ws, data) {
			handleMessage(
				rooms,
				ws.data.roomCode,
				ws.data.role,
				typeof data === "string" ? data : data.toString(),
			);
		},

		close(ws) {
			handleClose(rooms, ws.data.roomCode, ws.data.role);
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
