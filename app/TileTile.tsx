"use client";

import type {
    CountGroup,
    Goal,
    PoolGroup,
    RequirementGroup,
    tile,
} from "@/lib/model";
import {
    isBundleSatisfied,
    isGoalSatisfied,
    isGroupSatisfied,
    isMemberSatisfied,
    istileDone,
    poolProgress,
    remaining,
} from "@/lib/model";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function TileTile({
    tile,
    onIncrementGoal,
    onDecrementGoal,
}: {
    tile: tile;
    onIncrementGoal: (goalId: string) => void;
    onDecrementGoal: (goalId: string) => void;
}) {
    const done = istileDone(tile);
    return (
        // tiles: gold-tinted left border to distinguish from activities.
        // Fixed height + internal scroll — every card is the same height
        // regardless of content, so the surrounding grid never has to
        // reconcile mismatched card heights.
        <Card className="flex h-[400px] w-full flex-col border-l-4 border-l-osrs-gold">
            <CardHeader className="shrink-0 pb-3">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                            tile
                        </div>
                        <div className="text-base font-semibold text-osrs-yellow">
                            {tile.name}
                        </div>
                    </div>
                    {done ? (
                        <Badge variant="success">DONE</Badge>
                    ) : (
                        <Badge variant="gold">
                            {tile.points} point{tile.points === 1 ? "" : "s"}
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-3 overflow-y-auto">
                {tile.groups.map((group) => (
                    <GroupBlock
                        key={group.id}
                        group={group}
                        onIncrementGoal={onIncrementGoal}
                        onDecrementGoal={onDecrementGoal}
                    />
                ))}
            </CardContent>
        </Card>
    );
}

function GroupBlock({
    group,
    onIncrementGoal,
    onDecrementGoal,
}: {
    group: RequirementGroup;
    onIncrementGoal: (goalId: string) => void;
    onDecrementGoal: (goalId: string) => void;
}) {
    const groupSatisfied = isGroupSatisfied(group);

    if (group.kind === "bundle") {
        return (
            <div className="rounded-md border border-dashed border-osrs-gold/50 bg-osrs-gold/5 p-2.5">
                <GroupHeader
                    label={`Complete ALL of one option${group.label ? ` — ${group.label}` : ""}`}
                    satisfied={groupSatisfied}
                />
                {group.bundles.map((bundle, i) => {
                    const bundleSatisfied = isBundleSatisfied(bundle);
                    // Goals in a non-winning bundle become redundant once the group is
                    // satisfied by some other bundle.
                    const redundantBundle = groupSatisfied && !bundleSatisfied;
                    return (
                        <div key={bundle.id}>
                            {i > 0 && (
                                <div className="my-1.5 text-center text-[10px] font-bold tracking-[0.12em] text-osrs-gold">
                                    OR
                                </div>
                            )}
                            <div
                                className={cn(
                                    "rounded-md border p-2.5",
                                    bundleSatisfied
                                        ? "border-osrs-green/50 bg-osrs-green/5"
                                        : "border-border bg-osrs-black/20",
                                )}
                            >
                                <div className="mb-2 text-xs font-semibold text-foreground">
                                    {bundle.label ??
                                        `Option ${String.fromCharCode(65 + i)}`}
                                    {bundleSatisfied && (
                                        <span className="ml-1 text-osrs-green">
                                            {" "}
                                            ✓
                                        </span>
                                    )}
                                </div>
                                {bundle.goals.map((goal) => (
                                    <GoalRow
                                        key={goal.id}
                                        goal={goal}
                                        redundant={redundantBundle}
                                        onIncrementGoal={onIncrementGoal}
                                        onDecrementGoal={onDecrementGoal}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    if (group.kind === "pool") {
        return (
            <PoolBlock
                group={group}
                onIncrementGoal={onIncrementGoal}
                onDecrementGoal={onDecrementGoal}
            />
        );
    }

    // count-mode group
    const optional = group.requiredCount < group.goals.length;
    const hasSubGroups = group.goals.some((m) => "kind" in m);
    return (
        <div
            className={cn(
                optional &&
                    "rounded-md border border-dashed border-osrs-gold/50 bg-osrs-gold/5 p-2.5",
            )}
        >
            {(optional || group.label) && (
                <GroupHeader
                    label={
                        (optional
                            ? `Complete ${group.requiredCount} of ${group.goals.length}`
                            : (group.label ?? "")) +
                        (group.label && optional ? ` — ${group.label}` : "")
                    }
                    satisfied={groupSatisfied}
                />
            )}
            {group.goals.map((member, i) => {
                const memberSatisfied = isMemberSatisfied(member);
                const redundant = groupSatisfied && !memberSatisfied;
                if ("kind" in member) {
                    return (
                        <div key={member.id}>
                            {optional && hasSubGroups && i > 0 && (
                                <div className="my-1.5 text-center text-[10px] font-bold tracking-[0.12em] text-osrs-gold">
                                    OR
                                </div>
                            )}
                            <SubGroupBlock
                                group={member}
                                redundant={redundant}
                                onIncrementGoal={onIncrementGoal}
                                onDecrementGoal={onDecrementGoal}
                            />
                        </div>
                    );
                }
                return (
                    <GoalRow
                        key={member.id}
                        goal={member}
                        redundant={groupSatisfied && !isGoalSatisfied(member)}
                        onIncrementGoal={onIncrementGoal}
                        onDecrementGoal={onDecrementGoal}
                    />
                );
            })}
        </div>
    );
}

// Pool: interchangeable goals where any combination of their progress
// summing to `target` satisfies the group (e.g. "any 2 of these 7 TOB
// purples" — 2 of the same item counts the same as 1 of two different
// ones). Shows a combined progress bar plus a row per item; once the pool
// total reaches target every row greys out together, regardless of which
// items actually supplied the progress.
//
// A pool of exactly one item (the common case — tiles that just want N of a
// single item collapse to a 1-item pool) has nothing to combine: its lone
// GoalRow already shows the same progress/target the wrapper would, so skip
// the wrapper entirely rather than show a redundant "combined" line.
//
// A pool with target === 1 is a pure OR — "any 1 of these N items" (e.g. a
// hilt, any_pet, champion_scroll). Reaching it never involves combining
// partial progress across items, so the "combined" total/progress-bar adds
// nothing; only the per-item rows (with the header naming the OR) matter.
function PoolBlock({
    group,
    onIncrementGoal,
    onDecrementGoal,
}: {
    group: PoolGroup;
    onIncrementGoal: (goalId: string) => void;
    onDecrementGoal: (goalId: string) => void;
}) {
    const total = poolProgress(group);
    const satisfied = total >= group.target;
    const pct =
        group.target > 0 ? Math.min(100, (total / group.target) * 100) : 100;

    if (group.goals.length === 1) {
        return (
            <GoalRow
                goal={group.goals[0]}
                redundant={false}
                onIncrementGoal={onIncrementGoal}
                onDecrementGoal={onDecrementGoal}
            />
        );
    }

    const showCombined = group.target > 1;

    return (
        <div className="rounded-md border border-dashed border-osrs-gold/50 bg-osrs-gold/5 p-2.5">
            <GroupHeader
                label={
                    showCombined
                        ? `Any ${group.target} total${group.label ? ` — ${group.label}` : ""}`
                        : `Any 1 of ${group.goals.length}${group.label ? ` — ${group.label}` : ""}`
                }
                satisfied={satisfied}
            />
            {showCombined && (
                <>
                    <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                        <span>combined</span>
                        <span>
                            {round(total)}/{group.target}
                        </span>
                    </div>
                    <Progress points={pct} complete={satisfied} />
                </>
            )}
            <div className={showCombined ? "mt-2.5" : undefined}>
                {group.goals.map((goal) => (
                    <GoalRow
                        key={goal.id}
                        goal={goal}
                        redundant={satisfied && !isGoalSatisfied(goal)}
                        onIncrementGoal={onIncrementGoal}
                        onDecrementGoal={onDecrementGoal}
                    />
                ))}
            </div>
        </div>
    );
}

function SubGroupBlock({
    group,
    redundant,
    onIncrementGoal,
    onDecrementGoal,
}: {
    group: CountGroup | PoolGroup;
    redundant: boolean;
    onIncrementGoal: (goalId: string) => void;
    onDecrementGoal: (goalId: string) => void;
}) {
    const satisfied = isGroupSatisfied(group);

    if (group.kind === "pool") {
        const total = poolProgress(group);
        const pct =
            group.target > 0
                ? Math.min(100, (total / group.target) * 100)
                : 100;

        // Single-item pool — nothing to combine, skip the wrapper (see PoolBlock).
        if (group.goals.length === 1) {
            return (
                <GoalRow
                    goal={group.goals[0]}
                    redundant={redundant}
                    onIncrementGoal={onIncrementGoal}
                    onDecrementGoal={onDecrementGoal}
                />
            );
        }

        const showCombined = group.target > 1;

        return (
            <div
                className={cn(
                    "rounded-md border p-2.5",
                    satisfied
                        ? "border-osrs-green/50 bg-osrs-green/5"
                        : "border-border bg-osrs-black/20",
                    redundant && "opacity-45 grayscale",
                )}
            >
                <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-foreground">
                    <span>
                        {showCombined
                            ? `Any ${group.target} total`
                            : `Any 1 of ${group.goals.length}`}
                        {group.label ? ` — ${group.label}` : ""}
                    </span>
                    {satisfied && <span className="text-osrs-green">✓</span>}
                </div>
                {showCombined && (
                    <>
                        <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                            <span>combined</span>
                            <span>
                                {round(total)}/{group.target}
                            </span>
                        </div>
                        <Progress points={pct} complete={satisfied} />
                    </>
                )}
                <div className={showCombined ? "mt-2.5" : undefined}>
                    {group.goals.map((goal) => (
                        <GoalRow
                            key={goal.id}
                            goal={goal}
                            redundant={
                                redundant ||
                                (satisfied && !isGoalSatisfied(goal))
                            }
                            onIncrementGoal={onIncrementGoal}
                            onDecrementGoal={onDecrementGoal}
                        />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div
            className={cn(
                "rounded-md border p-2.5",
                satisfied
                    ? "border-osrs-green/50 bg-osrs-green/5"
                    : "border-border bg-osrs-black/20",
                redundant && "opacity-45 grayscale",
            )}
        >
            {group.label && (
                <div className="mb-2 text-xs font-semibold text-foreground">
                    {group.label}
                    {satisfied && (
                        <span className="ml-1 text-osrs-green"> ✓</span>
                    )}
                </div>
            )}
            {group.goals.map((member) => {
                if ("kind" in member) {
                    // Deeper nesting — recurse
                    return (
                        <SubGroupBlock
                            key={member.id}
                            group={member}
                            redundant={
                                redundant ||
                                (satisfied && !isGroupSatisfied(member))
                            }
                            onIncrementGoal={onIncrementGoal}
                            onDecrementGoal={onDecrementGoal}
                        />
                    );
                }
                return (
                    <GoalRow
                        key={member.id}
                        goal={member}
                        redundant={
                            redundant || (satisfied && !isGoalSatisfied(member))
                        }
                        onIncrementGoal={onIncrementGoal}
                        onDecrementGoal={onDecrementGoal}
                    />
                );
            })}
        </div>
    );
}

function GroupHeader({
    label,
    satisfied,
}: {
    label: string;
    satisfied: boolean;
}) {
    return (
        <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold tracking-wide text-osrs-gold">
                {label}
            </span>
            {satisfied && <Badge variant="success">✓ satisfied</Badge>}
        </div>
    );
}

function GoalRow({
    goal,
    redundant,
    onIncrementGoal,
    onDecrementGoal,
}: {
    goal: Goal;
    redundant: boolean;
    onIncrementGoal: (goalId: string) => void;
    onDecrementGoal: (goalId: string) => void;
}) {
    const rem = remaining(goal);
    const pct =
        goal.target > 0
            ? Math.min(100, (goal.progress / goal.target) * 100)
            : 100;
    const satisfied = isGoalSatisfied(goal);
    return (
        <div
            className={cn(
                "mb-2.5 last:mb-0",
                redundant && "opacity-45 grayscale",
            )}
        >
            <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium text-foreground">{goal.name}</span>
                <span className="text-muted-foreground">
                    {round(goal.progress)}/{goal.target} · rem {round(rem)}
                </span>
            </div>
            <div className="mb-1.5 flex items-center gap-1.5">
                <Button
                    variant="stepper"
                    size="xs"
                    className="min-w-[34px]"
                    onClick={() => onDecrementGoal(goal.id)}
                    disabled={goal.progress <= 0}
                >
                    −1
                </Button>
                <Button
                    variant="stepper"
                    size="xs"
                    className="min-w-[34px]"
                    onClick={() => onIncrementGoal(goal.id)}
                    // Lock +1 when this goal is full OR redundant (its group is already
                    // satisfied by another goal/bundle).
                    disabled={satisfied || redundant}
                    title={
                        redundant ? "Group already satisfied — no points" : ""
                    }
                >
                    +1
                </Button>
                {satisfied && (
                    <span className="ml-auto text-[10px] font-bold tracking-wide text-osrs-green">
                        DONE
                    </span>
                )}
            </div>
            <Progress points={pct} complete={satisfied} />
        </div>
    );
}

function round(n: number): number {
    return Math.round(n * 100) / 100;
}
