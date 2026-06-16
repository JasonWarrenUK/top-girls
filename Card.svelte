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
    foil = false,
    onPickStat,
  }: {
    card: CharacterCard;
    faceDown?: boolean;
    selectedStat?: number | null;
    revealStat?: number | null;
    interactive?: boolean;
    /** Show holographic foil shimmer on the front face (reacts to tilt from CardTilt). */
    foil?: boolean;
    onPickStat?: (i: number) => void;
  } = $props();

  function pick(i: number) {
    if (interactive) onPickStat?.(i);
  }
</script>

<!--
  Both faces always in the DOM for a true 3D CSS flip.
  .flip-inner rotates 180° when faceDown is true.
  backface-visibility ensures only the forward-facing side shows mid-spin.
-->
<div class="flip" style="--accent: {card.hex}">
  <div class="flip-inner" class:is-down={faceDown}>

    <!-- ── BACK face ─────────────────────────────────────────────────────── -->
    <div class="face back" aria-hidden={!faceDown}>
      <div class="back-frame">
        <div class="back-pattern" aria-hidden="true"></div>
        <div class="back-emblem">
          <span class="back-title">Stars</span>
          <span class="back-coffee">☕</span>
          <span class="back-title">Hollow</span>
        </div>
      </div>
    </div>

    <!-- ── FRONT face ────────────────────────────────────────────────────── -->
    <div class="face front card" aria-hidden={faceDown}>
      <!-- Accent colour banner at the top (like a real Top Trumps series band) -->
      <div class="banner">
        <span class="card-name">{card.name}</span>
      </div>

      <!-- Portrait -->
      <div class="portrait">
        <Avatar {card} size={148} />
      </div>

      <!-- Stats table -->
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

      <!-- Inner keyline — double-rule frame like a real printed card -->
      <div class="keyline" aria-hidden="true"></div>

      <!-- Holographic foil overlay — reacts to --mx/--my/--active set by CardTilt.
           Only rendered when foil prop is true. Two stacked blend layers:
           1. Iridescent sheen (color-dodge) shifts across the card face as it tilts.
           2. Sparkle grain (overlay) catches light as fine speckle. -->
      {#if foil}
        <div class="foil" aria-hidden="true"></div>
      {/if}
    </div>

  </div>
</div>

<style>
  /* ── Flip scaffold ──────────────────────────────────────────────────────── */

  .flip {
    width: 230px;
    /* Perspective on the outer wrapper; atropos adds its own on .atropos.
       When CardTilt wraps this, atropos' perspective takes precedence.
       When used standalone (gallery), this provides the flip perspective. */
    perspective: 1200px;
  }

  .flip-inner {
    position: relative;
    width: 100%;
    transform-style: preserve-3d;
    /* Weighty flip with slight overshoot at the end */
    transition: transform 0.6s cubic-bezier(0.18, 0.8, 0.28, 1.1);
    transform: rotateY(0deg);
  }

  .flip-inner.is-down {
    transform: rotateY(180deg);
  }

  .face {
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }

  /* ── BACK face ──────────────────────────────────────────────────────────── */

  .face.back {
    position: absolute;
    inset: 0;
    /* Pre-rotated so it reads correctly when the inner wrapper is at 180° */
    transform: rotateY(180deg);
    border-radius: 10px;
    overflow: hidden;
    /* The rotated-away back face must not swallow clicks meant for the front.
       backface-visibility: hidden hides it visually but does NOT prevent
       hit-testing — so we must explicitly remove pointer events. */
    pointer-events: none;
  }

  /* When face-down the roles reverse: the front is rotated away; the back
     is the visible, potentially interactive surface. */
  .flip-inner.is-down .face.front { pointer-events: none; }
  .flip-inner.is-down .face.back  { pointer-events: auto; }

  .back-frame {
    width: 100%;
    height: 100%;
    /* Deep diner-red base */
    background:
      /* Diamond grid over-print */
      repeating-linear-gradient(
        45deg,
        rgba(255, 255, 255, 0.06) 0px, rgba(255, 255, 255, 0.06) 1px,
        transparent 1px, transparent 14px
      ),
      repeating-linear-gradient(
        -45deg,
        rgba(255, 255, 255, 0.06) 0px, rgba(255, 255, 255, 0.06) 1px,
        transparent 1px, transparent 14px
      ),
      /* Base red */
      #a32820;
    border-radius: 10px;
    border: 3px solid #7a1e18;
    box-sizing: border-box;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    /* Contact shadow — the card resting on the table */
    box-shadow:
      inset 0 0 0 4px rgba(255, 255, 255, 0.12),
      0 8px 24px rgba(40, 15, 10, 0.5),
      0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .back-pattern {
    position: absolute;
    inset: 8px;
    border: 1.5px solid rgba(255, 255, 255, 0.25);
    border-radius: 6px;
  }

  .back-emblem {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    z-index: 1;
  }

  .back-title {
    font-family: var(--font-display, "Alfa Slab One", serif);
    color: rgba(255, 255, 255, 0.9);
    font-size: 18px;
    letter-spacing: 3px;
    text-transform: uppercase;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  }

  .back-coffee {
    font-size: 28px;
    filter: drop-shadow(0 1px 3px rgba(0,0,0,0.4));
  }

  /* ── FRONT face ─────────────────────────────────────────────────────────── */

  .face.front {
    position: relative; /* establishes height for the flip container */
  }

  .card {
    background: var(--diner-cream, #f7f0e0);
    border-radius: 10px;
    box-sizing: border-box;
    overflow: hidden;
    /* Multi-layer shadow for physical depth:
       1. Soft ground shadow (contact)
       2. Crisp edge line (card thickness illusion — top/right lighter, bottom/left darker)
       3. Ambient lift */
    box-shadow:
      /* card edge — left/top lighter */
      -1px -1px 0 rgba(255, 255, 255, 0.5),
      /* card edge — right/bottom darker (thickness) */
      3px 3px 0 rgba(80, 40, 20, 0.35),
      4px 5px 0 rgba(60, 30, 10, 0.2),
      /* contact + lift shadow */
      0 8px 20px rgba(50, 25, 10, 0.3),
      0 2px 6px rgba(50, 25, 10, 0.2);
  }

  /* Printed paper grain texture over the card face */
  .card::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 10px;
    /* feTurbulence SVG grain — scalable, zero raster assets */
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 10;
  }

  /* ── Accent banner ───────────────────────────────────────────────────────── */

  .banner {
    background: var(--accent, #b5485d);
    padding: 10px 12px 8px;
    /* Slightly raised on parallax tilt — the series-colour band floats above */
  }

  .card-name {
    font-family: var(--font-display, "Alfa Slab One", serif);
    font-size: 16px;
    color: #fff;
    display: block;
    text-align: center;
    line-height: 1.15;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
    min-height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ── Portrait ────────────────────────────────────────────────────────────── */

  .portrait {
    display: flex;
    justify-content: center;
    padding: 10px 10px 6px;
    background: rgba(0, 0, 0, 0.04);
    border-bottom: 1px solid var(--rule, #cdbfa0);
  }
  .portrait :global(svg),
  .portrait :global(img) {
    border-radius: 6px;
    box-shadow:
      0 2px 8px rgba(50, 25, 10, 0.2),
      inset 0 0 0 1px rgba(0, 0, 0, 0.1);
  }

  /* ── Stats table ─────────────────────────────────────────────────────────── */

  .stats {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .stat {
    border-bottom: 1px solid var(--rule, #cdbfa0);
  }
  .stat:last-child {
    border-bottom: none;
  }

  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    box-sizing: border-box;
    padding: 6px 12px;
    font-family: var(--font-body, "DM Sans", sans-serif);
    font-size: 14px;
    color: var(--ink);
    text-align: left;
    background: transparent;
    border: none;
    border-radius: 0;
    transition: background 0.12s;
  }

  .label {
    font-weight: 400;
    letter-spacing: 0.2px;
  }

  .val {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    font-size: 15px;
  }

  button.btn {
    cursor: pointer;
  }
  button.btn:hover,
  button.btn:focus-visible {
    background: rgba(0, 0, 0, 0.05);
    outline: none;
  }
  button.btn:focus-visible {
    box-shadow: inset 0 0 0 2px var(--accent);
  }

  .stat.sel .row {
    background: var(--accent);
    color: #fff;
  }
  .stat.sel {
    border-bottom-color: transparent;
  }
  .stat.sel .val {
    font-weight: 700;
  }

  /* ── Inner keyline ───────────────────────────────────────────────────────── */
  /* Double-rule frame — the tell-tale sign of a real printed card */

  .keyline {
    position: absolute;
    inset: 5px;
    border: 1px solid rgba(0, 0, 0, 0.06);
    border-radius: 7px;
    pointer-events: none;
    z-index: 5;
  }

  /* ── Holographic foil overlay ───────────────────────────────────────────── */
  /*
   * Reads --mx, --my (pointer position, 0–1) and --active (0/1) written by
   * CardTilt.svelte. Falls back to 0.5 / 0 when no CardTilt is present (gallery).
   *
   * Two pseudo-elements each with their own mix-blend-mode:
   *   ::before — warm iridescent sheen, color-dodge → glowing press-through foil.
   *   ::after  — fine sparkle grain, overlay → speckle-light on the cream surface.
   *
   * The .foil element itself is transparent; only its pseudos contribute colour.
   * Opacity on the pseudos is gated by --active (0 when pointer out, 1 when in).
   */

  .foil {
    position: absolute;
    inset: 0;
    border-radius: 10px;
    pointer-events: none;
    z-index: 6; /* above keyline (5), below grain (10) */
    overflow: hidden;
  }

  /* Sheen layer — iridescent warm-gold band that slides with pointer position */
  .foil::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: linear-gradient(
      105deg,
      transparent 15%,
      rgba(245, 217, 140, 0.6) 30%,
      rgba(255, 248, 220, 0.5) 43%,
      rgba(232, 180, 138, 0.55) 56%,
      rgba(210, 155, 90, 0.4) 68%,
      transparent 83%
    );
    background-size: 300% 300%;
    background-position: calc(var(--mx, 0.5) * 200%) calc(var(--my, 0.5) * 200%);
    mix-blend-mode: color-dodge;
    opacity: calc(var(--active, 0) * 0.9);
    transition: opacity 0.4s ease, background-position 0.05s linear;
  }

  /* Sparkle layer — fine turbulence noise catches light as tiny speckles */
  .foil::after {
    content: "";
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='s'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.85' numOctaves='1' seed='42' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23s)' opacity='0.6'/%3E%3C/svg%3E");
    background-size: 200px 200px;
    mix-blend-mode: overlay;
    opacity: calc(var(--active, 0) * 0.4);
    transition: opacity 0.4s ease;
  }

  /* ── Reduced motion ──────────────────────────────────────────────────────── */

  @media (prefers-reduced-motion: reduce) {
    .flip-inner {
      transition: none;
    }
    .row {
      transition: none;
    }
    .foil {
      display: none;
    }
  }
</style>
