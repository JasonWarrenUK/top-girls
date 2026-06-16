<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";
  import QRCode from "qrcode";
  import { createNet, type NetHandle, type NetStatus } from "./net";
  import Game from "./Game.svelte";

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------

  let {
    mode,
    prefillCode = "",
    onBack,
  }: {
    /** "host" = creating a room. "join" = entering a room code. */
    mode: "host" | "join";
    /** Pre-filled room code from the ?room= URL param (join flow). */
    prefillCode?: string;
    /** Called when the user wants to go back to the mode picker. */
    onBack: () => void;
  } = $props();

  // ---------------------------------------------------------------------------
  // State
  // Snapshot props at initialisation time to avoid Svelte 5 rune capture warnings.
  // ---------------------------------------------------------------------------

  // Snapshot props once at construction time; untrack() makes the intent explicit
  // to Svelte 5 and suppresses the "only captures initial value" warning.
  const initialMode = untrack(() => mode);
  const initialPrefill = untrack(() => prefillCode);

  /** 4-char room code. Generated for host, typed by guest. */
  let roomCode = $state(initialMode === "host" ? generateCode() : initialPrefill.toUpperCase());
  let codeInput = $state(initialPrefill.toUpperCase());

  let status: NetStatus = $state("connecting");
  let net: NetHandle | null = $state(null);
  let errorMsg = $state("");
  let qrDataUrl = $state("");
  let copied = $state(false);

  // Once both peers are joined, flip into game mode.
  let gameReady = $state(false);
  // Set when the opponent disconnects mid-game; forwarded to <Game> as a prop.
  let peerLeft = $state(false);
  // gameMode is the Game prop — "host" stays "host"; "join" becomes "join" (same string).
  const gameMode: "host" | "join" = initialMode;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function generateCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  /** Build the join URL the guest will open. */
  function joinUrl(code: string): string {
    return `${window.location.origin}/?room=${code}`;
  }

  async function generateQr(url: string) {
    try {
      qrDataUrl = await QRCode.toDataURL(url, {
        width: 180,
        margin: 1,
        color: { dark: "#3a2a1a", light: "#f7f0e0" },
      });
    } catch {
      qrDataUrl = "";
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(joinUrl(roomCode));
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------

  function connect(code: string) {
    if (net) net.close();
    errorMsg = "";

    const netRole = initialMode === "host" ? "host" : "guest";
    const handle = createNet(code, netRole);

    const offStatus = handle.onStatus((s) => {
      status = s;
      if (s === "closed" && !gameReady) {
        errorMsg = "Could not reach the game relay. Run \"bun run dev\" to start both the app and the relay.";
      }
    });

    const offMsg = handle.onMessage((raw) => {
      if (!raw || typeof raw !== "object") return;
      const msg = raw as Record<string, unknown>;

      if (msg.type === "error") {
        errorMsg = String(msg.message ?? "Server error.");
        handle.close();
        return;
      }

      if (msg.type === "joined") {
        gameReady = true;
      }

      if (msg.type === "peerLeft" && gameReady) {
        // Opponent disconnected mid-game — surface the banner inside <Game>.
        peerLeft = true;
      }
    });

    net = handle;

    // Trigger QR generation on host side.
    if (initialMode === "host") {
      generateQr(joinUrl(code));
    }

    return () => {
      offStatus();
      offMsg();
    };
  }

  let cleanupNet: (() => void) | null = null;

  onMount(() => {
    if (initialMode === "host") {
      cleanupNet = connect(roomCode);
    }
    // Guest waits for the user to submit the code form.
    // If a prefill code was provided (from ?room= URL), auto-submit it.
    if (initialMode === "join" && initialPrefill.length === 4) {
      codeInput = initialPrefill.toUpperCase();
      cleanupNet = connect(initialPrefill.toUpperCase());
    }
  });

  onDestroy(() => {
    cleanupNet?.();
    if (!gameReady) net?.close();
  });

  function submitJoin() {
    const code = codeInput.trim().toUpperCase();
    if (code.length !== 4) {
      errorMsg = "Room code must be 4 characters.";
      return;
    }
    roomCode = code;
    cleanupNet?.();
    cleanupNet = connect(code);
  }

  // ---------------------------------------------------------------------------
  // Status display
  // ---------------------------------------------------------------------------

  let statusLabel = $derived(
    gameReady ? "Ready!" :
    status === "connecting" ? "Connecting…" :
    status === "waiting" ? (mode === "host" ? "Waiting for opponent…" : "Waiting for host…") :
    status === "closed" ? "Relay offline" : ""
  );
</script>

{#if gameReady && net}
  <!-- Both peers joined — render the game -->
  <Game mode={gameMode} {net} {peerLeft} />
{:else}
  <div class="lobby">
    {#if mode === "host"}
      <!-- ── Host flow ────────────────────────────────────────────────────── -->
      <h2 class="lobby-title">Host a game</h2>

      <div class="code-display">
        <span class="code-label">Room code</span>
        <span class="code-value">{roomCode}</span>
      </div>

      <p class="lobby-hint">
        Share the link below with your opponent — they must be on the <strong>same WiFi</strong>.
      </p>

      <div class="share-block">
        <div class="share-url">{joinUrl(roomCode)}</div>
        <button class="btn-copy" onclick={copyLink}>
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>

      {#if qrDataUrl}
        <div class="qr-wrap">
          <img src={qrDataUrl} alt="QR code to join" class="qr" />
          <p class="qr-hint">or scan with your phone</p>
        </div>
      {/if}

      <div class="status-row">
        <span class="dot" class:pulse={status === "waiting"}></span>
        <span>{statusLabel}</span>
      </div>

    {:else}
      <!-- ── Join flow ────────────────────────────────────────────────────── -->
      <h2 class="lobby-title">Join a game</h2>

      {#if status === "connecting" || status === "waiting" || status === "ready"}
        <!-- Connected, waiting -->
        <div class="code-display">
          <span class="code-label">Room</span>
          <span class="code-value">{roomCode}</span>
        </div>
        <div class="status-row">
          <span class="dot pulse"></span>
          <span>{statusLabel}</span>
        </div>
      {:else}
        <!-- Not yet connected — show the code input -->
        <form class="join-form" onsubmit={(e) => { e.preventDefault(); submitJoin(); }}>
          <label for="code-input" class="code-label">Room code</label>
          <input
            id="code-input"
            class="code-input"
            type="text"
            maxlength={4}
            placeholder="ABCD"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck={false}
            bind:value={codeInput}
            oninput={() => { codeInput = codeInput.toUpperCase(); }}
          />
          <button class="btn-primary" type="submit">Join</button>
        </form>
      {/if}
    {/if}

    {#if errorMsg}
      <p class="error">{errorMsg}</p>
    {/if}

    <button class="btn-back" onclick={onBack}>← Back</button>
  </div>
{/if}

<style>
  .lobby {
    max-width: 420px;
    margin: 0 auto;
    padding: 24px 16px 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  .lobby-title {
    font-family: var(--font-display, "Alfa Slab One", serif);
    font-size: 26px;
    font-weight: 400;
    margin: 0;
    color: var(--ink);
    letter-spacing: 0.5px;
  }

  /* ── Room code display ─────────────────────────────────────────────── */

  .code-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .code-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 3px;
    opacity: 0.55;
    font-family: var(--font-body, inherit);
  }

  .code-value {
    font-family: var(--font-display, "Alfa Slab One", serif);
    font-size: 48px;
    letter-spacing: 10px;
    color: var(--ink);
    line-height: 1;
    /* Slightly embossed — like a diner menu code */
    text-shadow: 0 2px 0 rgba(0,0,0,0.08);
  }

  /* ── Share block ───────────────────────────────────────────────────── */

  .lobby-hint {
    text-align: center;
    font-size: 14px;
    opacity: 0.7;
    margin: 0;
    font-family: var(--font-body, inherit);
    max-width: 320px;
    line-height: 1.5;
  }

  .share-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: 100%;
    max-width: 360px;
  }

  .share-url {
    background: rgba(0,0,0,0.04);
    border: 1px solid var(--rule, #cdbfa0);
    border-radius: 6px;
    padding: 10px 14px;
    font-size: 13px;
    font-family: monospace;
    word-break: break-all;
    text-align: center;
    width: 100%;
    box-sizing: border-box;
    color: var(--ink);
    opacity: 0.85;
  }

  .btn-copy {
    background: var(--coffee, #7a4a2a);
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 9px 22px;
    font-family: var(--font-body, inherit);
    font-size: 14px;
    cursor: pointer;
    transition: background 0.12s;
    letter-spacing: 0.5px;
  }
  .btn-copy:hover {
    background: #8c5a30;
  }

  /* ── QR code ───────────────────────────────────────────────────────── */

  .qr-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .qr {
    width: 180px;
    height: 180px;
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(50, 25, 10, 0.15);
  }

  .qr-hint {
    font-size: 12px;
    opacity: 0.5;
    margin: 0;
    font-family: var(--font-body, inherit);
  }

  /* ── Status indicator ──────────────────────────────────────────────── */

  .status-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    opacity: 0.7;
    font-family: var(--font-body, inherit);
    font-style: italic;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--coffee, #7a4a2a);
    flex-shrink: 0;
  }

  .dot.pulse {
    animation: pulse 1.4s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.35; transform: scale(0.8); }
  }

  /* ── Join form ─────────────────────────────────────────────────────── */

  .join-form {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 100%;
    max-width: 260px;
  }

  .code-input {
    width: 100%;
    box-sizing: border-box;
    text-align: center;
    font-family: var(--font-display, "Alfa Slab One", serif);
    font-size: 36px;
    letter-spacing: 8px;
    padding: 12px 8px;
    border: 2px solid var(--rule, #cdbfa0);
    border-radius: 8px;
    background: #fffdf7;
    color: var(--ink);
    outline: none;
    text-transform: uppercase;
  }

  .code-input:focus {
    border-color: var(--coffee, #7a4a2a);
    box-shadow: 0 0 0 3px rgba(122, 74, 42, 0.15);
  }

  .code-input::placeholder {
    opacity: 0.2;
  }

  /* ── Shared buttons ────────────────────────────────────────────────── */

  .btn-primary {
    background: var(--diner-red, #b5302a);
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 12px 32px;
    font-family: var(--font-display, inherit);
    font-size: 16px;
    letter-spacing: 2px;
    text-transform: uppercase;
    cursor: pointer;
    box-shadow: 0 4px 0 rgba(0,0,0,0.2);
    transition: transform 0.1s, box-shadow 0.1s;
  }

  .btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 5px 0 rgba(0,0,0,0.2);
  }

  .btn-back {
    background: transparent;
    border: 1px solid var(--rule, #cdbfa0);
    border-radius: 6px;
    padding: 8px 18px;
    font-family: var(--font-body, inherit);
    font-size: 14px;
    color: var(--ink);
    cursor: pointer;
    opacity: 0.65;
    transition: opacity 0.1s;
  }

  .btn-back:hover {
    opacity: 0.9;
  }

  /* ── Error ─────────────────────────────────────────────────────────── */

  .error {
    color: var(--diner-red, #b5302a);
    font-size: 14px;
    text-align: center;
    margin: 0;
    font-family: var(--font-body, inherit);
  }

  /* ── Reduced motion ────────────────────────────────────────────────── */

  @media (prefers-reduced-motion: reduce) {
    .dot.pulse { animation: none; opacity: 0.6; }
    .btn-primary, .btn-copy { transition: none; }
  }
</style>
