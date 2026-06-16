<script lang="ts">
  import { onMount } from "svelte";
  import Atropos from "atropos";
  import "atropos/atropos.css";
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();

  let el: HTMLDivElement;

  onMount(() => {
    // Respect the user's motion preference — skip the 3D tilt entirely.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    const instance = Atropos({
      el,
      shadow: true,
      highlight: true,
      rotateXMax: 8,
      rotateYMax: 8,
      duration: 300,
      // Scale up very slightly on hover for a "picking up the card" feel.
      // atropos handles this via the scale wrapper's CSS; activeOffset controls depth.
      activeOffset: 40,
      shadowOffset: 50,
      shadowScale: 1.05,
    });

    // Track pointer position and expose as CSS custom properties so the foil
    // overlay in Card.svelte can react to tilt without accessing atropos internals.
    // --mx / --my are normalised 0–1 from the element's top-left corner.
    // --active is 1 while the pointer is inside, 0 otherwise.
    // These listeners are passive and do NOT interact with the existing
    // pointer-events workaround on the scaffold layers.
    function onMove(e: PointerEvent) {
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--mx", String((e.clientX - rect.left) / rect.width));
      el.style.setProperty("--my", String((e.clientY - rect.top) / rect.height));
    }
    function onEnter() { el.style.setProperty("--active", "1"); }
    function onLeave() { el.style.setProperty("--active", "0"); }

    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerenter", onEnter, { passive: true });
    el.addEventListener("pointerleave", onLeave, { passive: true });

    return () => {
      // Cleanup when the component unmounts (e.g. game over, tab switch).
      instance.destroy();
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
    };
  });
</script>

<!--
  Atropos requires this specific three-div structure:
    .atropos          ← perspective container; passed as `el`
      .atropos-scale  ← scale wrapper (library adds transform on hover)
        .atropos-rotate ← rotation wrapper
          .atropos-inner ← clip/overflow boundary; card content goes here

  The library injects .atropos-shadow and .atropos-highlight divs automatically.
  Elements with data-atropos-offset="N" translate forward/back on the Z axis.
-->
<div class="atropos card-tilt" bind:this={el}>
  <div class="atropos-scale">
    <div class="atropos-rotate">
      <div class="atropos-inner">
        {@render children()}
      </div>
    </div>
  </div>
</div>

<style>
  /* atropos' inner 3D scaffold must not intercept real pointer hits.
     Nested preserve-3d contexts make the browser's compositor hit-test land on
     .atropos-scale (which atropos transforms) rather than the card's buttons —
     even though document.elementFromPoint returns the button correctly (it uses
     flattened 2D geometry and doesn't model the 3D divergence).
     Fix: make the three scaffold layers pointer-transparent; restore auto on the
     direct card child. atropos listens on the outer .atropos element (which keeps
     pointer-events: auto), and events bubble from the card up to it for tilt. */
  .card-tilt :global(.atropos-scale),
  .card-tilt :global(.atropos-rotate),
  .card-tilt :global(.atropos-inner) {
    pointer-events: none;
  }
  /* Restore events on the card content, but keep the injected glare/shadow
     overlays inert — they're 200% sized and would otherwise catch all clicks. */
  .card-tilt :global(.atropos-inner) > :global(*) {
    pointer-events: auto;
  }
  .card-tilt :global(.atropos-highlight),
  .card-tilt :global(.atropos-shadow) {
    pointer-events: none;
  }

  /* Override atropos shadow to be warm wood-tinted rather than cold black. */
  .card-tilt :global(.atropos-shadow) {
    background: rgba(60, 30, 10, 0.65);
    filter: blur(22px);
  }
  /* Warm highlight glare tint (slightly golden) */
  .card-tilt :global(.atropos-highlight) {
    background-image: radial-gradient(
      circle at 50%,
      rgba(255, 235, 180, 0.22),
      transparent 55%
    );
  }
</style>
