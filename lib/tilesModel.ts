// Pure tile_requirements.json -> Model conversion, with no JSON import of its
// own. transformTiles.ts wraps this for app use (bundler-resolved JSON
// import); transformDrops.ts calls it directly with data loaded via fs, since
// plain Node ESM refuses bare JSON imports without import attributes.

import type {
    CountGroup,
    Goal,
    GoalMember,
    Model,
    PoolGroup,
    RequirementGroup,
    Task,
} from "./model.ts";

// ---------- JSON shape types ------------------------------------------------

export interface JsonItem {
    itemName: string;
    itemId: string | null;
    quantity: number;
}

export type JsonReq =
    | JsonItem
    | { count: { quantity: number; from: JsonItem[] } }
    | { all_of: JsonReq[] }
    | { any_of: JsonReq[] };

export interface JsonTile {
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
    return name
        .toLowerCase()
        .replace(/'/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
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

function convertReq(
    req: JsonReq,
    tileKey: string,
    counter: Counter,
): GoalMember {
    // Leaf item
    if ("itemName" in req) {
        return itemGoal(req, tileKey);
    }

    // count: { quantity: N, from: [items] } — the items are interchangeable:
    // any combination of them summing to N satisfies it (e.g. "any 2 of
    // these 7 TOB purples" is satisfied by 2 of the same one, or one each of
    // two different ones). Each goal's own target is N, not the item's own
    // `quantity` field, so a single item can fulfill it alone. A single-item
    // list is just a pool of one — same shape, same semantics.
    if ("count" in req) {
        const { quantity, from } = req.count;
        const goals: Goal[] = from.map((item) => ({
            id: goalId(tileKey, item.itemName),
            name: item.itemName,
            target: quantity,
            progress: 0,
        }));
        return makePoolGroup(goals, quantity, tileKey, counter);
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
    counter: Counter,
): CountGroup {
    return {
        kind: "count",
        id: `${tileKey}-grp${counter.n++}`,
        goals,
        requiredCount,
    };
}

function makePoolGroup(
    goals: Goal[],
    target: number,
    tileKey: string,
    counter: Counter,
): PoolGroup {
    return {
        kind: "pool",
        id: `${tileKey}-pool${counter.n++}`,
        goals,
        target,
    };
}

// Ensures the top-level result is always a RequirementGroup.
function toTopLevelGroup(
    member: GoalMember,
    tileKey: string,
): CountGroup | PoolGroup {
    if ("kind" in member) return member;
    // Single leaf goal — wrap it.
    return {
        kind: "count",
        id: `${tileKey}-root`,
        goals: [member],
        requiredCount: 1,
    };
}

// ---------- Item → goal index -----------------------------------------------

// Walks all leaf Goals in a RequirementGroup or GoalMember tree.
function walkGoals(
    node: RequirementGroup | GoalMember,
    fn: (g: Goal) => void,
): void {
    if ("kind" in node && node.kind === "bundle") {
        node.bundles.forEach((b) => b.goals.forEach(fn));
    } else if ("kind" in node && node.kind === "count") {
        node.goals.forEach((m) => walkGoals(m, fn));
    } else if ("kind" in node && node.kind === "pool") {
        node.goals.forEach(fn);
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

export function tilesToModel(tiles: Record<string, JsonTile>): Model {
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
