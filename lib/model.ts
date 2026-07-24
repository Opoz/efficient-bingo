// Pure model for the task-activity contribution system.
// No React, no side effects here — just types and pure functions.

export interface Goal {
    id: string;
    name: string;
    target: number;
    progress: number; // starts at 0
}

// A member of a CountGroup is a leaf Goal or a nested CountGroup/PoolGroup.
export type GoalMember = Goal | CountGroup | PoolGroup;

export function isMemberSatisfied(member: GoalMember): boolean {
    return "kind" in member
        ? isGroupSatisfied(member)
        : isGoalSatisfied(member);
}

// count-mode group: K-of-N over its members (satisfied when at least
// `requiredCount` members are individually satisfied). Members may be leaf
// Goals or nested CountGroups (e.g. "all 3 shards AND any 1 hilt").
export interface CountGroup {
    kind: "count";
    id: string;
    label?: string;
    goals: GoalMember[];
    requiredCount: number;
}

// A bundle is a set of goals joined by AND — satisfied when ALL its goals are.
export interface Bundle {
    id: string;
    label?: string;
    goals: Goal[];
}

// bundle-mode group: OR over bundles — satisfied when ANY one bundle is fully
// satisfied. Gives "(g1 AND g2) OR (g3 AND g4)".
export interface BundleGroup {
    kind: "bundle";
    id: string;
    label?: string;
    bundles: Bundle[];
}

// pool-mode group: goals are interchangeable — any combination of their
// progress summing to `target` satisfies the group. Two of the SAME item
// counts the same as one of two different ones (e.g. "any 2 of these 7 TOB
// purples"). Each goal's own `target` equals the pool's `target`, so a
// single item can fulfill the whole group on its own.
export interface PoolGroup {
    kind: "pool";
    id: string;
    label?: string;
    goals: Goal[];
    target: number;
}

export type RequirementGroup = CountGroup | BundleGroup | PoolGroup;

// Iterate every leaf Goal inside a group regardless of its kind.
export function groupGoals(group: RequirementGroup): Goal[] {
    if (group.kind === "count") {
        return group.goals.flatMap((m) => ("kind" in m ? groupGoals(m) : [m]));
    }
    if (group.kind === "pool") {
        return group.goals;
    }
    return group.bundles.flatMap((b) => b.goals);
}

// Sum of progress across a pool's interchangeable goals.
export function poolProgress(group: PoolGroup): number {
    return group.goals.reduce((sum, g) => sum + g.progress, 0);
}

// True when all of a bundle's goals are satisfied (AND).
export function isBundleSatisfied(bundle: Bundle): boolean {
    return bundle.goals.every(isGoalSatisfied);
}

export interface Task {
    id: string;
    name: string;
    points: number; // multiplier, e.g. 1, 2, 3
    groups: RequirementGroup[];
}

// An edge from an activity to a single goal, with its own static rate.
export interface ActivityEdge {
    goalId: string;
    rate: number; // contribution per unit time at KPH 1
    rateLabel?: string; // human-readable source of `rate`, e.g. "1/128" or "Always"
}

export interface Activity {
    id: string;
    name: string;
    KPH: number; // user-controllable multiplier (0.5, 1, 2, 3, ...)
    edges: ActivityEdge[];
}

export interface Model {
    tasks: Task[];
    activities: Activity[];
}

// ---- Derived helpers -------------------------------------------------------

export function remaining(goal: Goal): number {
    return Math.max(0, goal.target - goal.progress);
}

// A goal is satisfied once its progress reaches its target.
export function isGoalSatisfied(goal: Goal): boolean {
    return goal.progress >= goal.target;
}

// count → K-of-N satisfied members; pool → combined progress reaches target;
// bundle → some bundle fully satisfied.
export function isGroupSatisfied(group: RequirementGroup): boolean {
    if (group.kind === "count") {
        const satisfied = group.goals.filter(isMemberSatisfied).length;
        return satisfied >= group.requiredCount;
    }
    if (group.kind === "pool") {
        return poolProgress(group) >= group.target;
    }
    return group.bundles.some(isBundleSatisfied);
}

// A task is done when every group is satisfied.
export function isTaskDone(task: Task): boolean {
    return task.groups.every(isGroupSatisfied);
}

// Locate a goal along with its owning task and group.
export function findGoal(
    model: Model,
    goalId: string,
): { goal: Goal; group: RequirementGroup; task: Task } | undefined {
    for (const task of model.tasks) {
        for (const group of task.groups) {
            const goal = groupGoals(group).find((g) => g.id === goalId);
            if (goal) return { goal, group, task };
        }
    }
    return undefined;
}

// Effective remaining headroom for points/effort purposes:
// if the goal's group is already satisfied, ALL its goals are redundant → 0.
// In a pool group, headroom is also capped by the pool's own remaining
// (target - combined progress) — interchangeable goals share one budget, so
// once other pool members have covered the target, this one has none left
// even if its own target isn't reached.
// Otherwise the raw remaining (target - progress).
export function effectiveRemaining(model: Model, goalId: string): number {
    const found = findGoal(model, goalId);
    if (!found) return 0;
    if (isGroupSatisfied(found.group)) return 0;
    if (found.group.kind === "pool") {
        const poolRemaining = Math.max(
            0,
            found.group.target - poolProgress(found.group),
        );
        return Math.min(remaining(found.goal), poolRemaining);
    }
    return remaining(found.goal);
}

// Effective contribution for a single edge given current state:
// rate * KPH, HARD-CAPPED at the goal's effective remaining. Overflow wasted.
export function effectiveContribution(
    model: Model,
    activity: Activity,
    edge: ActivityEdge,
): number {
    const raw = edge.rate * activity.KPH;
    return Math.min(raw, effectiveRemaining(model, edge.goalId));
}

// How many of a task's points a single fully-satisfied goal is worth, an
// equal share at each AND join:
// - across the task's groups (every group required)
// - across a count group's `requiredCount` members (not `goals.length` — an
//   OR/K-of-N group's un-needed alternatives don't dilute the share; each
//   candidate is valued as if it were one of the K that end up mattering)
// - across a bundle group's chosen bundle's goals (every bundle is an
//   independent OR candidate that, if it wins, gets the group's full share)
// - a pool group's goals share the group's full, undivided share (not
//   further split by goal count) — the pool is one shared budget, so this
//   function returns `share` itself and goalPointsPerUnit's division by that
//   goal's own target (== the pool's target) is what spreads it per unit
// Returns undefined if goalId isn't found under this group.
function findGoalShare(
    group: RequirementGroup,
    goalId: string,
    share: number,
): number | undefined {
    if (group.kind === "bundle") {
        for (const bundle of group.bundles) {
            if (bundle.goals.some((g) => g.id === goalId)) {
                return share / bundle.goals.length;
            }
        }
        return undefined;
    }
    if (group.kind === "pool") {
        return group.goals.some((g) => g.id === goalId) ? share : undefined;
    }
    const perMember = group.requiredCount > 0 ? share / group.requiredCount : 0;
    for (const member of group.goals) {
        if ("kind" in member) {
            const nested = findGoalShare(member, goalId, perMember);
            if (nested !== undefined) return nested;
        } else if (member.id === goalId) {
            return perMember;
        }
    }
    return undefined;
}

// Points earned per unit of progress on a goal — the goal's equal share of
// its task's points (see findGoalShare), spread across its own target so
// that fully completing the goal earns exactly its share, not its share
// multiplied by however many units the goal needed.
export function goalPointsPerUnit(model: Model, goalId: string): number {
    const found = findGoal(model, goalId);
    if (!found || found.goal.target <= 0) return 0;
    const groupShare = found.task.points / found.task.groups.length;
    const share = findGoalShare(found.group, goalId, groupShare) ?? 0;
    return share / found.goal.target;
}

// Points per hour of an activity =
//   Σ over goals it feeds of min(rate*KPH, effectiveRemaining) * pointsPerUnit
export function activityPointsPerHour(
    model: Model,
    activity: Activity,
): number {
    let total = 0;
    for (const edge of activity.edges) {
        const found = findGoal(model, edge.goalId);
        if (!found) continue;
        const contribution = effectiveContribution(model, activity, edge);
        total += contribution * goalPointsPerUnit(model, edge.goalId);
    }
    return total;
}

// ---- Mutations (pure: return a new Model) ----------------------------------

// Apply ONE unit of an activity's contribution to every goal it feeds.
// Each edge caps at that goal's effective remaining independently; excess is
// wasted and does NOT spill to other goals.
export function applyActivity(model: Model, activityId: string): Model {
    const activity = model.activities.find((a) => a.id === activityId);
    if (!activity) return model;

    const addByGoal = new Map<string, number>();
    for (const edge of activity.edges) {
        addByGoal.set(
            edge.goalId,
            (addByGoal.get(edge.goalId) ?? 0) + edge.rate * activity.KPH,
        );
    }

    return mapGoals(model, (goal) => {
        const add = addByGoal.get(goal.id);
        if (add === undefined) return goal;
        const capped = Math.min(add, remaining(goal));
        return { ...goal, progress: goal.progress + capped };
    });
}

// Zero all progress.
export function resetModel(model: Model): Model {
    return mapGoals(model, (goal) => ({ ...goal, progress: 0 }));
}

// Helper: map every goal in the model through fn, returning a new model.
// Works across all three group kinds (nested count, pool, or leaf goals).
function mapCountMembers(
    goals: GoalMember[],
    fn: (goal: Goal) => Goal,
): GoalMember[] {
    return goals.map((m): GoalMember => {
        if (!("kind" in m)) return fn(m);
        if (m.kind === "count") {
            return { ...m, goals: mapCountMembers(m.goals, fn) };
        }
        return { ...m, goals: m.goals.map(fn) };
    });
}

function mapGoals(model: Model, fn: (goal: Goal) => Goal): Model {
    return {
        ...model,
        tasks: model.tasks.map((task) => ({
            ...task,
            groups: task.groups.map((group): RequirementGroup => {
                if (group.kind === "count") {
                    return {
                        ...group,
                        goals: mapCountMembers(group.goals, fn),
                    };
                }
                if (group.kind === "pool") {
                    return { ...group, goals: group.goals.map(fn) };
                }
                return {
                    ...group,
                    bundles: group.bundles.map((b) => ({
                        ...b,
                        goals: b.goals.map(fn),
                    })),
                };
            }),
        })),
    };
}

// Adjust a single goal's progress by delta, clamped to [0, target].
function adjustGoal(model: Model, goalId: string, delta: number): Model {
    return mapGoals(model, (goal) =>
        goal.id === goalId
            ? {
                  ...goal,
                  progress: Math.min(
                      goal.target,
                      Math.max(0, goal.progress + delta),
                  ),
              }
            : goal,
    );
}

// Add one unit of progress to a goal (capped at target).
export function incrementGoal(model: Model, goalId: string): Model {
    return adjustGoal(model, goalId, 1);
}

// Remove one unit of progress from a goal (floored at 0).
export function decrementGoal(model: Model, goalId: string): Model {
    return adjustGoal(model, goalId, -1);
}

export function setActivityKPH(
    model: Model,
    activityId: string,
    KPH: number,
): Model {
    return {
        ...model,
        activities: model.activities.map((a) =>
            a.id === activityId ? { ...a, KPH } : a,
        ),
    };
}
