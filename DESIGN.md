# Efficient Bingo — Design

An OSRS bingo-board points/hour calculator: a set of **tiles** must be
completed, tiles are completed by doing **activities** (killing bosses,
farming skilling drops, etc.), and one activity can feed **many** tiles at
once at different rates, using real drop rates pulled from the OSRS Wiki.
The tool answers "what should I be doing right now to finish the board
fastest?" and re-ranks activities live as goals fill in.

This document describes the current model and app as built — not an
aspirational spec. The model is implemented purely in `lib/model.ts`, with no
React or side effects; the data pipeline that turns wiki data into that model
lives in `lib/tilesModel.ts` and `lib/transformDrops.ts`.

---

## 1. Concepts

| Entity                | What it is                                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Tile**              | A bingo board square. Has a **points** value and one or more **requirement groups**. Done when _every_ group is satisfied.                                                                             |
| **Requirement group** | A rule over goals describing how the tile can be satisfied. Three kinds: `count` (K-of-N), `bundle` (OR of AND-bundles), and `pool` (interchangeable items, any combination sums to a target). See §3. |
| **Goal**              | A measurable target on some dimension: `target` and `progress` (starts at 0). Satisfied when `progress >= target`.                                                                                     |
| **Bundle**            | (bundle-mode only) A set of goals joined by AND — satisfied when _all_ its goals are satisfied.                                                                                                        |
| **Activity**          | An action you can _do_ — a boss, a skilling method. Feeds one or more goals via **edges**, each with its own drop rate. Has a user-controllable **KPH** (kills/actions per hour).                      |
| **Activity edge**     | The link `activity → goal`, carrying a static **rate** (contribution per hour at KPH 1) sourced from the real drop table. This is where many-to-many + "different rates" lives.                        |

**Key modeling move:** an activity does not contribute to a _tile_ directly —
it contributes to _goals_. Tiles are collections of goals (grouped by
requirement rules). That cleanly gives "a tile may have multiple goals, and
these can come from multiple activities."

The contribution graph is bipartite: activities on one side, goals on the
other, weighted edges = drop rates; goals roll up into groups, groups into
tiles.

```
Activity 1 ──rate 0.02──▶ Goal A ─┐
         └──rate 0.01──▶ Goal B ─┼─▶ Tile 1  (4 points)
Activity 2 ──rate 0.05──▶ Goal B ─┘
         └──rate 0.002─▶ Goal C ───▶ Tile 2  (6 points)
```

---

## 2. KPH and wasted overflow

Each activity has a **KPH** (kills-per-hour) multiplier the user sets freely.
The display convention is `rate × KPH` — e.g. `1/516 × 10`, where `1/516` is
the item's real drop rate and `× 10` is the user's kill speed.

A single edge's contribution per hour is `rate × KPH`, **hard-capped** at the
goal's remaining headroom. **Overflow is wasted** — excess is lost, it does
_not_ spill to other goals the activity feeds.

```
remaining(goal)                = max(0, target − progress)
effectiveContribution(edge)    = min(rate × KPH, effectiveRemaining(goal))
                                                    ↑ excess above this is wasted
```

(`effectiveRemaining` — not raw `remaining` — is used everywhere value is
computed; see §4.)

---

## 3. Requirement groups — how a tile can be satisfied

A tile's goals live in one or more **requirement groups**. The tile is done
when **every** group is satisfied (AND across groups). A group is one of
three kinds:

### count mode — K of N

Satisfied when at least `requiredCount` of its individual goals (or nested
groups) are satisfied.

- `requiredCount = N` (all) → **AND** of goals.
- `requiredCount = 1` → **OR** of single goals.
- `requiredCount = K` → "any K of N".

### bundle mode — OR of AND-bundles

Holds a list of **bundles**. Each bundle is satisfied when _all_ its goals
are satisfied (AND). The group is satisfied when **any one bundle** is fully
satisfied (OR over bundles):

```
(Goal 1 ∧ Goal 2)  OR  (Goal 3 ∧ Goal 4)
```

### pool mode — interchangeable items, shared target

Goals in a pool are interchangeable: any combination of their progress
summing to `target` satisfies the group. Two of the _same_ item counts the
same as one of two different ones — e.g. "any 2 of these 7 TOB purples" is
satisfied by 2 of the same purple, or one each of two different ones. Each
goal's own `target` equals the pool's `target`, so a single item can fulfill
the whole group alone. This is how `tile_requirements.json`'s `count: {
quantity, from }` shape is modeled — see §5.

Together, count + bundle + pool cover: AND, OR-of-singles, K-of-N,
OR-of-AND-groups, and "any combination of interchangeable items sums to a
target." (Arbitrary deeper nesting beyond these patterns is deliberately not
implemented.)

---

## 4. Points, and diminishing returns

### Points per unit — equal share at every AND join

A tile's `points` are split evenly at each point two-or-more things are
jointly required:

- across the tile's groups (every group is required)
- across a count group's `requiredCount` members (not `goals.length` — an
  OR/K-of-N group's un-needed alternatives don't dilute the share; each
  candidate is valued as if it were one of the K that end up mattering)
- across a bundle group's _chosen_ bundle's goals (every bundle is an
  independent OR candidate that, if it wins, gets the group's full share)
- a pool group's goals share the group's full, undivided share — the pool is
  one shared budget, so finishing it via any combination nets the full share

That per-goal share is then divided by the goal's own `target`, so fully
completing a goal always earns exactly its share — not its share multiplied
by however many units it needed. See `goalPointsPerUnit` in `lib/model.ts`.

### Points per hour of an activity

```
pointsPerHour(activity) =
    Σ over goals it feeds of
        min(rate × KPH, effectiveRemaining(goal)) × goalPointsPerUnit(goal)
```

**Except** when two edges share a `dropGroup`: those edges are the _same
physical drop_ credited to two different tiles (e.g. a hilt counting toward
both a boss-unique tile and a full-set tile). You can only claim one drop
toward one tile, so summing both would double-count a single item as if it
scored on every tile it could possibly complete. `activityPointsPerHour`
takes the **max** of a `dropGroup`'s edges instead of the sum. Edges from
genuinely independent items that happen to feed the same pool goal (e.g.
Araxxor's three different uniques, each capable of finishing the same "any 1
of 3" tile) are _not_ grouped this way and are correctly summed — they're
independent rolls, and for rare events, P(at least one succeeds) ≈ sum of
the individual rates.

This is the ranking signal for "what should I do next" — pick the activity
with the highest current points/hour. It re-ranks automatically as goals
fill.

### Diminishing returns — the important part

Value decay is **not** hand-coded per activity; it emerges from the headroom
cap plus one rule about redundancy:

**`effectiveRemaining(goal)` = 0 when the goal's group is already satisfied;
otherwise `max(0, target − progress)`** (further capped by the pool's own
remaining budget for pool members — interchangeable goals share one budget).

Consequences:

- Finishing a tile (all groups satisfied) zeroes headroom for all its goals
  → activities feeding only that tile drop to 0 value.
- In a **count** OR-group, satisfying the group one way freezes the whole
  group's headroom → activities feeding the now-redundant alternative goal
  drop to 0.
- In a **bundle** group, completing one bundle satisfies the group → goals in
  the _abandoned_ bundle are treated as 0 remaining.
- In a **pool**, once the combined progress hits the target, every remaining
  member's headroom drops to 0 together, regardless of which items actually
  supplied the progress.

All four are the same rule: **group satisfied ⇒ its goals' effective
remaining is 0.** Redundant work is never credited.

---

## 5. Data pipeline — from OSRS Wiki to the model

Two independent halves get merged into one `Model` by `lib/buildModel.ts`:

### Tasks: `data/tile_requirements.json` → `lib/tilesModel.ts` → tasks

Hand-authored tile definitions (title, points, an item requirement tree of
leaf items / `count` pools / `all_of` / `any_of`). `tilesToModel()` converts
this JSON shape into `Task[]` — recursively walking `all_of`/`any_of` into
nested count groups, and `count: { quantity, from }` into pool groups (see
§3). `buildItemGoalIndex()` builds the reverse index (item name → goal ids)
that the drops transform uses to know which goals a given drop feeds.

### Activities: `data/drops.json` + `data/kph.json` → `lib/transformDrops.ts` → `data/drops_formatted.json`

`data/drops.json` is scraped OSRS Wiki drop-table data (via a one-off local
scraper, not part of this repo) — `{ "Monster name": [{ name, quantity,
rarity }] }`. For each drop, `transformDrops.ts`:

- Skips it if no tile tracks that item name (via the reverse index above).
- Skips a small excluded-items list (common junk drops that would flood the
  activity list without being useful, e.g. curved bones from ~100 NPCs).
- Parses `rarity` into a numeric rate ("Always" → 1, "a/b" → a/b). Unparsed
  wiki-template artifacts and qualitative rarities ("Rare", "Varies") are
  skipped and logged, not guessed at.
- Emits one `ActivityEdge` per matching goal, tagging a shared `dropGroup`
  when a single drop feeds more than one goal (see §4).
- Looks up the activity's KPH from `data/kph.json` (real per-monster kill
  rates), defaulting to 1 if absent.

Run via `npm run transform:drops`. It also runs automatically before `dev`
and `build` (`predev`/`prebuild` npm lifecycle hooks) — `drops_formatted.json`
is gitignored, generated fresh from the tracked source files every time, so a
fresh clone or CI checkout never needs a manual step.

---

## 6. Types (see `lib/model.ts` for the authoritative source)

```ts
interface Goal {
    id;
    name;
    target: number;
    progress: number;
} // progress starts at 0
interface Bundle {
    id;
    label?;
    goals: Goal[];
} // AND of goals

type GoalMember = Goal | CountGroup | PoolGroup;
type CountGroup = {
    kind: "count";
    id;
    label?;
    goals: GoalMember[];
    requiredCount: number;
};
type BundleGroup = { kind: "bundle"; id; label?; bundles: Bundle[] };
type PoolGroup = { kind: "pool"; id; label?; goals: Goal[]; target: number };
type RequirementGroup = CountGroup | BundleGroup | PoolGroup;

interface Task {
    id;
    name;
    points: number;
    groups: RequirementGroup[];
}
interface ActivityEdge {
    goalId: string;
    rate: number; // contribution/hour @ KPH 1
    rateLabel?: string; // human-readable source, e.g. "1/128" or "Always"
    dropGroup?: string; // shared id = same physical drop, multiple tiles — max, not sum
}
interface Activity {
    id;
    name;
    KPH: number;
    edges: ActivityEdge[];
}
interface Model {
    tiles: Task[];
    activities: Activity[];
}
```

### Pure functions

- `remaining(goal)` — raw `max(0, target − progress)`.
- `isGoalSatisfied` / `isBundleSatisfied` / `isGroupSatisfied` / `isTileDone`.
- `poolProgress(group)` — sum of progress across a pool's interchangeable goals.
- `findGoal(model, goalId)` → `{ goal, group, tile }`.
- `effectiveRemaining(model, goalId)` — 0 if the goal's group is satisfied, else raw remaining (capped by pool budget for pool members).
- `effectiveContribution(model, activity, edge)` — `min(rate × KPH, effectiveRemaining)`.
- `goalPointsPerUnit(model, goalId)` — the §4 equal-share-per-unit calculation.
- `activityPointsPerHour(model, activity)` — the §4 sum-with-dropGroup-max.
- Mutations (return a new `Model`): `incrementGoal`, `decrementGoal`, `applyActivity`, `resetModel`, `setActivityKPH`.

---

## 7. UI

- **Two-column layout**, searchable, each column independently collapsible to
  a slim strip (freeing the other column's width) via a chevron button next
  to its header.
    - **Tiles** column, sorted by points descending (done tiles sink to the
      bottom; ties broken by name).
    - **Activities** column, sorted by points/hr descending (ties by name).
      Both sorts recompute live from current model state on every change.
    - **Search**: one case-insensitive box filtering both columns — a tile
      matches on its name or any goal name; an activity on its name or any fed
      goal name.
    - Cards lay out in a responsive CSS grid (`minmax(340px, 1fr)` columns),
      capped-height with internal scroll rather than fixed height, so a row of
      cards only grows as tall as it needs to — see `app/page.tsx`.
- **Tile card**: name, points badge, each group rendered by kind (count /
  bundle / pool — see §3), each goal row with a progress bar and `−1 / +1`
  steppers.
- **Activity card**: KPH number input, edge rows shown as `→ Goal (Tile):
rate × KPH = contribution × pts/unit = pts/hr` with per-edge `−1 / +1` (the
  same item can appear as more than one row if it feeds more than one tile —
  each row's steppers only touch that row's goal), and a live points/hour
  total.
- **Header**: search box (centered via a flex-1 sandwich, not `mx-auto` —
  the latter mis-centers once the right-side button group's width changes),
  two points/hour explainer dialogs (`InfoDialog.tsx`, `ArrowOverlayDialog.tsx`
  — worked examples with real data, not hand-waved numbers), and Reset.
- **Global Reset** rebuilds the model fresh from source (zero progress, KPH
  reset to the data's defaults) and clears persisted state. There is no
  simulation clock / step engine — the user explores state manually.

### Persistence (`lib/persistence.ts`)

- Progress survives reloads via **localStorage**, versioned key
  `task-activity-sim:v1`.
- Only the **mutable slice** is stored — a `{goalId: progress}` map and a
  `{activityId: KPH}` map — never the graph shape. On load, state starts from
  a freshly-built model and the saved values are overlaid by id: unknown/
  stale ids are ignored, progress is clamped to `[0, target]`, invalid KPH
  falls back to the built default. So a data change can never crash
  rehydration.
- **SSR-safe:** first render uses the plain built model (matches the server
  render — no hydration mismatch); a mount effect then loads from
  localStorage.

### Styling & stack

- **Next.js 15 / React 19**, App Router, TypeScript, static export
  (`output: "export"`) for GitHub Pages.
- **Tailwind CSS v4** with a `@config` bridge to the existing JS
  `tailwind.config.ts` (avoids a full rewrite to CSS-first `@theme` syntax).
- **UI components adapted from [runescapecn](https://github.com/alns0dev/runescapecn)**
  (`components/ui/`) — hard-edge OSRS look (zero border-radius, beveled inset/
  outset shadows via layered box-shadows, corner-chamfer buttons via clipped
  gradients), real RuneScape-style fonts loaded via `next/font/local`
  (`app/fonts/rs/`). Custom additions kept on top of the upstream source: a
  `stepper` Button variant for the `−1`/`+1` controls, and Progress/Badge
  call sites adapted to runescapecn's `value`/`max`/`variant` API. The
  original shadcn/OSRS-palette CSS variables (`--background`, `--primary`,
  etc.) are untouched — runescapecn's components style themselves with their
  own `rs-*` tokens, not those, so both palettes coexist without conflict.
- **Dark Reader compatibility**: a `<meta name="darkreader-lock">` tag (Dark
  Reader's own documented opt-out) stops the extension from reprocessing an
  already-dark page and introducing a color/hue shift.

---

## 8. Deployment

Static export to **GitHub Pages** as a project page
(`https://opoz.github.io/efficient-bingo/`):

- `next.config.ts`: `output: "export"`, `basePath` set to `/efficient-bingo`
  **only in production** (`process.env.NODE_ENV === "production"`) — applying
  it unconditionally breaks `next dev`, which also respects `basePath`.
- `public/.nojekyll` — GitHub Pages runs output through Jekyll by default,
  which silently drops any `_next/`-prefixed directory; this file disables
  that.
- `.github/workflows/deploy.yml` — builds and deploys on push to `master`.
  Loosely based on GitHub's official "Next.js" Pages starter workflow, but
  deliberately omits `configure-pages`'s `static_site_generator: next` input:
  that feature auto-injects `output`/`basePath` into `next.config.js/.cjs/
.mjs`, but this repo uses `next.config.ts` (an unsupported extension for
  that feature), so it wouldn't find the real config and risks generating a
  conflicting stray file instead.

---

## 9. Prior art / where this pattern shows up

- **Quest / skill-tree systems** — one action, XP toward several quests;
  quests cap out; optional quest paths.
- **OKRs** — activities → key results (measurable, capped) → objectives.
- **Requirement checklists / degree requirements** — "K of N", "any of these
  bundles", "any combination of these interchangeable credits".
- **Payment applied across invoices** — contribution capped per invoice,
  excess handling is a policy choice (here: wasted).
