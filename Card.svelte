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

<!--
  Both faces are always in the DOM so CSS can rotate between them with a true
  3D flip. .flip-inner rotates 180° when faceDown is true; backface-visibility
  ensures only the forward-facing side is visible during the transition.

  The FRONT face is in normal flow and defines the card's height; the BACK face
  is position:absolute overlaid on top (avoiding the zero-height-parent bug that
  comes from making both faces absolute).
-->
<div class="flip" style="--accent: {card.hex}">
  <div class="flip-inner" class:is-down={faceDown}>
    <!-- BACK face — pre-rotated 180° so it reads correctly when flipped in -->
    <div class="face back" aria-hidden={!faceDown}>
      <div class="back-inner">Stars Hollow</div>
    </div>

    <!-- FRONT face — defines height; hidden from a11y when face-down -->
    <div class="face front card" aria-hidden={faceDown}>
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
  </div>
</div>

<style>
  /* ── Flip scaffold ──────────────────────────────────────────────────────── */

  .flip {
    width: 230px;
    /* perspective lives on the parent, not the rotating element */
    perspective: 1200px;
  }

  .flip-inner {
    position: relative;
    width: 100%;
    transform-style: preserve-3d;
    transition: transform 0.55s cubic-bezier(0.2, 0.7, 0.2, 1);
    transform: rotateY(0deg); /* face-up by default */
  }

  .flip-inner.is-down {
    transform: rotateY(180deg); /* face-down: back is showing */
  }

  .face {
    /* hide whichever side is pointing away from the viewer */
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }

  .face.back {
    position: absolute;
    inset: 0;
    /* pre-rotate so it reads the right way round when .flip-inner is at 180° */
    transform: rotateY(180deg);
    border-radius: 8px;
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

  /* ── Card face ──────────────────────────────────────────────────────────── */

  .face.front {
    /* stays in normal flow — defines the card's height for the flip container */
    position: relative;
  }

  .card {
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
  .portrait :global(svg),
  .portrait :global(img) {
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

  /* ── Reduced motion ─────────────────────────────────────────────────────── */

  @media (prefers-reduced-motion: reduce) {
    .flip-inner {
      transition: none; /* instant swap, no spin */
    }
    .stat {
      transition: none;
    }
  }
</style>
