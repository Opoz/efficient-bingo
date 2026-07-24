// localStorage persistence for the mutable slice of the model:
// per-goal progress and per-activity KPH. Structure always comes from the
// seed; we only overlay these saved pointss by id on load.
//
// All functions are SSR-safe: they no-op when `window`/`localStorage` is
// unavailable and swallow JSON / storage errors, falling back to the seed.

import type { GoalMember, Model } from "./model";
import { groupGoals } from "./model";

const STORAGE_KEY = "task-activity-sim:v1";

interface PersistedState {
  version: 1;
  progress: Record<string, number>; // goalId -> progress
  KPH: Record<string, number>; // activityId -> KPH
}

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

// Derive the saveable maps from the current model.
export function deriveSaved(model: Model): PersistedState {
  const progress: Record<string, number> = {};
  for (const task of model.tasks) {
    for (const group of task.groups) {
      for (const goal of groupGoals(group)) {
        progress[goal.id] = goal.progress;
      }
    }
  }
  const KPH: Record<string, number> = {};
  for (const activity of model.activities) {
    KPH[activity.id] = activity.KPH;
  }
  return { version: 1, progress, KPH };
}

// Write the derived state to localStorage. Safe to call any time client-side.
export function saveModel(model: Model): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(deriveSaved(model)));
  } catch {
    // Quota / serialization errors are non-fatal for a local prototype.
  }
}

// Remove the persisted entry (used by Reset for a clean slate on reload).
export function clearSaved(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// Read + validate the persisted state. Returns undefined if absent/invalid.
function readSaved(): PersistedState | undefined {
  if (!hasStorage()) return undefined;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return undefined;
  }
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return undefined;
    const p = parsed as Partial<PersistedState>;
    return {
      version: 1,
      progress:
        p.progress && typeof p.progress === "object" ? p.progress : {},
      KPH: p.KPH && typeof p.KPH === "object" ? p.KPH : {},
    };
  } catch {
    return undefined;
  }
}

// Overlay saved progress/KPH onto a FRESH seed model. Unknown ids in storage
// are ignored (so a seed change can never crash rehydration); goal progress is
// clamped to the goal's target and floored at 0.
export function hydrateModel(seed: Model): Model {
  const saved = readSaved();
  if (!saved) return seed;

  const tasks = seed.tasks.map((task) => ({
    ...task,
    groups: task.groups.map((group) => {
      if (group.kind === "count") {
        return {
          ...group,
          goals: group.goals.map((m) => applyMember(m, saved.progress)),
        };
      }
      return {
        ...group,
        bundles: group.bundles.map((bundle) => ({
          ...bundle,
          goals: bundle.goals.map((goal) => applyProgress(goal, saved.progress)),
        })),
      };
    }),
  }));

  const activities = seed.activities.map((activity) => {
    const s = saved.KPH[activity.id];
    const valid = typeof s === "number" && Number.isFinite(s) && s >= 0;
    return valid ? { ...activity, KPH: s } : activity;
  });

  return { ...seed, tasks, activities };
}

function applyMember(member: GoalMember, progress: Record<string, number>): GoalMember {
  if ("kind" in member) {
    return { ...member, goals: member.goals.map((m) => applyMember(m, progress)) };
  }
  return applyProgress(member, progress);
}

function applyProgress<T extends { id: string; target: number; progress: number }>(
  goal: T,
  progress: Record<string, number>
): T {
  const saved = progress[goal.id];
  if (typeof saved !== "number" || !Number.isFinite(saved)) return goal;
  return { ...goal, progress: Math.min(goal.target, Math.max(0, saved)) };
}
