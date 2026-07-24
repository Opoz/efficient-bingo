// Transforms data/drops.json (scraped OSRS wiki drop tables, see
// keep/scrape.js) into Activity records for the Model schema (lib/model.ts).
//
// A drop only becomes an edge if its item name matches a goal produced by
// tilesModel.ts's buildItemGoalIndex — i.e. some bingo tile actually
// tracks that item. Sources with no matching drops are omitted entirely.
// KPH is fixed at 1 for every activity; edge.rate is the drop's rarity as a
// probability (0..1), computed from the "rarity" field ("Always" -> 1,
// "a/b" -> a/b). edge.rateLabel carries the cleaned original text (e.g.
// "1/128") through for display, so the UI can show that instead of a raw
// decimal. Rarities that are unresolved wiki templates or qualitative
// labels ("Rare", "Varies", ...) can't be computed and are skipped.
//
// Run with: npm run transform:drops
// (equivalent to: node --experimental-strip-types lib/transformDrops.ts)
// Writes: data/drops_formatted.json

import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

import type { Activity, ActivityEdge } from "./model.ts";
import { tilesToModel, buildItemGoalIndex, itemSlug } from "./tilesModel.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TILES_PATH = path.join(__dirname, "../data/tile_requirements.json");
const DROPS_PATH = path.join(__dirname, "../data/drops.json");
const OUT_PATH = path.join(__dirname, "../data/drops_formatted.json");
const KPH_PATH = path.join(__dirname, "../data/kph.json");

interface JsonDrop {
    name: string;
    quantity: string;
    rarity: string;
}

type JsonDrops = Record<string, JsonDrop[]>;

interface SkippedDrop {
    source: string;
    item: string;
    rarity: string;
}

interface ParsedRarity {
    rate: number;
    label: string; // cleaned rarity text, e.g. "1/128" or "Always" — for display
}

// "Always" -> 1, "a/b" -> a/b. Tolerates a stray "rarity=" prefix left over
// from the wiki scrape. Unresolved {{...}} templates and qualitative
// rarities ("Rare", "Varies", "Once", ...) can't be computed -> undefined.
export function parseRarity(raw: string): ParsedRarity | undefined {
    const cleaned = raw
        .trim()
        .replace(/^rarity=/i, "")
        .trim();
    if (/^always$/i.test(cleaned)) return { rate: 1, label: "Always" };

    const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    if (!match) return undefined;

    const numerator = Number(match[1]);
    const denominator = Number(match[2]);
    if (!Number.isFinite(numerator) || !denominator) return undefined;
    return { rate: numerator / denominator, label: cleaned };
}

// Items that legitimately match a tile goal but drop from so many different
// sources that they'd flood the activity list with junk (e.g. "curved bone"
// drops from ~100 different NPCs for a tile that just wants a handful of
// them). Listed items never produce an edge — a source keeps showing up if
// it has any OTHER matching drop, it just won't list this one.
const EXCLUDED_ITEMS = new Set(["curved bone"].map(itemSlug));

// Appends "-2", "-3", ... on collision so two differently-named sources that
// happen to slug identically don't clobber each other in the output.
function uniqueId(base: string, used: Map<string, number>): string {
    const seen = used.get(base);
    if (!seen) {
        used.set(base, 1);
        return base;
    }
    const next = seen + 1;
    used.set(base, next);
    return `${base}-${next}`;
}

function buildActivities(): { activities: Activity[]; skipped: SkippedDrop[] } {
    const tilesRaw = JSON.parse(fs.readFileSync(TILES_PATH, "utf8"));
    const model = tilesToModel(tilesRaw);
    const itemGoalIndex = buildItemGoalIndex(model);

    const dropsRaw = JSON.parse(
        fs.readFileSync(DROPS_PATH, "utf8"),
    ) as JsonDrops;

    const kphData = JSON.parse(fs.readFileSync(KPH_PATH, "utf8")) as Record<
        string,
        number
    >;

    const activities: Activity[] = [];
    const skipped: SkippedDrop[] = [];
    const usedIds = new Map<string, number>();

    for (const [source, drops] of Object.entries(dropsRaw)) {
        const edges: ActivityEdge[] = [];

        for (const drop of drops) {
            const slug = itemSlug(drop.name);
            if (EXCLUDED_ITEMS.has(slug)) continue;

            const goalIds = itemGoalIndex.get(slug);
            if (!goalIds) continue; // no tile tracks this item

            const parsed = parseRarity(drop.rarity);
            if (parsed === undefined) {
                skipped.push({ source, item: drop.name, rarity: drop.rarity });
                continue;
            }

            // A single drop feeding >1 goal is the same physical item
            // credited to multiple tiles (e.g. a hilt counting toward both
            // a boss-unique tile and a full-set tile) — tag these edges so
            // activityPointsPerHour takes the best one instead of summing
            // all of them (only tag when genuinely ambiguous; a drop
            // feeding just one goal needs no grouping).
            const dropGroup = goalIds.length > 1 ? slug : undefined;

            for (const goalId of goalIds) {
                edges.push({
                    goalId,
                    rate: parsed.rate,
                    rateLabel: parsed.label,
                    dropGroup,
                });
            }
        }

        if (edges.length === 0) continue;

        const id = uniqueId(itemSlug(source), usedIds);

        activities.push({
            id,
            name: source,
            KPH: kphData[itemSlug(source)] ?? 1,
            edges,
        });
    }

    return { activities, skipped };
}

function main() {
    const { activities, skipped } = buildActivities();
    const edgeCount = activities.reduce((n, a) => n + a.edges.length, 0);

    fs.writeFileSync(OUT_PATH, JSON.stringify(activities, null, 2) + "\n");
    console.log(
        `Wrote ${activities.length} activities (${edgeCount} edges) to ${path.relative(process.cwd(), OUT_PATH)}`,
    );

    if (skipped.length > 0) {
        console.warn(
            `Skipped ${skipped.length} matched drop(s) with unparseable rarity:`,
        );
        for (const s of skipped.slice(0, 20)) {
            console.warn(`  - ${s.source} / ${s.item}: "${s.rarity}"`);
        }
        if (skipped.length > 20)
            console.warn(`  ...and ${skipped.length - 20} more`);
    }
}

main();
