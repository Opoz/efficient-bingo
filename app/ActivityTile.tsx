"use client";

import { useEffect, useState } from "react";
import type { Activity, Model } from "@/lib/model";
import {
    activityPointsPerHour,
    effectiveContribution,
    effectiveRemaining,
    findGoal,
} from "@/lib/model";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ActivityTile({
    model,
    activity,
    onKPHChange,
    onIncrementGoal,
    onDecrementGoal,
}: {
    model: Model;
    activity: Activity;
    onKPHChange: (KPH: number) => void;
    onIncrementGoal: (goalId: string) => void;
    onDecrementGoal: (goalId: string) => void;
}) {
    const points = activityPointsPerHour(model, activity);

    // Local raw text for the KPH input, so the field can be freely cleared
    // and retyped ("", "2.", "." etc.) without snapping back to the model points.
    const [KPHText, setKPHText] = useState<string>(String(activity.KPH));

    // Keep local text in sync when the model KPH changes from outside
    // (e.g. Reset), but only when it actually differs from what the user has
    // already typed, so mid-typing state is preserved.
    useEffect(() => {
        const parsed = parseFloat(KPHText);
        if (Number.isNaN(parsed) || parsed !== activity.KPH) {
            setKPHText(String(activity.KPH));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activity.KPH]);

    const handleKPHInput = (raw: string) => {
        setKPHText(raw); // always keep what the user typed
        const parsed = parseFloat(raw);
        if (!Number.isNaN(parsed) && parsed >= 0) {
            onKPHChange(parsed); // push up only when valid & non-negative
        }
    };

    const handleKPHBlur = () => {
        const parsed = parseFloat(KPHText);
        if (KPHText.trim() === "" || Number.isNaN(parsed) || parsed < 0) {
            setKPHText(String(activity.KPH)); // reset to model points
        }
    };

    return (
        // Activities: cooler neutral left border to distinguish from tiles.
        // Fixed height + internal scroll — every card is the same height
        // regardless of edge count, so the grid never has to reconcile
        // mismatched card heights. Only the edges list scrolls; the KPH
        // input and the points/hour summary stay put.
        <Card className="flex h-[400px] w-full flex-col border-l-4 border-l-osrs-border">
            <CardHeader className="shrink-0 pb-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Activity
                </div>
                <div className="text-base font-semibold text-foreground">
                    {activity.name}
                </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col space-y-3 overflow-hidden">
                <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    <span>KPH ×</span>
                    <Input
                        type="number"
                        step={1}
                        min={0}
                        className="h-8 w-[80px] text-xs tabular-nums"
                        value={KPHText}
                        onChange={(e) => handleKPHInput(e.target.value)}
                        onBlur={handleKPHBlur}
                    />
                </div>

                <ul className="flex-1 space-y-2 overflow-y-auto text-xs">
                    {activity.edges.map((edge, i) => {
                        const found = findGoal(model, edge.goalId);
                        if (!found) return null;
                        // Effective remaining is 0 both when the goal is full and when its
                        // group is already satisfied (redundant). Either way this edge adds
                        // no points, so grey it and lock +1.
                        const effRem = effectiveRemaining(model, edge.goalId);
                        const dead = effRem === 0;
                        const eff = round(
                            effectiveContribution(model, activity, edge),
                        );
                        return (
                            // goalId alone isn't unique here — the same item can feed more
                            // than one tile (e.g. a hilt counting toward both a boss-unique
                            // tile and a full-set tile), each as its own edge/row.
                            <li
                                key={`${edge.goalId}-${i}`}
                                className={cn(dead && "text-muted-foreground")}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="truncate">
                                        → {found.goal.name}{" "}
                                        <span className="text-muted-foreground">
                                            ({found.tile.name})
                                        </span>
                                    </span>
                                    <span className="tabular-nums text-osrs-gold">
                                        {edge.rateLabel ?? edge.rate} ×{" "}
                                        {round(activity.KPH)}
                                        <span className="ml-1 text-[10px] text-muted-foreground">
                                            = {eff}
                                        </span>
                                    </span>
                                </div>
                                <div className="mt-1 flex items-center gap-1.5">
                                    <Button
                                        variant="stepper"
                                        size="xs"
                                        className="min-w-[34px]"
                                        onClick={() =>
                                            onDecrementGoal(edge.goalId)
                                        }
                                        disabled={found.goal.progress <= 0}
                                    >
                                        −1
                                    </Button>
                                    <Button
                                        variant="stepper"
                                        size="xs"
                                        className="min-w-[34px]"
                                        onClick={() =>
                                            onIncrementGoal(edge.goalId)
                                        }
                                        // Lock +1 when this goal is full OR its group is already
                                        // satisfied another way (redundant — no points gained).
                                        disabled={dead}
                                        title={
                                            dead
                                                ? "Goal full or group already satisfied"
                                                : ""
                                        }
                                    >
                                        +1
                                    </Button>
                                    <span className="ml-auto text-[10px] text-muted-foreground">
                                        {round(found.goal.progress)}/
                                        {found.goal.target}
                                    </span>
                                </div>
                            </li>
                        );
                    })}
                </ul>

                <div className="flex shrink-0 items-baseline justify-between border-t border-border pt-3">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Points / hour
                    </span>
                    <span className="text-xl font-bold tabular-nums text-osrs-yellow">
                        {round(points)}
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}

function round(n: number): number {
    return Math.round(n * 100) / 100;
}
