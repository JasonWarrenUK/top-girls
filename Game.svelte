<script lang="ts">
  import { motion } from "motion-sv";
  import { STATS } from "./data";
  import { dealDecks, type DealtCard, type Decks } from "./deck";
  import Card from "./Card.svelte";
  import CardTilt from "./CardTilt.svelte";

  type Phase = "choose" | "reveal";

  let decks = $state<Decks>(dealDecks());
  let phase = $state<Phase>("choose");
  let pickedStat = $state<number | null>(null);
  let pot = $state<Decks["player"]>([]);
  let message = $state("Your deal. Pick the stat you fancy your chances on.");

  // Whose turn it is to pick the stat. Starts with the player; passes to the
  // winner after each round. On a draw the chooser stays the same (standard rule).
  let activeChooser = $state<"player" | "cpu">("player");

  let playerTop = $derived(decks.player[0]);
  let cpuTop = $derived(decks.cpu[0]);

  let winner = $derived.by<"player" | "cpu" | null>(() => {
    if (decks.player.length === 0) return "cpu";
    if (decks.cpu.length === 0) return "player";
    return null;
  });
  let gameOver = $derived(winner !== null);

  // Stack depths capped at 5 for the pseudo-element illusion.
  let playerDepth = $derived(Math.min(decks.player.length, 5));
  let cpuDepth = $derived(Math.min(decks.cpu.length, 5));

  // --- Reveal snapshot -------------------------------------------------------
  // During the reveal phase we show the pair that was actually contested, not
  // the live deck tops. This means that when decks mutate at the 700ms mark the
  // new top card never flashes face-up — the snapshot stays on screen until we
  // explicitly flip back to the choose phase and mount the fresh pair.
  let shownPlayer = $state<DealtCard | null>(null);
  let shownCpu = $state<DealtCard | null>(null);

  // The card rendered on each side: snapshot during reveal, live top otherwise.
  let displayPlayer = $derived(phase === "reveal" ? shownPlayer : playerTop);
  let displayCpu = $derived(phase === "reveal" ? shownCpu : cpuTop);

  // --- timer handles ---------------------------------------------------------
  let revealTimer: ReturnType<typeof setTimeout> | null = null;
  let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => () => {
    if (revealTimer) clearTimeout(revealTimer);
    if (cleanupTimer) clearTimeout(cleanupTimer);
  });

  // --- CPU auto-pick ---------------------------------------------------------
  function cpuBestStat(card: DealtCard): number {
    // Pick the column where the CPU's own card is strongest; first index on ties.
    let best = 0;
    for (let i = 1; i < card.s.length; i++) {
      if (card.s[i] > card.s[best]) best = i;
    }
    return best;
  }

  $effect(() => {
    if (phase !== "choose" || activeChooser !== "cpu" || gameOver || !cpuTop) return;
    const card = cpuTop;
    const id = setTimeout(() => {
      if (phase === "choose" && activeChooser === "cpu" && !gameOver) {
        pickStat(cpuBestStat(card));
      }
    }, 800);
    return () => clearTimeout(id);
  });

  // ---------------------------------------------------------------------------

  function pickStat(i: number) {
    if (phase !== "choose" || !playerTop || !cpuTop) return;

    // Snapshot the contested pair before any deck mutation so we keep showing
    // these exact cards throughout the reveal window.
    shownPlayer = playerTop;
    shownCpu = cpuTop;

    pickedStat = i;
    phase = "reveal";

    const mine = playerTop.s[i];
    const theirs = cpuTop.s[i];
    const stake = [playerTop, cpuTop, ...pot];

    revealTimer = setTimeout(() => {
      if (mine > theirs) {
        message = `${STATS[i]}: ${mine} beats ${theirs}. ${activeChooser === "player" ? "You take" : "Stars Hollow takes"} the cards.`;
        decks = {
          player: [...decks.player.slice(1), ...stake],
          cpu: decks.cpu.slice(1),
        };
        pot = [];
        activeChooser = "player";
      } else if (mine < theirs) {
        message = `${STATS[i]}: ${theirs} beats ${mine}. ${activeChooser === "cpu" ? "Stars Hollow takes" : "They take"} the cards.`;
        decks = {
          player: decks.player.slice(1),
          cpu: [...decks.cpu.slice(1), ...stake],
        };
        pot = [];
        activeChooser = "cpu";
      } else {
        message = `${STATS[i]}: ${mine} all. Cards held over — play again.`;
        pot = stake;
        decks = { player: decks.player.slice(1), cpu: decks.cpu.slice(1) };
        // Draw: chooser unchanged.
      }

      cleanupTimer = setTimeout(() => {
        pickedStat = null;
        if (!winner) {
          // Setting phase to "choose" switches displayPlayer/displayCpu from the
          // snapshot to the live deck tops, which mount already-face-down.
          // Clear the snapshot AFTER flipping phase so there's no intermediate
          // frame where displayCpu is null.
          phase = "choose";
          shownPlayer = null;
          shownCpu = null;
          message =
            activeChooser === "player"
              ? "Your turn. Pick a stat."
              : "Stars Hollow is choosing…";
        }
      }, 1400);
    }, 700);
  }

  function reset() {
    if (revealTimer) { clearTimeout(revealTimer); revealTimer = null; }
    if (cleanupTimer) { clearTimeout(cleanupTimer); cleanupTimer = null; }
    decks = dealDecks();
    phase = "choose";
    pickedStat = null;
    pot = [];
    activeChooser = "player";
    shownPlayer = null;
    shownCpu = null;
    message = "Fresh deal. Pick the stat you fancy your chances on.";
  }

  // Spring transition for deal-in (card slides up from below as a new hand appears).
  const dealTransition = { type: "spring", stiffness: 260, damping: 26 } as const;
</script>

<div class="scoreboard">
  <span>You: {decks.player.length}</span>
  {#if pot.length > 0}
    <span class="pot">Pot: {pot.length}</span>
  {/if}
  <span>Stars Hollow: {decks.cpu.length}</span>
</div>

<p class="message" aria-live="polite">{message}</p>

{#if phase === "choose"}
  <div class="turn-badge" class:cpu-turn={activeChooser === "cpu"} aria-hidden="true">
    {activeChooser === "player" ? "Your call" : "Stars Hollow's call"}
  </div>
{:else}
  <div class="turn-badge revealing" aria-hidden="true">Revealing…</div>
{/if}

{#if gameOver}
  <div class="end">
    <h2>{winner === "player" ? "You cleaned them out." : "They took the lot."}</h2>
    <p>
      {winner === "player"
        ? "Lorelai would be proud. Coffee's on the house."
        : "Even Kirk wins sometimes. Rematch?"}
    </p>
  </div>
{:else if displayPlayer && displayCpu}
  <div class="table">
    <!-- Player side -->
    <div class="side">
      <span class="side-label">Your card</span>
      <div class="deck-stack" style="--depth: {playerDepth}">
        <!--
          Key on card id during choose phase so a new top card triggers the
          deal-in spring. During reveal the snapshot card is stable (same id),
          so no spurious remount occurs.
        -->
        {#key displayPlayer.id}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={dealTransition}
          >
            <CardTilt>
              <Card
                card={displayPlayer}
                interactive={phase === "choose" && activeChooser === "player"}
                selectedStat={pickedStat}
                revealStat={phase === "reveal" ? pickedStat : null}
                onPickStat={pickStat}
              />
            </CardTilt>
          </motion.div>
        {/key}
      </div>
    </div>

    <div class="vs">vs</div>

    <!-- CPU side -->
    <div class="side">
      <span class="side-label">Opponent</span>
      <div class="deck-stack" style="--depth: {cpuDepth}">
        <!--
          CPU card is face-down during choose, face-up during reveal (via the
          snapshot card). Because we never key on cpuTop.id during reveal, the
          new top card does not mount until phase flips back to choose — at which
          point it mounts already face-down. No face-up flash.
        -->
        {#key displayCpu.id}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={dealTransition}
          >
            <Card
              card={displayCpu}
              faceDown={phase === "choose"}
              revealStat={phase === "reveal" ? pickedStat : null}
            />
          </motion.div>
        {/key}
      </div>
    </div>
  </div>
{/if}

<button class="reset" onclick={reset}>
  {gameOver ? "New game" : "Reshuffle & restart"}
</button>

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
