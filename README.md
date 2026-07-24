# Efficient Bingo

An Old School RuneScape bingo-board points/hour calculator. Set your kill
speed per boss/activity and it tells you, in real time, which activity is
worth doing next to finish your board fastest — using real drop rates pulled
from the OSRS Wiki, not guesses.

**Live:** https://opoz.github.io/efficient-bingo/

## What it does

- Load a bingo board (`data/tile_requirements.json`) and see every tile's
  requirements, tracked as progress bars you can bump manually or drive from
  the activity list.
- Every OSRS monster/activity that drops something a tile tracks shows up as
  a card with its real drop rates (`data/drops.json`, scraped from the wiki)
  and a KPH (kills/hour) input you control.
- Each activity card shows live points/hour — the expected rate at which
  doing that activity fills out your board, accounting for what's already
  done, items that finish multiple tiles at once (correctly crediting only
  one, not both), and requirement structures that aren't a simple checklist
  (any-N-of-a-pool, AND-bundles, OR groups).
- Two in-app "how the math works" popups walk through the exact formula with
  real numbers, including the tricky cases.

See `DESIGN.md` for how the points model and data pipeline actually work.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`npm run dev` and `npm run build` both automatically regenerate
`data/drops_formatted.json` from the tracked source files
(`data/drops.json`, `data/tile_requirements.json`, `data/kph.json`) first —
no manual step needed on a fresh clone. To regenerate it standalone:

```bash
npm run transform:drops
```

## Stack

Next.js 15 (App Router, static export) · React 19 · TypeScript · Tailwind
CSS v4 · UI components adapted from [runescapecn](https://github.com/alns0dev/runescapecn)

## License & attribution

The application source code is licensed under **GPLv3** — see `LICENSE`.
That covers the code only:

- **Tile and drop-rate data** (`data/`) is sourced from the
  [Old School RuneScape Wiki](https://oldschool.runescape.wiki/), licensed
  under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), not
  GPLv3.
- **UI components** (`components/ui/`) are adapted from
  [runescapecn](https://github.com/alns0dev/runescapecn) (MIT).
- **Fonts** (`app/fonts/rs/`) are fan-recreated RuneScape-style fonts bundled
  via runescapecn; their original authorship isn't independently verified.
- "RuneScape" and "Old School RuneScape" are trademarks of Jagex Ltd. This is
  an unofficial fan project, not affiliated with or endorsed by Jagex.
