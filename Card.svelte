<script lang="ts">
  import type { CharacterCard } from "./data";
  import { STATS } from "./data";
  import Avatar from "./Avatar.svelte";

  let {
    card,
    faceDown = false,
    selectedStat = null,
    revealStat = null,
    interactive = false,
    onPickStat,
  }: {
    card: CharacterCard;
    faceDown?: boolean;
    selectedStat?: number | null;
    revealStat?: number | null;
    interactive?: boolean;
    onPickStat?: (i: number) => void;
  } = $props();

  function pick(i: number) {
    if (interactive) onPickStat?.(i);
  }
</script>

{#if faceDown}
  <div class="card back">
    <div class="back-inner">Stars Hollow</div>
  </div>
{:else}
  <div class="card" style="--accent: {card.hex}">
    <div class="name">{card.name}</div>
    <div class="portrait">
      <Avatar {card} size={150} />
    </div>
    <ul class="stats">
      {#each STATS as label, i (label)}
        {@const sel = selectedStat === i || revealStat === i}
        <li class="stat" class:sel>
          {#if interactive}
            <button type="button" class="row btn" onclick={() => pick(i)}>
              <span class="label">{label}</span>
              <span class="val">{card.s[i]}</span>
            </button>
          {:else}
            <span class="row">
              <span class="label">{label}</span>
              <span class="val">{card.s[i]}</span>
            </span>
          {/if}
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .card {
    width: 230px;
    background: #fffdf7;
    border: 1px solid var(--rule);
    border-top: 6px solid var(--accent, #b5485d);
    border-radius: 8px;
    box-shadow: 0 10px 24px rgba(60, 45, 25, 0.16);
    padding: 14px 14px 10px;
    box-sizing: border-box;
  }

  .name {
    font-weight: 700;
    font-size: 18px;
    text-align: center;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1.1;
  }

  .portrait {
    display: flex;
    justify-content: center;
    margin: 4px 0 10px;
  }
  .portrait :global(svg) {
    border-radius: 8px;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
  }

  .stats {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .stat {
    border-bottom: 1px dotted var(--rule);
  }
  .stat:last-child {
    border-bottom: none;
  }

  /* shared layout for both the static span and the interactive button */
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    box-sizing: border-box;
    padding: 7px 10px;
    font: inherit;
    font-size: 15px;
    color: inherit;
    text-align: left;
    background: transparent;
    border: none;
    border-radius: 5px;
    transition: background 0.15s;
  }

  .val {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  button.btn {
    cursor: pointer;
  }
  button.btn:hover,
  button.btn:focus-visible {
    background: #f0e6cd;
    outline: none;
  }
  button.btn:focus-visible {
    box-shadow: 0 0 0 2px var(--accent);
  }

  .stat.sel .row {
    background: var(--accent);
    color: #fff;
  }
  .stat.sel {
    border-bottom-color: transparent;
  }

  .back {
    min-height: 360px;
    background: repeating-linear-gradient(
      45deg,
      #b5485d,
      #b5485d 12px,
      #a84055 12px,
      #a84055 24px
    );
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .back-inner {
    color: #fff;
    font-style: italic;
    font-size: 20px;
    border: 2px solid rgba(255, 255, 255, 0.6);
    padding: 10px 18px;
    border-radius: 6px;
    letter-spacing: 1px;
  }

  @media (prefers-reduced-motion: reduce) {
    .stat {
      transition: none;
    }
  }
</style>
