<script lang="ts">
  import { CARDS, STATS } from "./data";
  import Card from "./Card.svelte";

  let { sortStat = $bindable("name") }: { sortStat?: string } = $props();

  let ordered = $derived.by(() => {
    if (sortStat === "name") {
      return [...CARDS].sort((a, b) => a.name.localeCompare(b.name));
    }
    const idx = Number(sortStat);
    return [...CARDS].sort(
      (a, b) => b.s[idx] - a.s[idx] || a.name.localeCompare(b.name),
    );
  });

  let highlight = $derived(sortStat === "name" ? null : Number(sortStat));
</script>

<div class="sortbar">
  <label for="sort">Sort by</label>
  <select id="sort" bind:value={sortStat}>
    <option value="name">Name (A–Z)</option>
    {#each STATS as label, i (label)}
      <option value={String(i)}>{label} (high → low)</option>
    {/each}
  </select>
</div>

<div class="gallery">
  {#each ordered as card (card.name)}
    <div class="cell">
      <Card {card} revealStat={highlight} />
    </div>
  {/each}
</div>

<style>
  .sortbar {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    margin: 8px 0 22px;
    font-size: 15px;
  }
  .sortbar label {
    letter-spacing: 0.5px;
    opacity: 0.7;
  }
  .sortbar select {
    font-family: inherit;
    font-size: 15px;
    padding: 7px 10px;
    border: 1px solid var(--rule);
    border-radius: 6px;
    background: #fffdf7;
    color: var(--ink);
    cursor: pointer;
  }
  .sortbar select:focus-visible {
    outline: 3px solid var(--coffee);
    outline-offset: 1px;
  }

  .gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 18px;
    justify-items: center;
    max-width: 1100px;
    margin: 0 auto;
  }

  .cell {
    animation: fade 0.25s ease;
  }

  @keyframes fade {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cell {
      animation: none;
    }
  }
</style>
