<script lang="ts">
  import type { CharacterCard } from "./data";
  import { initials, lighten, gradientId, imageSrc } from "./avatar";

  let { card, size = 160 }: { card: CharacterCard; size?: number } = $props();

  let gid = $derived(gradientId(card));
  let src = $derived(imageSrc(card));

  // Start optimistic — attempt the portrait image. The onerror handler below
  // flips this to false so the generated SVG avatar renders instead.
  let useImage = $state(true);

  // Re-arm when the top card changes (the game reuses this component across
  // rounds, so a new card needs a fresh attempt at its own portrait).
  $effect(() => {
    void card;
    useImage = true;
  });
</script>

{#if useImage}
  <img
    class="portrait-img"
    {src}
    width={size}
    height={size}
    alt={card.name}
    loading="lazy"
    onerror={() => (useImage = false)}
  />
{:else}
  <svg width={size} height={size} viewBox="0 0 160 160" role="img" aria-label={card.name}>
    <defs>
      <radialGradient id={gid} cx="50%" cy="38%" r="70%">
        <stop offset="0%" stop-color={lighten(card.hex, 55)} />
        <stop offset="100%" stop-color={card.hex} />
      </radialGradient>
    </defs>

    <rect x="0" y="0" width="160" height="160" rx="10" fill="url(#{gid})" />

    <!-- steam curls, nodding to the coffee theme -->
    <path
      d="M40 130 q-10 -18 6 -30 q12 -9 4 -24"
      fill="none"
      stroke={lighten(card.hex, 90)}
      stroke-opacity="0.35"
      stroke-width="4"
      stroke-linecap="round"
    />
    <path
      d="M120 132 q10 -18 -6 -30 q-12 -9 -4 -24"
      fill="none"
      stroke={lighten(card.hex, 90)}
      stroke-opacity="0.35"
      stroke-width="4"
      stroke-linecap="round"
    />

    <text
      x="80"
      y="92"
      text-anchor="middle"
      font-family="Georgia, serif"
      font-size="56"
      font-weight="700"
      fill="#fff"
      fill-opacity="0.95"
    >
      {initials(card.name)}
    </text>
  </svg>
{/if}

<style>
  .portrait-img {
    width: 150px;
    height: 150px;
    object-fit: cover;
    object-position: 50% 30%; /* bias upper-middle — better for faces */
    border-radius: 8px;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
    display: block;
  }
</style>
