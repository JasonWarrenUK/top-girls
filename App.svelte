<script lang="ts">
  import Game from "./Game.svelte";
  import Gallery from "./Gallery.svelte";

  type Tab = "play" | "gallery";

  let tab = $state<Tab>("play");
  let sortStat = $state("name");
</script>

<div class="root">
  <header class="header">
    <h1 class="title">Stars Hollow Top Trumps</h1>
    <p class="sub">Thirty-two regulars. Six stats. One pot of coffee on the line.</p>
  </header>

  <div class="tabs" role="tablist">
    <button
      role="tab"
      aria-selected={tab === "play"}
      class="tab"
      class:on={tab === "play"}
      onclick={() => (tab = "play")}
    >
      Play
    </button>
    <button
      role="tab"
      aria-selected={tab === "gallery"}
      class="tab"
      class:on={tab === "gallery"}
      onclick={() => (tab = "gallery")}
    >
      Card gallery
    </button>
  </div>

  {#if tab === "play"}
    <Game />
  {:else}
    <Gallery bind:sortStat />
  {/if}
</div>

<style>
  .root {
    min-height: 100%;
    background:
      radial-gradient(circle at 20% 10%, #f7f0df 0%, transparent 45%),
      radial-gradient(circle at 85% 90%, #efe4cb 0%, transparent 40%),
      var(--paper);
    padding: 28px 18px 48px;
    box-sizing: border-box;
  }

  .header {
    text-align: center;
  }
  .title {
    font-family: var(--font-display, "Alfa Slab One", serif);
    font-size: clamp(28px, 6vw, 52px);
    font-weight: 400; /* Alfa Slab One has only one weight */
    letter-spacing: 1px;
    margin: 0;
    color: var(--ink);
  }
  .sub {
    margin: 6px 0 0;
    font-style: italic;
    opacity: 0.65;
    font-size: 15px;
    font-family: var(--font-body, "DM Sans", sans-serif);
  }

  .tabs {
    display: flex;
    justify-content: center;
    gap: 4px;
    margin: 20px 0 10px;
  }
  .tab {
    background: transparent;
    border: 1px solid var(--rule);
    color: var(--ink);
    font-family: var(--font-body, inherit);
    font-size: 15px;
    padding: 8px 18px;
    cursor: pointer;
    border-radius: 6px;
    opacity: 0.65;
  }
  .tab:hover {
    opacity: 0.9;
  }
  .tab:focus-visible {
    outline: 3px solid var(--coffee);
    outline-offset: 2px;
  }
  .on {
    background: var(--ink);
    color: var(--paper);
    border-color: var(--ink);
    opacity: 1;
  }
</style>
