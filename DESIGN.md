# Task–Activity Contribution System — Design

A model (and a small Next.js demo) for a system where a set of **tasks** must be
completed, tasks are completed by doing **activities**, and one activity can
contribute to **many** tasks at different rates. Activities lose value as the
goals they feed get satisfied.

This document is the source-of-truth design dump. The runnable prototype lives
in the same directory; the model is implemented purely in `lib/model.ts`.

---

## 1. Concepts

| Entity | What it is |
|--------|-----------|
| **Task** | A unit of work. Has an **impact** multiplier and one or more **requirement groups**. Done when *every* group is satisfied. |
| **Requirement group** | A rule over goals describing how the task can be satisfied. Two kinds: `count` (K-of-N) and `bundle` (OR of AND-bundles). See §3. |
| **Goal** | A measurable target on some dimension: `target` and `progress` (starts at 0). Satisfied when `progress >= target`. |
| **Bundle** | (bundle-mode only) A set of goals joined by AND — satisfied when *all* its goals are satisfied. |
| **Activity** | An action you can *do*. Feeds one or more goals via **edges**, each with its own rate. Has a user-controllable **speed** multiplier. |
| **Activity edge** | The link `activity → goal`, carrying a static **rate** (contribution per unit time at speed 1). This is where many-to-many + "different rates" lives. |

**Key modeling move:** an activity does not contribute to a *task* directly — it
contributes to *goals*. Tasks are collections of goals (grouped by requirement
rules). That cleanly gives "a task may have multiple goals, and these can come
from multiple activities."

The contribution graph is bipartite: activities on one side, goals on the other,
weighted edges = rates; goals roll up into groups, groups into tasks.

```
Activity 1 ──rate 0.8──▶ Goal A ─┐
         └──rate 0.3──▶ Goal B ─┼─▶ Task 1  (impact 1)
Activity 2 ──rate 0.5──▶ Goal B ─┘
         └──rate 0.9──▶ Goal C ───▶ Task 2  (impact 2)
```

---

## 2. Effort, speed, and wasted overflow

Each activity has a **speed** multiplier the user sets freely (e.g. `0.5`, `2.5`).
The display convention is `rate × speed` — e.g. `0.8 × 1`, where `0.8` is the
static per-edge rate and `× 1` is the user's speed.

A single edge's contribution per unit time is `rate × speed`, **hard-capped** at
the goal's remaining headroom. **Overflow is wasted** — excess is lost, it does
*not* spill to other goals the activity feeds.

```
remaining(goal)                = max(0, target − progress)
effectiveContribution(edge)    = min(rate × speed, effectiveRemaining(goal))
                                                    ↑ excess above this is wasted
```

(`effectiveRemaining` — not raw `remaining` — is used everywhere value is
computed; see §4.)

---

## 3. Requirement groups — how a task can be satisfied

A task's goals live in one or more **requirement groups**. The task is done when
**every** group is satisfied (AND across groups). A group is one of two kinds:

### count mode — K of N
Satisfied when at least `requiredCount` of its individual goals are satisfied.

- `requiredCount = N` (all)  → **AND** of goals (the original default behavior).
- `requiredCount = 1`        → **OR** of single goals (e.g. "Docs Read ×4 OR Code Complete ×3").
- `requiredCount = K`        → "any K of N".

### bundle mode — OR of AND-bundles
Holds a list of **bundles**. Each bundle is satisfied when *all* its goals are
satisfied (AND). The group is satisfied when **any one bundle** is fully
satisfied (OR over bundles). This expresses multi-goal OR branches:

```
(Goal 1 ∧ Goal 2)  OR  (Goal 3 ∧ Goal 4)
```

Together, count + bundle cover: AND, OR-of-singles, K-of-N, and OR-of-AND-groups.
(Arbitrary deeper nesting — e.g. `1 ∧ (2 ∨ 3)` at any depth — would require a
recursive requirement tree; deliberately **not** implemented. Bundle mode was the
targeted fix for one level of multi-goal OR.)

---

## 4. Value, impact, and diminishing returns

### Impact
Each **task** carries an `impact` multiplier. It scales every contribution
flowing into that task's goals, so the same activity is worth more per hour when
it feeds a higher-impact task. (Impact is per-task; all goals in a task share it.)

### Value per hour of an activity
```
value_per_hour(activity) =
    Σ over goals it feeds of
        min(rate × speed, effectiveRemaining(goal)) × impact(goal's task)
```

This is the ranking signal for "what should I do next" — pick the activity with
the highest current `value_per_hour`. It re-ranks automatically as goals fill.

### Diminishing returns — the important part
Value decay is **not** hand-coded per activity; it emerges from the headroom cap
plus one rule about redundancy:

**`effectiveRemaining(goal)` = 0 when the goal's group is already satisfied;
otherwise `max(0, target − progress)`.**

Consequences:
- Finishing a task (all groups satisfied) zeroes headroom for all its goals →
  activities feeding only that task drop to 0 value. An activity that also feeds
  another unfinished task keeps *that* value. → "activity 1 has *less* value once
  task 1 is done," not zero.
- In a **count** OR-group, satisfying the group one way (e.g. Code Complete)
  freezes the whole group's headroom → activities feeding the redundant goal
  (Docs Read) drop to 0, even though that goal isn't full.
- In a **bundle** group, completing one bundle satisfies the group → goals in the
  *abandoned* bundle have headroom treated as 0 → feeding the losing branch is
  worthless.

All three are the same rule: **group satisfied ⇒ its goals' effective remaining
is 0.** Redundant work is never credited.

---

## 5. Design decisions (locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Overflow when contribution exceeds headroom | **Wasted** (not spilled, not banked) | Simplest; models effort that can't be redirected once spent. |
| Activity value driver | **Headroom × task impact** | Higher-impact tasks make an activity worth more per hour, independent of size. |
| Redundant-goal value once a group is satisfied another way | **Drops to zero** | Reuses the existing decay behavior; freezing group headroom zeroes it. |
| Multi-goal OR expressiveness | **Bundle mode** (one level: OR of AND-bundles) | Covers "(1∧2) OR (3∧4)" without the complexity of a fully recursive requirement tree. |

---

## 6. Types (see `lib/model.ts` for the authoritative source)

```ts
interface Goal   { id; name; target: number; progress: number }        // progress starts at 0
interface Bundle { id; label?; goals: Goal[] }                         // AND of goals

type CountGroup  = { kind: 'count';  id; label?; goals: Goal[]; requiredCount: number }
type BundleGroup = { kind: 'bundle'; id; label?; bundles: Bundle[] }
type RequirementGroup = CountGroup | BundleGroup

interface Task     { id; name; impact: number; groups: RequirementGroup[] }
interface ActivityEdge { goalId: string; rate: number }                // rate = contribution/unit-time @ speed 1
interface Activity { id; name; speed: number; edges: ActivityEdge[] }
interface Model    { tasks: Task[]; activities: Activity[] }
```

### Pure functions
- `remaining(goal)` — raw `max(0, target − progress)`.
- `isGoalSatisfied` / `isBundleSatisfied` / `isGroupSatisfied` / `isTaskDone`.
- `findGoal(model, goalId)` → `{ goal, group, task }`.
- `effectiveRemaining(model, goalId)` — 0 if the goal's group is satisfied, else raw remaining.
- `effectiveContribution(model, activity, edge)` — `min(rate × speed, effectiveRemaining)`.
- `activityValuePerHour(model, activity)` — the §4 sum.
- Mutations (return a new `Model`): `incrementGoal`, `decrementGoal`, `applyActivity`, `resetModel`, `setActivitySpeed`.

---

## 7. UI (prototype)

- **Two-column layout**, searchable. No canvas/zoom.
  - **Tasks** column, sorted by **impact descending** (done tasks sink to the
    bottom; ties broken by name).
  - **Activities** column, sorted by **value/hr descending** (ties by name).
    Both sorts recompute live from current model state on every change.
  - **Search**: one case-insensitive box filtering both columns — a task matches
    on its name or any goal name; an activity on its name or any fed goal name.
- **Task tile**: name, impact badge (rendered as "`<n> impact`", e.g. "4 impact"),
  each group rendered by kind:
  - count group shows a "Complete K of N" header when optional; a "✓ satisfied"
    badge when met; redundant unsatisfied goals greyed with +1 locked.
  - bundle group shows "Complete ALL of one option" with each bundle as a
    labeled sub-block separated by an "OR" divider; abandoned bundle greyed.
  - Each goal row: progress bar, remaining, `−1 / +1` steppers (one unit per
    click), DONE-at-target.
- **Activity tile**: free-text **speed** number input (clearable; parses float,
  clamps negatives, blur-resets to the model value — no preset buttons), edge rows
  shown as `→ Goal: rate × speed` with per-goal `−1 / +1`, and a live
  **value/hr**. Edges into a satisfied group's redundant goal grey out and show
  `= 0`.
- **Global Reset** (top-right of the header) zeroes all progress *and* clears the
  persisted state (see below). There is no simulation clock / step engine — the
  user explores state manually.

### Persistence (`lib/persistence.ts`)
- Progress survives reloads via **localStorage**, versioned key `task-activity-sim:v1`.
- Only the **mutable slice** is stored — a `{goalId: progress}` map and a
  `{activityId: speed}` map — never the graph shape. On load, state starts from
  the seed model and the saved values are overlaid by id: unknown/stale ids are
  ignored, progress is clamped to `[0, target]`, invalid/negative speeds fall back
  to the seed. So a seed change can never crash rehydration.
- **SSR-safe:** first render uses the plain seed (matches the server render — no
  hydration mismatch); a mount effect then loads from localStorage. Saves happen
  in an effect gated on a `hydrated` flag so the pre-load seed can't clobber
  existing storage; `localStorage` is only touched in effects/handlers.
- **Reset** clears the versioned key and zeroes progress, so a reload after Reset
  shows a clean slate rather than restored progress.

### Styling & stack
- **Next.js 15 / React 18**, App Router, TypeScript. (Pinned to 15/React 18
  because a fresh `create-next-app` pulls Next 16, which needs Node ≥20.9; this
  env runs Node 20.8.1.)
- **Tailwind CSS v3** + **shadcn/ui** components (Card, Button, Input, Badge,
  Progress). shadcn was hand-installed (config, `lib/utils.ts`, and the UI files
  authored from the standard "default" style) rather than via `npx shadcn init`,
  which wants Node ≥20.9. Tailwind pinned to v3 for the same reason.
- **Theme: Old School RuneScape (OSRS), dark.** Page background `#2E2C29`,
  panels `#46433A` with `#474745` borders, gold accents (`#E6A519` / `#FFCF3F`)
  for headings, badges, progress fill, and focus rings; green (`#00FF00`) reserved
  for DONE / ✓ satisfied. Clean readable sans (no pixel font, no heavy
  skeuomorphism). Tasks carry a gold left border + gold title; activities a
  neutral border + off-white title, keeping the two columns distinct on the shared
  dark panel base. The palette is mapped onto shadcn's semantic CSS-variable tokens
  (`--background`, `--card`, `--border`, `--primary`, …) in `app/globals.css`.
- **Steppers** use a dedicated `stepper` Button variant: filled osrs-brown with a
  gold border and high-contrast glyphs, distinct hover/pressed/disabled states.

---

## 8. Seeded demos (`lib/seed.ts`)

1. **Peer Review feeds two tasks** — starts high; finishing the lower-impact task
   drops its value but it stays positive via the other task. (Basic diminishing
   returns across tasks.)
2. **Ramp Up Skills** (impact 2) — count OR-group "Docs Read ×4 **OR** Code
   Complete ×3". *Write Documentation* feeds Docs Read; completing Code Complete
   instead drops that activity's value/hr to 0 for the now-redundant goal
   (3.0 → 1.6/hr in the seed).
3. **Ship Release** (impact 4) — bundle group "(Legal ×2 ∧ Security ×3) **OR**
   (Beta ×3 ∧ Load ×2)". *Audit Controls* feeds Security Review (Formal bundle
   only); completing the Lean bundle abandons the Formal branch and drops Audit
   Controls from 3.8 → 1.8/hr.

---

## 9. Prior art / where this pattern shows up

- **Quest / skill-tree systems** — one action, XP toward several quests; quests
  cap out; optional quest paths.
- **OKRs** — activities → key results (measurable, capped) → objectives.
- **Requirement checklists / degree requirements** — "K of N", "any of these
  bundles".
- **Payment applied across invoices** — contribution capped per invoice, excess
  handling is a policy choice (here: wasted).
