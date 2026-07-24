// Pure model for the task-activity contribution system.
// No React, no side effects here — just types and pure functions.

export interface Goal {
  id: string;
  name: string;
  target: number;
  progress: number; // starts at 0
}

// A member of a CountGroup is either a leaf Goal or a nested CountGroup.
export type GoalMember = Goal | CountGroup;

export function isMemberSatisfied(member: GoalMember): boolean {
  return "kind" in member ? isGroupSatisfied(member) : isGoalSatisfied(member);
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

export type RequirementGroup = CountGroup | BundleGroup;

// Iterate every leaf Goal inside a group regardless of its kind.
export function groupGoals(group: RequirementGroup): Goal[] {
  if (group.kind === "count") {
    return group.goals.flatMap((m) =>
      "kind" in m ? groupGoals(m) : [m]
    );
  }
  return group.bundles.flatMap((b) => b.goals);
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

// count → K-of-N satisfied members; bundle → some bundle fully satisfied.
export function isGroupSatisfied(group: RequirementGroup): boolean {
  if (group.kind === "count") {
    const satisfied = group.goals.filter(isMemberSatisfied).length;
    return satisfied >= group.requiredCount;
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
  goalId: string
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
// Otherwise the raw remaining (target - progress).
export function effectiveRemaining(model: Model, goalId: string): number {
  const found = findGoal(model, goalId);
  if (!found) return 0;
  if (isGroupSatisfied(found.group)) return 0;
  return remaining(found.goal);
}

// Effective contribution for a single edge given current state:
// rate * KPH, HARD-CAPPED at the goal's effective remaining. Overflow wasted.
export function effectiveContribution(
  model: Model,
  activity: Activity,
  edge: ActivityEdge
): number {
  const raw = edge.rate * activity.KPH;
  return Math.min(raw, effectiveRemaining(model, edge.goalId));
}

// Points per hour of an activity =
//   Σ over goals it feeds of min(rate*KPH, effectiveRemaining) * points
export function activityPointsPerHour(model: Model, activity: Activity): number {
  let total = 0;
  for (const edge of activity.edges) {
    const found = findGoal(model, edge.goalId);
    if (!found) continue;
    const contribution = effectiveContribution(model, activity, edge);
    total += contribution * found.task.points;
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
      (addByGoal.get(edge.goalId) ?? 0) + edge.rate * activity.KPH
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
// Works across both group kinds (count goals or bundle goals).
function mapCountMembers(
  goals: GoalMember[],
  fn: (goal: Goal) => Goal
): GoalMember[] {
  return goals.map((m) =>
    "kind" in m
      ? { ...m, goals: mapCountMembers(m.goals, fn) }
      : fn(m)
  );
}

function mapGoals(model: Model, fn: (goal: Goal) => Goal): Model {
  return {
    ...model,
    tasks: model.tasks.map((task) => ({
      ...task,
      groups: task.groups.map((group): RequirementGroup => {
        if (group.kind === "count") {
          return { ...group, goals: mapCountMembers(group.goals, fn) };
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
          progress: Math.min(goal.target, Math.max(0, goal.progress + delta)),
        }
      : goal
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
  KPH: number
): Model {
  return {
    ...model,
    activities: model.activities.map((a) =>
      a.id === activityId ? { ...a, KPH } : a
    ),
  };
}
