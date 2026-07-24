"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Mock card geometry, in px — every number below is derived from these, not
// eyeballed. Each row has a FIXED height (set via explicit h-* classes on
// the row, not left to natural text flow), so its vertical center is pure
// arithmetic: header, then each row stacked below it.
const CARD_WIDTH = 320;
const HEADER_H = 56;
const ROW_H = 40;
const FOOTER_H = 48;
const CARD_TOP = 18; // top margin inside the wrapper, for breathing room
// Header, KPH row, 2 edge rows (same item, two tiles), footer.
const CARD_HEIGHT = HEADER_H + ROW_H * 3 + FOOTER_H;
const WRAPPER_H = CARD_TOP * 2 + CARD_HEIGHT;
const WRAPPER_W = 760; // wide enough for the nowrap captions without scrolling

const kphRowY = CARD_TOP + HEADER_H + ROW_H / 2;
const edgeRow1Y = CARD_TOP + HEADER_H + ROW_H + ROW_H / 2;
const edgeRow2Y = CARD_TOP + HEADER_H + ROW_H * 2 + ROW_H / 2;
const footerRowY = CARD_TOP + HEADER_H + ROW_H * 3 + FOOTER_H / 2;

const CALLOUT_X = 376; // left edge of callout text
const ARROW_TAIL_X = 372; // arrow starts just left of the callout text
const ARROW_HEAD_X = CARD_WIDTH + 4; // arrowhead lands just past the card's right edge

// The point: "Ancient hilt" drops once, but shows up as TWO separate rows —
// one per tile it could complete. It's the same physical item; you decide
// which tile to credit it to by clicking +1 on that row specifically (the
// other row's +1 stays untouched). The two rows are worth wildly different
// points because of how each tile is structured, which is exactly why the
// choice matters.
// Kept deliberately short and forced to whitespace-nowrap below — long
// wrapped captions at fixed row spacing is exactly what caused the previous
// version's text to overlap between rows.
const CALLOUTS = [
    { y: kphRowY, text: "Same 10 KPH feeds every row below." },
    { y: edgeRow1Y, text: "Pool of 6 — any ONE finishes it → 6 pts." },
    { y: edgeRow2Y, text: "1 of 4 AND'd pieces → only 1 pt." },
    { y: footerRowY, text: "Real total, all 8 drops (2 shown)." },
];

export function ArrowOverlayDialog() {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    title="Experimental: SVG arrow overlay demo"
                >
                    Shared Drops Example
                </Button>
            </DialogTrigger>
            <DialogContent className="w-fit max-w-[calc(100vw-2rem)]">
                <DialogHeader>
                    <DialogTitle>Annotated Activity Card (demo)</DialogTitle>
                </DialogHeader>
                <div className="overflow-x-auto p-4">
                    <div
                        className="relative"
                        style={{ width: WRAPPER_W, height: WRAPPER_H }}
                    >
                        {/* Mock card — static, non-interactive replica of the real ActivityTile */}
                        <div
                            className="rs-stone-bg absolute left-0 border-2 border-black border-l-4 border-l-rs-orange shadow-[inset_-1px_-1px_0_rgba(0,0,0,0.5),inset_1px_1px_0_rgba(255,255,255,0.08)]"
                            style={{ top: CARD_TOP, width: CARD_WIDTH }}
                        >
                            <div
                                className="flex flex-col justify-center border-b-2 border-black bg-rs-brown-dark/50 px-3"
                                style={{ height: HEADER_H }}
                            >
                                <div className="text-[10px] uppercase tracking-widest text-rs-brown-light">
                                    Activity
                                </div>
                                <div className="text-sm font-bold text-rs-orange">
                                    Nex
                                </div>
                            </div>
                            <div
                                className="flex items-center gap-2 px-3 text-xs text-rs-brown-light"
                                style={{ height: ROW_H }}
                            >
                                <span>KPH ×</span>
                                <span className="border-2 border-black bg-[hsl(var(--input))] px-2 py-0.5 text-rs-orange">
                                    10
                                </span>
                            </div>
                            <div
                                className="flex items-center justify-between border-t-2 border-black/40 px-3 text-xs"
                                style={{ height: ROW_H }}
                            >
                                <span className="text-rs-orange">
                                    → Ancient hilt{" "}
                                    <span className="text-rs-brown-light">
                                        (Nex Unique)
                                    </span>
                                </span>
                                <span className="tabular-nums text-rs-gold">
                                    1/516 × 10 ≈ 0.02 × 6.00 = 0.12
                                </span>
                            </div>
                            <div
                                className="flex items-center justify-between border-t-2 border-black/40 px-3 text-xs"
                                style={{ height: ROW_H }}
                            >
                                <span className="text-rs-orange">
                                    → Ancient hilt{" "}
                                    <span className="text-rs-brown-light">
                                        (Full Godsword)
                                    </span>
                                </span>
                                <span className="tabular-nums text-rs-gold">
                                    1/516 × 10 ≈ 0.02 × 1.00 = 0.02
                                </span>
                            </div>
                            <div
                                className="flex items-center justify-between border-t-2 border-black bg-rs-brown-dark/30 px-3"
                                style={{ height: FOOTER_H }}
                            >
                                <span className="text-[11px] uppercase text-rs-brown-light">
                                    Points / hour
                                </span>
                                <span className="text-lg font-bold text-rs-gold">
                                    1.33
                                </span>
                            </div>
                        </div>

                        {/* Callout labels — whitespace-nowrap is load-bearing here: it
                            guarantees single-line text, so a caption can never wrap
                            and spill into the next row's vertical space. Any overflow
                            just scrolls horizontally (the wrapper below is
                            overflow-x-auto) instead of corrupting the layout. */}
                        {CALLOUTS.map((c, i) => (
                            <div
                                key={i}
                                className="absolute whitespace-nowrap text-xs text-rs-brown-light"
                                style={{
                                    left: CALLOUT_X,
                                    top: c.y - 8,
                                }}
                            >
                                {c.text}
                            </div>
                        ))}

                        {/* Arrow overlay — pure arithmetic from the constants above,
                            no measured/guessed coordinates. */}
                        <svg
                            className="pointer-events-none absolute left-0 top-0"
                            width={WRAPPER_W}
                            height={WRAPPER_H}
                            viewBox={`0 0 ${WRAPPER_W} ${WRAPPER_H}`}
                        >
                            {CALLOUTS.map((c, i) => (
                                <g
                                    key={i}
                                    stroke="currentColor"
                                    className="text-rs-gold"
                                >
                                    <line
                                        x1={ARROW_TAIL_X}
                                        y1={c.y}
                                        x2={ARROW_HEAD_X + 6}
                                        y2={c.y}
                                        strokeWidth={2}
                                    />
                                    <polyline
                                        points={`${ARROW_HEAD_X + 12},${c.y - 6} ${ARROW_HEAD_X},${c.y} ${ARROW_HEAD_X + 12},${c.y + 6}`}
                                        fill="none"
                                        strokeWidth={2}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </g>
                            ))}
                        </svg>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
