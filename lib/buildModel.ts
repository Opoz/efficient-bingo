// Wires the two independently-generated halves of the Model together: tiles
// come from tile_requirements.json (via transformTiles.ts), activities come
// from drops.json (via lib/transformDrops.ts, pre-run into
// data/drops_formatted.json — see `npm run transform:drops`).

import type { Model } from "./model";
import { buildModelFromTiles } from "./transformTiles";
import dropsFormatted from "../data/drops_formatted.json";

export function buildModel(): Model {
    return {
        tiles: buildModelFromTiles().tiles,
        activities: dropsFormatted as Model["activities"],
    };
}
