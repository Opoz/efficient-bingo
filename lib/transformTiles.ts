// Transforms tile_requirements.json into the Model tile format.
// Activities are not present in the tile data — the caller is responsible
// for populating model.activities separately.
//
// Conversion logic lives in tilesModel.ts (no JSON import of its own); this
// file just wires it to the bundler-resolved JSON import for app use.

import type { Model } from "./model";
import type { JsonTile } from "./tilesModel";
import tilesRaw from "../data/tile_requirements.json";
import { tilesToModel } from "./tilesModel";

export {
    itemSlug,
    goalId,
    buildItemGoalIndex,
    tilesToModel,
} from "./tilesModel";
export type { JsonItem, JsonReq, JsonTile } from "./tilesModel";

export function buildModelFromTiles(): Model {
    return tilesToModel(tilesRaw as Record<string, JsonTile>);
}
