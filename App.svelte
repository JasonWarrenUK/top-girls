<script lang="ts">
  import Game from "./Game.svelte";
  import Gallery from "./Gallery.svelte";
  import Lobby from "./Lobby.svelte";

  type Tab = "play" | "gallery";
  type PlayMode = "cpu" | "host" | "join";

  let tab = $state<Tab>("play");
  let sortStat = $state("name");

  // Detect ?room=CODE in the URL — auto-select join mode.
  const urlRoom = new URLSearchParams(window.location.search).get("room") ?? "";
  let playMode = $state<PlayMode>(urlRoom ? "join" : "cpu");
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
    <!-- ── Play tab: mode picker + content ───────────────────────────────── -->

    {#if playMode === "cpu"}
      <!-- Single-player vs AI — no mode picker clutter -->
      <div class="mode-bar">
        <span class="mode-label">Playing solo</span>
        <button class="mode-switch" onclick={() => (playMode = "host")}>Host LAN game</button>
        <button class="mode-switch" onclick={() => (playMode = "join")}>Join game</button>
      </div>
      <Game mode="cpu" />

    {:else if playMode === "host"}
      <Lobby mode="host" onBack={() => (playMode = "cpu")} />

    {:else if playMode === "join"}
      <Lobby
        mode="join"
        prefillCode={urlRoom}
        onBack={() => {
          // Clear the ?room= param so a page refresh doesn't re-trigger join.
          const url = new URL(window.location.href);
          url.searchParams.delete("room");
          window.history.replaceState({}, "", url.toString());
          playMode = "cpu";
        }}
      />
    {/if}

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
    font-weight: 400;
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

  /* ── Mode bar (shown in solo mode only) ─────────────────────────── */

  .mode-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin: 4px 0 12px;
    flex-wrap: wrap;
  }

  .mode-label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 2px;
    opacity: 0.4;
    font-family: var(--font-body, inherit);
  }

  .mode-switch {
    background: transparent;
    border: 1px solid var(--rule, #cdbfa0);
    border-radius: 4px;
    padding: 5px 12px;
    font-family: var(--font-body, inherit);
    font-size: 13px;
    color: var(--ink);
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 0.1s, border-color 0.1s;
    letter-spacing: 0.3px;
  }

  .mode-switch:hover {
    opacity: 1;
    border-color: var(--coffee, #7a4a2a);
  }

  .mode-switch:focus-visible {
    outline: 3px solid var(--coffee);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .mode-switch { transition: none; }
  }
</style>
