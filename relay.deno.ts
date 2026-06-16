/**
 * Stars Hollow Top Trumps — WebSocket relay (Deno Deploy entry point).
 *
 * This is the thin Deno adapter that pairs with relay-core.ts. The
 * pairing/relay/disconnect logic lives entirely in relay-core.ts and is
 * shared with the Bun entry (server.ts) and the unit-test suite.
 *
 * Deploy this file to Deno Deploy, then set VITE_RELAY_URL in your Vercel
 * project to the resulting wss://… URL so the browser client can reach it.
 *
 * Local dev: use server.ts via "bun run dev" instead — it starts alongside
 * Vite automatically. This file is only needed for the deployed relay.
 */

import {
	handleOpen,
	handleMessage,
	handleClose,
	type Room,
} from "./relay-core.ts";

const rooms = new Map<string, Room>();

Deno.serve((req: Request): Response => {
	const url = new URL(req.url);
	const room = url.searchParams.get("room")?.toUpperCase().trim();
	const role = url.searchParams.get("role");

	if (!room || (role !== "host" && role !== "guest")) {
		return new Response("Missing ?room=CODE&role=host|guest", { status: 400 });
	}

	// Upgrade to a WebSocket connection.
	let socket: WebSocket;
	let response: Response;
	try {
		({ socket, response } = Deno.upgradeWebSocket(req));
	} catch {
		return new Response("WebSocket upgrade failed", { status: 500 });
	}

	// Capture room/role in the closure so each connection owns its identity.
	const roomCode = room;
	const peerRole = role as "host" | "guest";

	socket.onopen = () => {
		handleOpen(rooms, roomCode, peerRole, {
			send: (msg) => socket.send(msg),
			close: () => socket.close(),
		});
	};

	socket.onmessage = (event: MessageEvent) => {
		const data = typeof event.data === "string" ? event.data : "";
		handleMessage(rooms, roomCode, peerRole, data);
	};

	socket.onclose = () => {
		handleClose(rooms, roomCode, peerRole);
	};

	socket.onerror = () => {
		handleClose(rooms, roomCode, peerRole);
	};

	return response;
});
