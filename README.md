# Stars Hollow Top Trumps

A Top Trumps game for 32 Gilmore Girls characters. Svelte 5 (runes) + TypeScript + Vite.

## Run

```bash
npm install
npm run dev
```

Then open the printed localhost URL.

## Scripts

- `npm run dev` — dev server with HMR
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the built bundle
- `npm run check` — `svelte-check` (types + a11y diagnostics)

## Layout

```
src/
  main.ts          mount entry
  app.css          global palette (--paper/--ink/--rule/--coffee) + body reset
  App.svelte       shell: header, Play/Gallery tabs
  lib/
    data.ts        STATS, CharacterCard type, the 32-card deck
    deck.ts        shuffle + deal
    avatar.ts      initials, lighten, gradientId helpers
    Avatar.svelte  generated SVG portrait
    Card.svelte    card face (used by both game and gallery)
    Game.svelte    play loop, scoreboard, win/draw/pot logic
    Gallery.svelte all 32 cards, sortable by stat or name
```

## Notes for hacking on it

- **Stats** live as a flat `s: [Wit, Coffee, Drama, Book Smarts, Charm, Peppiness]`
  array per card in `data.ts`, each 0–10, distributed on a per-stat bell curve.
- **Game state** is all `$state` in `Game.svelte`; `winner`/`gameOver` are
  `$derived`, so there's no done-phase flag to keep in sync.
- **CPU has no strategy** — you pick the stat every round. To use the real
  ruleset (last round's winner chooses), hand stat-selection to the winner in
  `Game.svelte`.
- **Avatars are generated** (initials + colour + steam curls), no external
  images, so nothing can 404.
