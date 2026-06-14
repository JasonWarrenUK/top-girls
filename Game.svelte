<script lang="ts">
  import { motion, AnimatePresence } from "motion-sv";
  import { STATS } from "./data";
  import { dealDecks, type DealtCard, type Decks } from "./deck";
  import Card from "./Card.svelte";

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

  // --- timer handles for pickStat's two nested setTimeouts ----------------
  let revealTimer: ReturnType<typeof setTimeout> | null = null;
  let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => () => {
    if (revealTimer) clearTimeout(revealTimer);
    if (cleanupTimer) clearTimeout(cleanupTimer);
  });

  // --- CPU auto-pick -------------------------------------------------------
  function cpuBestStat(card: DealtCard): number {
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

  // -------------------------------------------------------------------------

  function pickStat(i: number) {
    if (phase !== "choose" || !playerTop || !cpuTop) return;

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
          phase = "choose";
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
    message = "Fresh deal. Pick the stat you fancy your chances on.";
  }

  // Spring transition for deal-in (card slides up from below as a new hand appears).
  const dealTransition = { type: "spring", stiffness: 280, damping: 24 } as const;
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
{:else if playerTop && cpuTop}
  <div class="table">
    <!-- Player side -->
    <div class="side">
      <span class="side-label">Your card</span>
      <!-- deck-stack: CSS pseudo-elements offset behind the live card -->
      <div class="deck-stack" style="--depth: {playerDepth}">
        <!--
          Key on the card id so Svelte mounts a fresh element each round,
          triggering the motion-sv deal-in transition.
        -->
        {#key playerTop.id}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={dealTransition}
            whileHover={{ y: -6 }}
          >
            <Card
              card={playerTop}
              interactive={phase === "choose" && activeChooser === "player"}
              selectedStat={pickedStat}
              revealStat={phase === "reveal" ? pickedStat : null}
              onPickStat={pickStat}
            />
          </motion.div>
        {/key}
      </div>
    </div>

    <div class="vs">vs</div>

    <!-- CPU side -->
    <div class="side">
      <span class="side-label">Opponent</span>
      <div class="deck-stack" style="--depth: {cpuDepth}">
        {#key cpuTop.id}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={dealTransition}
          >
            <Card
              card={cpuTop}
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
  }

  .turn-badge {
    text-align: center;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 2px;
    opacity: 0.55;
    margin: 0 0 16px;
    height: 18px;
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
  /* Warm mahogany/walnut tones — nod to Luke's Diner counter. */
  .table {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
    flex-wrap: wrap;
    background:
      /* subtle vertical grain overlay */
      repeating-linear-gradient(
        90deg,
        transparent,
        transparent 18px,
        rgba(0, 0, 0, 0.02) 18px,
        rgba(0, 0, 0, 0.02) 19px
      ),
      /* base warm walnut gradient */
      linear-gradient(
        170deg,
        #6b3c1e 0%,
        #7d4a25 25%,
        #6a3a1c 50%,
        #7a4620 75%,
        #5e3317 100%
      );
    border-radius: 20px;
    padding: 32px 24px;
    box-shadow:
      inset 0 2px 8px rgba(0, 0, 0, 0.35),
      inset 0 -2px 4px rgba(255, 200, 140, 0.12),
      0 14px 32px rgba(60, 30, 10, 0.3);
    max-width: 680px;
    margin: 0 auto;
  }

  .side {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .side-label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 2px;
    /* light parchment against the dark wood */
    color: #e8d5b5;
    opacity: 0.8;
  }

  .vs {
    font-style: italic;
    font-size: 22px;
    /* warm cream against the wood */
    color: #d4b896;
    opacity: 0.7;
    user-select: none;
  }

  /* ── Deck-stack illusion ────────────────────────────────────────────────── */
  /* Pseudo-elements draw offset copies behind the live card to suggest
     a stack of remaining cards. --depth caps at 5 from the derived above. */
  .deck-stack {
    position: relative;
    /* extra padding-right/bottom to give the offset layers space */
    padding-right: 8px;
    padding-bottom: 8px;
  }
  .deck-stack::before,
  .deck-stack::after {
    content: "";
    position: absolute;
    /* match the card's size */
    width: 230px;
    top: 4px;
    bottom: 4px;
    left: 0;
    border-radius: 8px;
    background: #efe6cf;
    border: 1px solid var(--rule, #cdbfa0);
    box-shadow: 0 4px 10px rgba(60, 45, 25, 0.12);
    /* only show the stack layers when there are enough cards */
    opacity: calc(var(--depth) / 5 * 0.85);
  }
  .deck-stack::before {
    transform: translate(3px, 3px);
    z-index: -1;
  }
  .deck-stack::after {
    transform: translate(6px, 6px);
    z-index: -2;
  }

  /* ── End screen ─────────────────────────────────────────────────────────── */
  .end {
    text-align: center;
    margin: 30px 0;
  }
  .end h2 {
    font-size: 26px;
    margin: 0 0 6px;
  }
  .end p {
    font-style: italic;
    opacity: 0.75;
    margin: 0;
  }

  /* ── Reset button ───────────────────────────────────────────────────────── */
  .reset {
    display: block;
    margin: 26px auto 0;
    background: var(--ink);
    color: var(--paper);
    border: none;
    border-radius: 6px;
    padding: 11px 22px;
    font-family: inherit;
    font-size: 15px;
    cursor: pointer;
    letter-spacing: 0.5px;
  }
  .reset:hover {
    background: #463524;
  }
  .reset:focus-visible {
    outline: 3px solid var(--coffee);
    outline-offset: 2px;
  }

  /* ── Reduced motion ─────────────────────────────────────────────────────── */
  @media (prefers-reduced-motion: reduce) {
    .deck-stack::before,
    .deck-stack::after {
      /* keep the stack visual, just don't animate */
      transition: none;
    }
  }
</style>
