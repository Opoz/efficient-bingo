// Transforms tile_requirements.json into the Model task format.
// Activities are not present in the tile data — the caller is responsible
// for populating model.activities separately.

import type { CountGroup, Goal, GoalMember, Model, RequirementGroup, Task } from "./model";
import tilesRaw from "../data/tile_requirements.json";

// ---------- JSON shape types ------------------------------------------------

interface JsonItem {
  itemName: string;
  itemId: string | null;
  quantity: number;
}

type JsonReq =
  | JsonItem
  | { count: { quantity: number; from: JsonItem[] } }
  | { all_of: JsonReq[] }
  | { any_of: JsonReq[] };

interface JsonTile {
  title?: string;
  tileName?: string;
  description?: string;
  points?: number;
  image?: string;
  requirements: JsonReq;
}

// ---------- Slug utility ----------------------------------------------------

// Shared by the drops transformer to derive the same goal IDs from item names.
export function itemSlug(name: string): string {
  return name.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

// Goal ID: "<tileKey>--<itemSlug>" — double dash separates tile key from item.
export function goalId(tileKey: string, itemName: string): string {
  return `${tileKey}--${itemSlug(itemName)}`;
}

// ---------- Recursive converter ---------------------------------------------

// Counter used only for group IDs (activities reference goals, not groups).
type Counter = { n: number };

function itemGoal(item: JsonItem, tileKey: string): Goal {
  return {
    id: goalId(tileKey, item.itemName),
    name: item.itemName,
    target: item.quantity,
    progress: 0,
  };
}

function convertReq(req: JsonReq, tileKey: string, counter: Counter): GoalMember {
  // Leaf item
  if ("itemName" in req) {
    return itemGoal(req, tileKey);
  }

  // count: { quantity: N, from: [items] }
  // Special case: single item in list — collapse to one goal with target = N.
  if ("count" in req) {
    const { quantity, from } = req.count;
    if (from.length === 1) {
      const g: Goal = {
        id: goalId(tileKey, from[0].itemName),
        name: from[0].itemName,
        target: quantity,
        progress: 0,
      };
      return makeGroup([g], 1, tileKey, counter);
    }
    const goals = from.map((item) => itemGoal(item, tileKey));
    return makeGroup(goals, quantity, tileKey, counter);
  }

  // all_of: every member must be satisfied
  if ("all_of" in req) {
    const members = req.all_of.map((r) => convertReq(r, tileKey, counter));
    return makeGroup(members, members.length, tileKey, counter);
  }

  // any_of: exactly one member must be satisfied
  if ("any_of" in req) {
    const members = req.any_of.map((r) => convertReq(r, tileKey, counter));
    return makeGroup(members, 1, tileKey, counter);
  }

  throw new Error(`Unknown requirement shape: ${JSON.stringify(req)}`);
}

function makeGroup(
  goals: GoalMember[],
  requiredCount: number,
  tileKey: string,
  counter: Counter
): CountGroup {
  return {
    kind: "count",
    id: `${tileKey}-grp${counter.n++}`,
    goals,
    requiredCount,
  };
}

// Ensures the top-level result is always a CountGroup (RequirementGroup).
function toTopLevelGroup(member: GoalMember, tileKey: string): CountGroup {
  if ("kind" in member) return member;
  // Single leaf goal — wrap it.
  return { kind: "count", id: `${tileKey}-root`, goals: [member], requiredCount: 1 };
}

// ---------- Item → goal index -----------------------------------------------

// Walks all leaf Goals in a RequirementGroup or GoalMember tree.
function walkGoals(node: RequirementGroup | GoalMember, fn: (g: Goal) => void): void {
  if ("kind" in node && node.kind === "bundle") {
    node.bundles.forEach((b) => b.goals.forEach(fn));
  } else if ("kind" in node && node.kind === "count") {
    node.goals.forEach((m) => walkGoals(m, fn));
  } else {
    fn(node as Goal);
  }
}

// Returns a map of itemSlug → goalId[].
// The drops transformer uses this to find which goals a given drop item feeds.
// One item name can appear in multiple tiles (multiple goal IDs).
export function buildItemGoalIndex(model: Model): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const task of model.tasks) {
    for (const group of task.groups) {
      walkGoals(group, (goal) => {
        const slug = itemSlug(goal.name);
        const existing = index.get(slug);
        if (existing) existing.push(goal.id);
        else index.set(slug, [goal.id]);
      });
    }
  }
  return index;
}

// ---------- Public API ------------------------------------------------------

export function buildModelFromTiles(): Model {
  const tiles = tilesRaw as Record<string, JsonTile>;

  const tasks: Task[] = Object.entries(tiles).map(([key, tile]) => {
    const name = tile.title ?? tile.tileName ?? key;
    const points = tile.points ?? 0;

    const counter: Counter = { n: 0 };
    const member = convertReq(tile.requirements, key, counter);
    const group = toTopLevelGroup(member, key);

    return { id: key, name, points, groups: [group] };
  });

  return { tasks, activities: [] };
}
