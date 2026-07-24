import type { Model } from "./model";

// Board positions for tiles (in board coordinate space, pre-transform).
export interface Placement {
    x: number;
    y: number;
}

export const tilePlacements: Record<string, Placement> = {
    "tile-onboard": { x: 80, y: 60 },
    "tile-launch": { x: 80, y: 340 },
    "tile-ramp": { x: 80, y: 720 },
    "tile-release": { x: 80, y: 1000 },
    "tile-compliance": { x: 80, y: 1360 },
};

export const activityPlacements: Record<string, Placement> = {
    "act-writing": { x: 640, y: 60 },
    "act-review": { x: 640, y: 340 },
    "act-training": { x: 640, y: 640 },
    "act-audit": { x: 640, y: 940 },
};

// Seed model:
// - tiles with points 1, 2, 2, 3.
// - Existing tiles are wrapped in a single N-of-N group (preserves the old
//   implicit-AND behavior).
// - tile-ramp has a 1-of-2 (OR) group: "Docs Read" OR "Code Complete".
// - act-writing feeds tile-ramp's "Docs Read" goal, so satisfying the group by
//   finishing "Code Complete" instead makes act-writing's points from Docs Read
//   drop to 0 (redundant points).
// - act-review still feeds goals in TWO different tiles at different rates.
// - tile-release (points 4) uses a BUNDLE group: (Legal ∧ Security) OR
//   (Beta ∧ Load). act-audit feeds g-rel-security (Formal bundle only), so
//   satisfying the Lean bundle instead drops that edge's points to 0.
export const seedModel: Model = {
    tiles: [
        {
            id: "tile-onboard",
            name: "Onboard New Hire",
            points: 1,
            groups: [
                {
                    kind: "count",
                    id: "grp-onboard",
                    goals: [
                        {
                            id: "g-onboard-docs",
                            name: "Docs Read",
                            target: 4,
                            progress: 0,
                        },
                    ],
                    requiredCount: 1, // N-of-N (1 goal)
                },
            ],
        },
        {
            id: "tile-launch",
            name: "Launch Feature",
            points: 2,
            groups: [
                {
                    kind: "count",
                    id: "grp-launch",
                    goals: [
                        {
                            id: "g-launch-code",
                            name: "Code Complete",
                            target: 6,
                            progress: 0,
                        },
                        {
                            id: "g-launch-qa",
                            name: "QA Signoff",
                            target: 3,
                            progress: 0,
                        },
                    ],
                    requiredCount: 2, // N-of-N (both required = AND)
                },
            ],
        },
        {
            // Demonstrates an OR group: EITHER path satisfies the tile.
            id: "tile-ramp",
            name: "Ramp Up Skills",
            points: 2,
            groups: [
                {
                    kind: "count",
                    id: "grp-ramp",
                    label: "Learn the system",
                    goals: [
                        {
                            id: "g-ramp-docs",
                            name: "Docs Read",
                            target: 4,
                            progress: 0,
                        },
                        {
                            id: "g-ramp-code",
                            name: "Code Complete",
                            target: 3,
                            progress: 0,
                        },
                    ],
                    requiredCount: 1, // 1-of-2 = OR
                },
            ],
        },
        {
            // Demonstrates a BUNDLE-mode group (multi-goal OR):
            //   (Legal Sign-off AND Security Review) OR (Beta Feedback AND Load Test)
            id: "tile-release",
            name: "Ship Release",
            points: 4,
            groups: [
                {
                    kind: "bundle",
                    id: "grp-release",
                    label: "Choose a release path",
                    bundles: [
                        {
                            id: "bundle-formal",
                            label: "Formal path",
                            goals: [
                                {
                                    id: "g-rel-legal",
                                    name: "Legal Sign-off",
                                    target: 2,
                                    progress: 0,
                                },
                                {
                                    id: "g-rel-security",
                                    name: "Security Review",
                                    target: 3,
                                    progress: 0,
                                },
                            ],
                        },
                        {
                            id: "bundle-lean",
                            label: "Lean path",
                            goals: [
                                {
                                    id: "g-rel-beta",
                                    name: "Beta Feedback",
                                    target: 3,
                                    progress: 0,
                                },
                                {
                                    id: "g-rel-load",
                                    name: "Load Test",
                                    target: 2,
                                    progress: 0,
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: "tile-compliance",
            name: "Pass Compliance Audit",
            points: 3,
            groups: [
                {
                    kind: "count",
                    id: "grp-compliance",
                    goals: [
                        {
                            id: "g-compliance-controls",
                            name: "Controls Verified",
                            target: 5,
                            progress: 0,
                        },
                    ],
                    requiredCount: 1,
                },
            ],
        },
    ],
    activities: [
        {
            id: "act-writing",
            name: "Write Documentation",
            KPH: 1,
            edges: [
                { goalId: "g-onboard-docs", rate: 0.8 },
                { goalId: "g-launch-code", rate: 0.4 },
                { goalId: "g-ramp-docs", rate: 0.7 }, // feeds the OR group's docs goal
            ],
        },
        {
            id: "act-review",
            // Feeds goals in TWO tiles at different rates.
            name: "Peer Review",
            KPH: 1,
            edges: [
                { goalId: "g-onboard-docs", rate: 1.0 }, // points 1 tile
                { goalId: "g-launch-qa", rate: 0.5 }, // points 2 tile
            ],
        },
        {
            id: "act-training",
            name: "Run Training",
            KPH: 1,
            edges: [
                { goalId: "g-launch-code", rate: 1.0 },
                { goalId: "g-ramp-code", rate: 0.6 }, // the alternate OR path
            ],
        },
        {
            id: "act-audit",
            name: "Audit Controls",
            KPH: 1,
            edges: [
                { goalId: "g-compliance-controls", rate: 0.6 },
                { goalId: "g-rel-security", rate: 0.5 }, // feeds ONLY the Formal bundle
            ],
        },
    ],
};
