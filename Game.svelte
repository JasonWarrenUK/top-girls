<script lang="ts">
  import { STATS } from "./data";
  import { dealDecks, type Decks } from "./deck";
  import Card from "./Card.svelte";

  type Phase = "choose" | "reveal";

  let decks = $state<Decks>(dealDecks());
  let phase = $state<Phase>("choose");
  let pickedStat = $state<number | null>(null);
  let pot = $state<Decks["player"]>([]);
  let message = $state("Your deal. Pick the stat you fancy your chances on.");

  let playerTop = $derived(decks.player[0]);
  let cpuTop = $derived(decks.cpu[0]);

  let winner = $derived.by<"player" | "cpu" | null>(() => {
    if (decks.player.length === 0) return "cpu";
    if (decks.cpu.length === 0) return "player";
    return null;
  });
  let gameOver = $derived(winner !== null);

  function pickStat(i: number) {
    if (phase !== "choose" || !playerTop || !cpuTop) return;

    pickedStat = i;
    phase = "reveal";

    const mine = playerTop.s[i];
    const theirs = cpuTop.s[i];
    const stake = [playerTop, cpuTop, ...pot];

    setTimeout(() => {
      if (mine > theirs) {
        message = `${STATS[i]}: ${mine} beats ${theirs}. You take the cards.`;
        decks = {
          player: [...decks.player.slice(1), ...stake],
          cpu: decks.cpu.slice(1),
        };
        pot = [];
      } else if (mine < theirs) {
        message = `${STATS[i]}: ${theirs} beats ${mine}. They take the cards.`;
        decks = {
          player: decks.player.slice(1),
          cpu: [...decks.cpu.slice(1), ...stake],
        };
        pot = [];
      } else {
        message = `${STATS[i]}: ${mine} all. Cards held over — play again.`;
        pot = stake;
        decks = { player: decks.player.slice(1), cpu: decks.cpu.slice(1) };
      }

      setTimeout(() => {
        pickedStat = null;
        if (!winner) {
          phase = "choose";
          message = "Your turn. Pick a stat.";
        }
      }, 1400);
    }, 700);
  }

  function reset() {
    decks = dealDecks();
    phase = "choose";
    pickedStat = null;
    pot = [];
    message = "Fresh deal. Pick the stat you fancy your chances on.";
  }
</script>

<div class="scoreboard">
  <span>You: {decks.player.length}</span>
  {#if pot.length > 0}
    <span class="pot">Pot: {pot.length}</span>
  {/if}
  <span>Stars Hollow: {decks.cpu.length}</span>
</div>

<p class="message" aria-live="polite">{message}</p>

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
    <div class="side">
      <span class="side-label">Your card</span>
      <Card
        card={playerTop}
        interactive={phase === "choose"}
        selectedStat={pickedStat}
        revealStat={phase === "reveal" ? pickedStat : null}
        onPickStat={pickStat}
      />
    </div>
    <div class="vs">vs</div>
    <div class="side">
      <span class="side-label">Opponent</span>
      <Card
        card={cpuTop}
        faceDown={phase === "choose"}
        revealStat={phase === "reveal" ? pickedStat : null}
      />
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
    margin: 8px 0 18px;
    font-size: 16px;
    font-style: italic;
  }

  .table {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    flex-wrap: wrap;
  }
  .side {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .side-label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 2px;
    opacity: 0.55;
  }
  .vs {
    font-style: italic;
    font-size: 20px;
    opacity: 0.5;
  }

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
</style>
