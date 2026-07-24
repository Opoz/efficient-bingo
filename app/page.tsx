"use client";

import { useEffect, useMemo, useState } from "react";
import type { Activity, Model, Task } from "@/lib/model";
import {
  activityPointsPerHour,
  decrementGoal,
  findGoal,
  groupGoals,
  incrementGoal,
  isTaskDone,
  resetModel,
  setActivityKPH,
} from "@/lib/model";
import { seedModel } from "@/lib/seed";
import { clearSaved, hydrateModel, saveModel } from "@/lib/persistence";
import { TaskTile } from "./TaskTile";
import { ActivityTile } from "./ActivityTile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildModelFromTiles } from "@/lib/transformTiles";

export default function Page() {
  // First render always uses the plain seed (matches the server render, so no
  // hydration mismatch). We overlay persisted state in a mount effect below.
  //const [model, setModel] = useState<Model>(seedModel);
  const [model, setModel] = useState<Model>(buildModelFromTiles());
  const [query, setQuery] = useState("");
  const [hydrated, setHydrated] = useState(false);

  // On mount (client only): overlay saved progress/KPH onto the seed.
  useEffect(() => {
    //setModel(hydrateModel(seedModel));
    setModel(hydrateModel(buildModelFromTiles()));
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
    setModel((m) => resetModel(m)); // the save effect then re-writes zeros
  };

  const q = query.trim().toLowerCase();

  // --- Tasks: filter, then sort done-to-bottom, points desc, name asc ---
  const visibleTasks = useMemo(() => {
    const matches = (task: Task) => {
      if (!q) return true;
      if (task.name.toLowerCase().includes(q)) return true;
      return task.groups.some((g) =>
        groupGoals(g).some((goal) => goal.name.toLowerCase().includes(q))
      );
    };
    return model.tasks
      .filter(matches)
      .slice()
      .sort((a, b) => {
        const aDone = isTaskDone(a);
        const bDone = isTaskDone(b);
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
        return found ? found.goal.name.toLowerCase().includes(q) : false;
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
          placeholder="Search tasks & activities…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button size="sm" className="ml-auto" onClick={handleReset}>
          Reset
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-2">
        <section className="flex min-h-0 flex-col gap-3.5 overflow-y-auto pr-1">
          <h2 className="sticky top-0 z-10 m-0 bg-background pb-2 pt-1 text-xs uppercase tracking-widest text-osrs-gold">
            Tasks
          </h2>
          {visibleTasks.map((task) => (
            <TaskTile
              key={task.id}
              task={task}
              onIncrementGoal={(goalId) =>
                setModel((m) => incrementGoal(m, goalId))
              }
              onDecrementGoal={(goalId) =>
                setModel((m) => decrementGoal(m, goalId))
              }
            />
          ))}
          {visibleTasks.length === 0 && (
            <p className="text-sm italic text-muted-foreground">
              No matching tasks.
            </p>
          )}
        </section>

        <section className="flex min-h-0 flex-col gap-3.5 overflow-y-auto pr-1">
          <h2 className="sticky top-0 z-10 m-0 bg-background pb-2 pt-1 text-xs uppercase tracking-widest text-osrs-gold">
            Activities
          </h2>
          {visibleActivities.map((activity) => (
            <ActivityTile
              key={activity.id}
              model={model}
              activity={activity}
              onKPHChange={(KPH) =>
                setModel((m) => setActivityKPH(m, activity.id, KPH))
              }
            />
          ))}
          {visibleActivities.length === 0 && (
            <p className="text-sm italic text-muted-foreground">
              No matching activities.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
