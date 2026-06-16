<script lang="ts">
  import { motion } from "motion-sv";
  import {
    newGame,
    topCard,
    winnerOf,
    cpuBestStat,
    applyPick,
    cleanup,
    asView,
    type GameState,
    type Seat,
  } from "./game-engine";
  import Card from "./Card.svelte";
  import CardTilt from "./CardTilt.svelte";

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------

  let {
    mode = "cpu",
    net = null,
    peerLeft = false,
  }: {
    /** "cpu" = single-player vs Stars Hollow AI (default).
     *  "host" = LAN multiplayer host (engine runs here; guest picks arrive via net).
     *  "join" = LAN multiplayer guest (thin client; renders state from net). */
    mode?: "cpu" | "host" | "join";
    /** Net handle from Lobby.svelte; only used in host/join modes. */
    net?: { send: (msg: unknown) => void; onMessage: (cb: (msg: unknown) => void) => () => void } | null;
    /** Set by Lobby.svelte when the opponent disconnects mid-game. */
    peerLeft?: boolean;
  } = $props();

  // ---------------------------------------------------------------------------
  // Authoritative state (host & cpu modes only; join mode reads remote instead)
  // ---------------------------------------------------------------------------

  let gameState: GameState = $state(newGame());

  // Seat 0 = local player in cpu/host modes.
  // Seat 1 = opponent (CPU or remote guest).
  const mySeat: Seat = 0;

  // Derived view for the current seat — the template reads ONLY from this.
  let view = $derived(asView(gameState, mySeat));

  // ---------------------------------------------------------------------------
  // Join-mode state (thin client — no engine, no timers)
  // ---------------------------------------------------------------------------

  let remote: GameState | null = $state(null);
  let remoteView = $derived(remote ? asView(remote, 1 as Seat) : null);

  // ---------------------------------------------------------------------------
  // Timer handles
  // ---------------------------------------------------------------------------

  let revealTimer: ReturnType<typeof setTimeout> | null = null;
  let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => () => {
    if (revealTimer) clearTimeout(revealTimer);
    if (cleanupTimer) clearTimeout(cleanupTimer);
  });

  // ---------------------------------------------------------------------------
  // Net message handler (host & join modes)
  // ---------------------------------------------------------------------------

  $effect(() => {
    if (!net || mode === "cpu") return;

    const off = net.onMessage((raw: unknown) => {
      if (!raw || typeof raw !== "object") return;
      const msg = raw as Record<string, unknown>;

      if (mode === "join" && msg.type === "state") {
        remote = msg.state as GameState;
      }

      if (mode === "host" && msg.type === "pickStat") {
        // Validate before accepting: must be the guest's turn.
        if (
          gameState.phase === "choose" &&
          gameState.activeChooser === 1 &&
          winnerOf(gameState) === null
        ) {
          runPick(1, msg.stat as number);
        }
      }

      // Bug 1 fix: guest requested a new game — reset the engine and push fresh state.
      if (mode === "host" && msg.type === "reset") {
        reset();
      }

      // Bug 2 fix: guest announces itself — push current authoritative state so the
      // guest board appears immediately without waiting for the first pick.
      if (mode === "host" && msg.type === "hello") {
        broadcastState();
      }
    });

    return off;
  });

  // Bug 2 fix: guest sends "hello" once on mount so the host can reply with the
  // current game state. This is race-free: the host's onMessage listener (above)
  // is registered inside an $effect that runs on mount, and Svelte runs effects in
  // component tree order (host mounts first via Lobby's {#if gameReady}). Even if
  // there were a brief ordering gap, the relay buffers nothing — the hello is sent
  // after the host's Game mounts on the same "joined" trigger. This handshake beats
  // a one-shot host broadcast which could arrive before the guest's listener is live.
  $effect(() => {
    if (mode !== "join" || !net) return;
    net.send({ type: "hello" });
  });

  // ---------------------------------------------------------------------------
  // CPU auto-pick (cpu mode only)
  // ---------------------------------------------------------------------------

  $effect(() => {
    if (mode !== "cpu") return;
    if (gameState.phase !== "choose" || gameState.activeChooser !== 1 || winnerOf(gameState) !== null) return;

    const card = topCard(gameState, 1);
    if (!card) return;

    const id = setTimeout(() => {
      if (
        gameState.phase === "choose" &&
        gameState.activeChooser === 1 &&
        winnerOf(gameState) === null
      ) {
        runPick(1, cpuBestStat(card));
      }
    }, 800);

    return () => clearTimeout(id);
  });

  // ---------------------------------------------------------------------------
  // Core turn driver: runPick + broadcastState
  // ---------------------------------------------------------------------------

  /** Broadcast the current authoritative state to the guest (host mode only). */
  function broadcastState() {
    if (mode === "host" && net) {
      net.send({ type: "state", state: gameState });
    }
  }

  /**
   * Apply a stat pick for the given seat.
   * Used by: the human clicking a stat (seat 0), the CPU $effect (seat 1 in cpu mode),
   * and the guest's pickStat message (seat 1 in host mode).
   */
  function runPick(seat: Seat, statIndex: number) {
    if (gameState.phase !== "choose" || winnerOf(gameState) !== null) return;
    if (!topCard(gameState, 0) || !topCard(gameState, 1)) return;

    const { reveal, resolve } = applyPick(gameState, seat, statIndex);

    gameState = reveal;
    broadcastState();

    revealTimer = setTimeout(() => {
      gameState = resolve();
      broadcastState();

      cleanupTimer = setTimeout(() => {
        if (winnerOf(gameState) === null) {
          gameState = cleanup(gameState);
          broadcastState();
        }
      }, 1400);
    }, 700);
  }

  /** Called when the local human picks a stat (player-card stat buttons). */
  function onPickStat(i: number) {
    if (gameState.phase !== "choose" || gameState.activeChooser !== mySeat) return;

    if (mode === "join") {
      // Guest: send the pick to the host; the host drives the engine.
      net?.send({ type: "pickStat", stat: i });
      return;
    }

    runPick(mySeat, i);
  }

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  function reset() {
    if (revealTimer) { clearTimeout(revealTimer); revealTimer = null; }
    if (cleanupTimer) { clearTimeout(cleanupTimer); cleanupTimer = null; }
    gameState = newGame();

    if (mode === "join") {
      net?.send({ type: "reset" });
      remote = null;
    } else {
      broadcastState();
    }
  }

  // ---------------------------------------------------------------------------
  // Computed display properties (avoid duplicating logic in template)
  // ---------------------------------------------------------------------------

  // In join mode, the guest reads remoteView; in cpu/host the local view.
  let activeView = $derived(mode === "join" ? remoteView : view);

  // Stack depths capped at 5 for the pseudo-element illusion.
  let myDepth = $derived(Math.min((activeView?.myHand.length ?? 0), 5));
  let theirDepth = $derived(Math.min((activeView?.theirHand.length ?? 0), 5));

  // Spring transition for deal-in animation.
  const dealTransition = { type: "spring", stiffness: 260, damping: 26 } as const;
</script>

{#if !activeView}
  <!-- Join mode waiting for first state snapshot -->
  <p class="message">Waiting for the game to start…</p>
{:else}
  {#if peerLeft}
    <p class="message peer-left" aria-live="assertive">Opponent left the game.</p>
  {/if}

  <div class="scoreboard">
    <span>You: {activeView.myHand.length}</span>
    {#if activeView.pot.length > 0}
      <span class="pot">Pot: {activeView.pot.length}</span>
    {/if}
    <span>{mode === "cpu" ? "Stars Hollow" : "Opponent"}: {activeView.theirHand.length}</span>
  </div>

  <p class="message" aria-live="polite">{activeView.message}</p>

  {#if activeView.phase === "choose"}
    <div class="turn-badge" class:cpu-turn={!activeView.iChoose} aria-hidden="true">
      {activeView.iChoose ? "Your call" : (mode === "cpu" ? "Stars Hollow's call" : "Opponent's call")}
    </div>
  {:else}
    <div class="turn-badge revealing" aria-hidden="true">Revealing…</div>
  {/if}

  {#if activeView.gameOver}
    <div class="end">
      <h2>{activeView.iWon ? "You cleaned them out." : "They took the lot."}</h2>
      <p>
        {activeView.iWon
          ? "Lorelai would be proud. Coffee's on the house."
          : "Even Kirk wins sometimes. Rematch?"}
      </p>
    </div>
  {:else if activeView.myTop && activeView.theirTop}
    <div class="table">
      <!-- My side -->
      <div class="side">
        <span class="side-label">Your card</span>
        <div class="deck-stack" style="--depth: {myDepth}">
          {#key activeView.myTop.id}
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={dealTransition}
            >
              <CardTilt>
                <Card
                  card={activeView.myTop}
                  interactive={activeView.phase === "choose" && activeView.iChoose}
                  selectedStat={activeView.pickedStat}
                  revealStat={activeView.phase === "reveal" ? activeView.pickedStat : null}
                  onPickStat={onPickStat}
                  foil
                />
              </CardTilt>
            </motion.div>
          {/key}
        </div>
      </div>

      <div class="vs">vs</div>

      <!-- Their side -->
      <div class="side">
        <span class="side-label">Opponent</span>
        <div class="deck-stack" style="--depth: {theirDepth}">
          {#key activeView.theirTop.id}
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={dealTransition}
            >
              <Card
                card={activeView.theirTop}
                faceDown={activeView.phase === "choose"}
                revealStat={activeView.phase === "reveal" ? activeView.pickedStat : null}
              />
            </motion.div>
          {/key}
        </div>
      </div>
    </div>
  {/if}

  <button class="reset" onclick={reset}>
    {activeView.gameOver ? "New game" : "Reshuffle & restart"}
  </button>
{/if}

<style>
  .scoreboard {
    display: flex;
    justify-content: center;
    gap: 22px;
    margin: 22px 0 4px;
    font-variant-numeric: tabular-nums;
    font-size: 17px;
    letter-spacing: 0.5px;
  }
  .pot {
    color: var(--coffee);
    font-weight: 700;
  }

  .message {
    text-align: center;
    min-height: 24px;
    margin: 8px 0 6px;
    font-size: 16px;
    font-style: italic;
    font-family: var(--font-body, inherit);
  }

  .peer-left {
    color: var(--diner-red, #b5302a);
    font-style: normal;
    font-size: 14px;
    letter-spacing: 0.3px;
    min-height: auto;
    margin-bottom: 4px;
  }

  .turn-badge {
    text-align: center;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 2px;
    opacity: 0.55;
    margin: 0 0 16px;
    height: 18px;
    font-family: var(--font-body, inherit);
  }
  .turn-badge.cpu-turn {
    color: var(--coffee);
    opacity: 0.9;
    font-weight: 700;
  }
  .turn-badge.revealing {
    opacity: 0.4;
  }

  /* ── Diner-wood table ───────────────────────────────────────────────────── */
  /* Warm mahogany tones — Luke's Diner counter. Layered grain effect. */
  .table {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
    flex-wrap: wrap;
    background:
      /* SVG-based wood grain noise at low opacity */
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.35 0.05' numOctaves='4' seed='8' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3CfeBlend in='SourceGraphic' mode='multiply'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23g)' opacity='0.18'/%3E%3C/svg%3E"),
      /* directional plank grain */
      repeating-linear-gradient(
        88deg,
        transparent 0px,
        transparent 22px,
        rgba(0,0,0,0.025) 22px,
        rgba(0,0,0,0.025) 23px
      ),
      /* warm walnut base */
      linear-gradient(
        168deg,
        #7a4520 0%,
        #8c5228 18%,
        #6e3d1a 38%,
        #7d4822 58%,
        #6b3c1c 78%,
        #5c3015 100%
      );
    border-radius: 22px;
    padding: 36px 28px;
    box-shadow:
      inset 0 3px 12px rgba(0, 0, 0, 0.4),
      inset 0 -1px 6px rgba(255, 190, 110, 0.15),
      inset 0 0 80px rgba(0, 0, 0, 0.2),
      0 16px 40px rgba(50, 25, 8, 0.35);
    max-width: 700px;
    margin: 0 auto;
  }

  .side {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .side-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 3px;
    color: #e8d0a8;
    opacity: 0.75;
    font-family: var(--font-body, inherit);
  }

  .vs {
    font-style: italic;
    font-size: 24px;
    color: #c9a87a;
    opacity: 0.6;
    user-select: none;
    font-family: var(--font-body, inherit);
  }

  /* ── Deck-stack illusion ────────────────────────────────────────────────── */
  .deck-stack {
    position: relative;
    padding-right: 10px;
    padding-bottom: 10px;
  }
  /* Three layered card backs — each slightly more offset, getting fainter */
  .deck-stack::before,
  .deck-stack::after {
    content: "";
    position: absolute;
    width: 230px;
    top: 4px;
    bottom: 4px;
    left: 0;
    border-radius: 8px;
    background: #ede3cc;
    border: 1px solid #cdbfa0;
    opacity: calc(var(--depth, 0) / 5 * 0.8);
  }
  .deck-stack::before {
    transform: translate(4px, 4px) rotate(0.5deg);
    z-index: -1;
    box-shadow: 0 4px 12px rgba(60, 40, 20, 0.2);
  }
  .deck-stack::after {
    transform: translate(8px, 8px) rotate(1deg);
    z-index: -2;
    box-shadow: 0 6px 14px rgba(60, 40, 20, 0.15);
  }

  /* ── End screen ─────────────────────────────────────────────────────────── */
  .end {
    text-align: center;
    margin: 30px 0;
  }
  .end h2 {
    font-size: 26px;
    margin: 0 0 6px;
    font-family: var(--font-display, inherit);
  }
  .end p {
    font-style: italic;
    opacity: 0.75;
    margin: 0;
    font-family: var(--font-body, inherit);
  }

  /* ── Reset button — diner-menu card style ───────────────────────────────── */
  .reset {
    display: block;
    margin: 28px auto 0;
    background: var(--diner-red, #b5302a);
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 12px 28px;
    font-family: var(--font-display, inherit);
    font-size: 16px;
    letter-spacing: 2px;
    text-transform: uppercase;
    cursor: pointer;
    box-shadow: 0 4px 0 rgba(0,0,0,0.25), 0 6px 14px rgba(0,0,0,0.2);
    transition: transform 0.1s, box-shadow 0.1s;
  }
  .reset:hover {
    background: #c73830;
    transform: translateY(-2px);
    box-shadow: 0 6px 0 rgba(0,0,0,0.25), 0 8px 18px rgba(0,0,0,0.22);
  }
  .reset:active {
    transform: translateY(1px);
    box-shadow: 0 2px 0 rgba(0,0,0,0.25), 0 3px 8px rgba(0,0,0,0.18);
  }
  .reset:focus-visible {
    outline: 3px solid var(--coffee);
    outline-offset: 3px;
  }

  /* ── Reduced motion ─────────────────────────────────────────────────────── */
  @media (prefers-reduced-motion: reduce) {
    .reset {
      transition: none;
    }
  }
</style>
