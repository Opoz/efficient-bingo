"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Activity, Model, tile } from "@/lib/model";
import {
    activityPointsPerHour,
    decrementGoal,
    findGoal,
    groupGoals,
    incrementGoal,
    istileDone,
    setActivityKPH,
} from "@/lib/model";
import { seedModel } from "@/lib/seed";
import { clearSaved, hydrateModel, saveModel } from "@/lib/persistence";
import { TileTile } from "./TileTile";
import { ActivityTile } from "./ActivityTile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { buildModel } from "@/lib/buildModel";
import { cn } from "@/lib/utils";

export default function Page() {
    // First render always uses the plain seed (matches the server render, so no
    // hydration mismatch). We overlay persisted state in a mount effect below.
    //const [model, setModel] = useState<Model>(seedModel);
    const [model, setModel] = useState<Model>(buildModel());
    const [query, setQuery] = useState("");
    const [hydrated, setHydrated] = useState(false);
    const [tilesCollapsed, setTilesCollapsed] = useState(false);
    const [activitiesCollapsed, setActivitiesCollapsed] = useState(false);

    // On mount (client only): overlay saved progress/KPH onto the seed.
    useEffect(() => {
        //setModel(hydrateModel(seedModel));
        setModel(hydrateModel(buildModel()));
        setHydrated(true);
    }, []);

    // Persist the mutable slice on every model change, but only after the
    // initial hydration so we don't clobber storage with the pre-hydrate seed.
    useEffect(() => {
        if (!hydrated) return;
        saveModel(model);
    }, [model, hydrated]);

    const handleReset = () => {
        clearSaved(); // remove persisted key → clean slate on reload
        // Rebuild fresh from source rather than zeroing the current model —
        // resetModel() only zeros goal progress, it has no concept of a
        // "default" KPH per activity. buildModel() already encodes both
        // (zero progress, KPH 1) since that's what a fresh model starts as.
        setModel(buildModel());
    };

    const q = query.trim().toLowerCase();

    // --- tiles: filter, then sort done-to-bottom, points desc, name asc ---
    const visibletiles = useMemo(() => {
        const matches = (tile: tile) => {
            if (!q) return true;
            if (tile.name.toLowerCase().includes(q)) return true;
            return tile.groups.some((g) =>
                groupGoals(g).some((goal) =>
                    goal.name.toLowerCase().includes(q),
                ),
            );
        };
        return model.tiles
            .filter(matches)
            .slice()
            .sort((a, b) => {
                const aDone = istileDone(a);
                const bDone = istileDone(b);
                if (aDone !== bDone) return aDone ? 1 : -1; // not-done first
                if (b.points !== a.points) return b.points - a.points; // points desc
                return a.name.localeCompare(b.name); // name asc
            });
    }, [model, q]);

    // --- Activities: filter, then sort by points/hr desc, name asc (live) ---
    const visibleActivities = useMemo(() => {
        const matches = (activity: Activity) => {
            if (!q) return true;
            if (activity.name.toLowerCase().includes(q)) return true;
            return activity.edges.some((edge) => {
                const found = findGoal(model, edge.goalId);
                return found
                    ? found.goal.name.toLowerCase().includes(q)
                    : false;
            });
        };
        return model.activities
            .filter(matches)
            .slice()
            .sort((a, b) => {
                const va = activityPointsPerHour(model, a);
                const vb = activityPointsPerHour(model, b);
                if (vb !== va) return vb - va; // points/hr desc
                return a.name.localeCompare(b.name); // name asc
            });
    }, [model, q]);

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
            <header className="z-20 flex flex-shrink-0 items-center gap-3 border-b border-border bg-osrs-dark-brown/60 px-4 py-2.5 backdrop-blur">
                <span className="whitespace-nowrap text-sm font-bold tracking-wide text-osrs-yellow">
                    Bingo Estimator
                </span>
                <Input
                    type="text"
                    className="mx-auto h-9 max-w-[480px]"
                    placeholder="Search tiles & activities…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                size="sm"
                                className="ml-auto"
                                onClick={handleReset}
                            >
                                Reset
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            Clears all progress and KPH back to defaults
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </header>

            <div
                className={cn(
                    "grid min-h-0 flex-1 grid-cols-1 gap-4 p-4",
                    tilesCollapsed && activitiesCollapsed
                        ? "md:grid-cols-[auto_auto]"
                        : tilesCollapsed
                          ? "md:grid-cols-[auto_1fr]"
                          : activitiesCollapsed
                            ? "md:grid-cols-[1fr_auto]"
                            : "md:grid-cols-2",
                )}
            >
                <section
                    className={cn(
                        "flex min-h-0 flex-col overflow-y-auto",
                        !tilesCollapsed && "pr-1",
                    )}
                >
                    <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-background pb-2 pt-1">
                        {!tilesCollapsed && (
                            <h2 className="m-0 text-xs uppercase tracking-widest text-osrs-gold">
                                tiles
                            </h2>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-osrs-gold"
                            onClick={() => setTilesCollapsed((v) => !v)}
                            title={tilesCollapsed ? "Show tiles" : "Hide tiles"}
                        >
                            {tilesCollapsed ? (
                                <ChevronRight className="h-4 w-4" />
                            ) : (
                                <ChevronLeft className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                    {!tilesCollapsed && (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-3.5">
                            {visibletiles.map((tile) => (
                                <TileTile
                                    key={tile.id}
                                    tile={tile}
                                    onIncrementGoal={(goalId) =>
                                        setModel((m) =>
                                            incrementGoal(m, goalId),
                                        )
                                    }
                                    onDecrementGoal={(goalId) =>
                                        setModel((m) =>
                                            decrementGoal(m, goalId),
                                        )
                                    }
                                />
                            ))}
                            {visibletiles.length === 0 && (
                                <p className="text-sm italic text-muted-foreground">
                                    No matching tiles.
                                </p>
                            )}
                        </div>
                    )}
                </section>

                <section
                    className={cn(
                        "flex min-h-0 flex-col overflow-y-auto",
                        !activitiesCollapsed && "pr-1",
                    )}
                >
                    <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-background pb-2 pt-1">
                        {!activitiesCollapsed && (
                            <h2 className="m-0 text-xs uppercase tracking-widest text-osrs-gold">
                                Activities
                            </h2>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-osrs-gold"
                            onClick={() => setActivitiesCollapsed((v) => !v)}
                            title={
                                activitiesCollapsed
                                    ? "Show activities"
                                    : "Hide activities"
                            }
                        >
                            {activitiesCollapsed ? (
                                <ChevronLeft className="h-4 w-4" />
                            ) : (
                                <ChevronRight className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                    {!activitiesCollapsed && (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-3.5">
                            {visibleActivities.map((activity) => (
                                <ActivityTile
                                    key={activity.id}
                                    model={model}
                                    activity={activity}
                                    onKPHChange={(KPH) =>
                                        setModel((m) =>
                                            setActivityKPH(m, activity.id, KPH),
                                        )
                                    }
                                    onIncrementGoal={(goalId) =>
                                        setModel((m) =>
                                            incrementGoal(m, goalId),
                                        )
                                    }
                                    onDecrementGoal={(goalId) =>
                                        setModel((m) =>
                                            decrementGoal(m, goalId),
                                        )
                                    }
                                />
                            ))}
                            {visibleActivities.length === 0 && (
                                <p className="text-sm italic text-muted-foreground">
                                    No matching activities.
                                </p>
                            )}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
