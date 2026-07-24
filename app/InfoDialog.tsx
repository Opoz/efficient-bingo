"use client";

import { Fragment } from "react";
import { Info } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Small self-contained arrow glyph, reused per row. Deliberately not one big
// diagram with hand-placed absolute coordinates spanning the whole popup —
// each arrow only has to be correct relative to its own tiny 24x16 viewBox,
// so there's nothing that can drift out of alignment with the surrounding
// layout.
function Arrow() {
    return (
        <svg
            viewBox="0 0 24 16"
            className="h-4 w-6 shrink-0 text-rs-gold"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="1" y1="8" x2="18" y2="8" />
            <polyline points="12,2 18,8 12,14" />
        </svg>
    );
}

// Worked example: Vardorvis's real Vestige roll drop (1/363), feeding the
// "3 DT2 Gold Rings" tile (4 points, needs 3 rolls). Real numbers, not
// cherry-picked to be clean — that's deliberate, since real drop rates
// almost never land on round numbers.
const ROWS: { label: string; value: string; caption: string }[] = [
    {
        label: "Drop rate",
        value: "1/363",
        caption: "Straight from the wiki's drop table for this monster.",
    },
    {
        label: "Your KPH",
        value: "× 32",
        caption:
            "Kills per hour — the one input you control, set on the activity card.",
    },
    {
        label: "Raw per hour",
        value: "≈ 0.09",
        caption: "rate × KPH, before any capping.",
    },
    {
        label: "Capped at remaining",
        value: "min(0.09, 3) = 0.09",
        caption:
            "Never counts more than what's still needed to finish the goal — anything past that is wasted, not banked. Here 0.09 is nowhere near the 3 needed, so nothing gets capped.",
    },
    {
        label: "Points per unit",
        value: "4 ÷ 3 ≈ 1.33",
        caption:
            "The tile's points split evenly across every unit its goal needs, so finishing all 3 rolls always nets exactly its stated 4 points — no more, no less.",
    },
];

// Vardorvis actually has 7 edges across 5 different tiles at once — the
// walkthrough above is just ONE of them (Vestige roll). The activity card's
// "Points / hour" is the sum of every edge's own contribution × points-per-
// unit, computed exactly the same way per edge. Numbers below are the real
// output of activityPointsPerHour() at 32 KPH, not hand-calculated. (None of
// Vardorvis's drops are shared between two tiles, so a plain sum is correct
// here — see the "Shared Drops Example" button for the case where a single
// drop feeds two tiles and the total takes the max instead of the sum.)
const EDGES: {
    item: string;
    tile: string;
    points: number;
    rate: string;
    line: string;
}[] = [
    {
        item: "Vestige roll",
        tile: "3 DT2 Gold Rings",
        points: 4,
        rate: "1/363",
        line: "0.09 × 1.33 = 0.12",
    },
    {
        item: "Chromium Ingot",
        tile: "Chromium Ingot",
        points: 1,
        rate: "3/1088",
        line: "0.09 × 1.00 = 0.09",
    },
    {
        item: "Executioner's axe head",
        tile: "Any SRA Axe Piece",
        points: 4,
        rate: "1/1088",
        line: "0.03 × 4.00 = 0.12",
    },
    {
        item: "Virtus mask",
        tile: "Any Virtus Piece",
        points: 5,
        rate: "1/3264",
        line: "0.01 × 5.00 = 0.05",
    },
    {
        item: "Virtus robe top",
        tile: "Any Virtus Piece",
        points: 5,
        rate: "1/3264",
        line: "0.01 × 5.00 = 0.05",
    },
    {
        item: "Virtus robe bottom",
        tile: "Any Virtus Piece",
        points: 5,
        rate: "1/3264",
        line: "0.01 × 5.00 = 0.05",
    },
    {
        item: "Butch (pet)",
        tile: "Any Pet",
        points: 7,
        rate: "1/3000",
        line: "0.01 × 7.00 = 0.07",
    },
];

export function InfoDialog() {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    title="How points/hour is calculated"
                >
                    <Info className="h-4 w-4" />
                    Points/Hour Help
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>How Points / Hour Works</DialogTitle>
                </DialogHeader>
                <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4 text-sm">
                    <p className="text-rs-brown-light">
                        Worked example:{" "}
                        <span className="text-rs-gold">Vardorvis</span> fought
                        at <span className="text-rs-gold">32 KPH</span>, feeding
                        the{" "}
                        <span className="text-rs-gold">3 DT2 Gold Rings</span>{" "}
                        tile (4 points, needs 3 vestige rolls).
                    </p>
                    <div className="grid grid-cols-[140px_110px_24px_1fr] items-center gap-x-3 gap-y-3">
                        {ROWS.map((row, i) => (
                            <Fragment key={i}>
                                <div className="text-xs uppercase text-rs-brown-light">
                                    {row.label}
                                </div>
                                <div className="font-bold tabular-nums text-rs-yellow">
                                    {row.value}
                                </div>
                                <Arrow />
                                <div className="text-xs text-rs-brown-light">
                                    {row.caption}
                                </div>
                            </Fragment>
                        ))}
                    </div>
                    <div className="flex items-center justify-between border-t-2 border-black pt-3">
                        <span className="text-xs uppercase text-rs-brown-light">
                            This drop's contribution
                        </span>
                        <span className="text-xl font-bold text-rs-gold">
                            0.09 × 1.33 ≈ 0.12
                        </span>
                    </div>

                    <div className="border-t-2 border-black pt-4">
                        <p className="mb-3 text-rs-brown-light">
                            But Vardorvis doesn't just feed that one tile — it
                            drops 7 different tracked items across{" "}
                            <span className="text-rs-gold">5 tiles</span> at
                            once. The card's{" "}
                            <span className="text-rs-gold">Points / hour</span>{" "}
                            is every drop's contribution × points-per-unit,
                            computed independently exactly like above, then{" "}
                            <span className="text-rs-gold">summed</span> —{" "}
                            <span className="text-rs-gold">unless</span> two
                            edges are the same physical drop feeding two
                            different tiles, in which case only the better one
                            counts (see the Shared Drops example).
                        </p>
                        <div className="grid grid-cols-[1fr_70px_100px_150px] gap-x-3 gap-y-1.5 text-xs">
                            <div className="text-rs-brown-light uppercase">
                                Item → tile
                            </div>
                            <div className="text-rs-brown-light uppercase">
                                Points
                            </div>
                            <div className="text-rs-brown-light uppercase">
                                Rate
                            </div>
                            <div className="text-rs-brown-light uppercase">
                                Contribution
                            </div>
                            {EDGES.map((e, i) => (
                                <Fragment key={i}>
                                    <div className="text-rs-orange">
                                        {e.item}{" "}
                                        <span className="text-rs-brown-light">
                                            → {e.tile}
                                        </span>
                                    </div>
                                    <div className="tabular-nums text-rs-yellow">
                                        {e.points}
                                    </div>
                                    <div className="tabular-nums text-rs-yellow">
                                        {e.rate}
                                    </div>
                                    <div className="tabular-nums text-rs-gold">
                                        {e.line}
                                    </div>
                                </Fragment>
                            ))}
                        </div>
                        <p className="mt-2 text-sm text-rs-brown-light">
                            The three Virtus rows all feed the{" "}
                            <span className="text-rs-gold">same</span> "Any
                            Virtus Piece" tile — it's a pool where any ONE of
                            them alone would finish it, so each gets full credit
                            (not split three ways) until the tile's actually
                            done. Rows are rounded to 2 decimals for display;
                            the total below is summed from full precision first,
                            so it won't always match adding up the rounded rows
                            exactly.
                        </p>
                        <div className="mt-3 flex items-center justify-between border-t-2 border-black pt-3">
                            <span className="text-xs uppercase text-rs-brown-light">
                                Points / hour (this activity)
                            </span>
                            <span className="text-xl font-bold text-rs-gold">
                                0.12+0.09+0.12+0.05+0.05+0.05+0.07 ≈ 0.55
                            </span>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
