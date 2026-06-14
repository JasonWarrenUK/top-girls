# Stars Hollow Top Trumps

A Top Trumps game for 32 Gilmore Girls characters. Svelte 5 (runes) + TypeScript + Vite.

## Run

```bash
bun install
bun run dev
```

Then open the printed localhost URL.

## Scripts

- `bun run dev` — dev server with HMR
- `bun run build` — production build to `dist/`
- `bun run preview` — serve the built bundle
- `bun run check` — `svelte-check` (types + a11y diagnostics)

## Layout

```
index.html         shell HTML, mounts #app
main.ts            mount entry
app.css            global palette (--paper/--ink/--rule/--coffee) + body reset
App.svelte         shell: header, Play/Gallery tabs
data.ts            STATS, CharacterCard type, the 32-card deck
deck.ts            shuffle + deal
avatar.ts          initials, lighten, gradientId helpers
Avatar.svelte      generated SVG portrait
Card.svelte        card face (used by both game and gallery)
Game.svelte        play loop, scoreboard, win/draw/pot logic
Gallery.svelte     all 32 cards, sortable by stat or name
```

## Adding real character art (optional)

Generated avatars show by default — nothing 404s out of the box. To swap in
a real photo for any character:

1. Create (or use the existing) `public/cards/` folder — Vite serves it at the
   site root with no config.
2. Drop an image named after the character's **slug**: lowercase name, spaces and
   punctuation replaced with hyphens. Examples:
   ```
   public/cards/lorelai-gilmore.jpg
   public/cards/sookie-st-james.jpg
   public/cards/sebastian-digger-stiles.jpg
   ```
3. Reload the dev server. Cards with a matching file show the photo; the rest
   keep the generated avatar automatically.

The default format is `.jpg`. For `.png` or a different filename, set `img:` on
that card in `data.ts`:
```ts
{ name: "Paris Geller", hex: "#8a3a4a", s: [...], img: "/cards/paris.png" }
```

**Legal note:** this repo ships **no** character images. Add only assets you have
the right to use. `public/cards/` is gitignored, so your local art is never
committed to version control.

---

## Notes for hacking on it

- **Stats** live as a flat `s: [Wit, Coffee, Drama, Book Smarts, Charm, Peppiness]`
  array per card in `data.ts`, each 0–10, distributed on a per-stat bell curve.
- **Game state** is all `$state` in `Game.svelte`; `winner`/`gameOver` are
  `$derived`, so there's no done-phase flag to keep in sync.
- **Turn rule:** the winner of each round picks the next stat. The CPU uses its
  own card's highest stat as its strategy. See `Game.svelte` (`activeChooser`).
- **Avatars are generated** (initials + colour + steam curls) unless a portrait
  image exists at `public/cards/{slug}.jpg` — see "Adding real character art" above.
