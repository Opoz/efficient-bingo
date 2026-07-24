// Wires the two independently-generated halves of the Model together: tasks
// come from tile_requirements.json (via transformTiles.ts), activities come
// from drops.json (via lib/transformDrops.ts, pre-run into
// data/drops_formatted.json — see `npm run transform:drops`).

import type { Model } from "./model";
import { buildModelFromTiles } from "./transformTiles";
import dropsFormatted from "../data/drops_formatted.json";

export function buildModel(): Model {
    return {
        tasks: buildModelFromTiles().tasks,
        activities: dropsFormatted as Model["activities"],
    };
}
