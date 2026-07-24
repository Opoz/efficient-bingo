import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: "class",
    content: [
        "./app/**/*.{ts,tsx}",
        "./components/**/*.{ts,tsx}",
        "./lib/**/*.{ts,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                osrs: ["var(--font-runescape)", "Arial", "sans-serif"],
                // runescapecn component fonts (Button/Card/Dialog/etc. reference
                // these directly via font-[family-name:var(--font-rs*)]) — kept
                // here too so they're also usable as plain `font-rs*` utilities.
                rs: ["var(--font-rs)", "monospace"],
                "rs-bold": ["var(--font-rs-bold)", "monospace"],
                "rs-quill": ["var(--font-rs-quill)", "serif"],
                "rs-quill-caps": ["var(--font-rs-quill-caps)", "serif"],
            },
            colors: {
                // OSRS raw palette
                osrs: {
                    yellow: "#FFCF3F",
                    gold: "#E6A519",
                    brown: "#694D23",
                    "dark-brown": "#382D1A",
                    black: "#0F0F0F",
                    green: "#00FF00",
                    red: "#FF0000",
                    blue: "#0088FF",
                    chat: "#00FFFF",
                    background: "#2E2C29",
                    border: "#474745",
                    panel: "#46433A",
                },
                // runescapecn component palette — the imported Button/Card/Badge/
                // Progress/Input/Dialog/Tooltip source styles itself with these
                // tokens directly (not the shadcn semantic --background/--primary
                // tokens below), so adding them doesn't touch our existing colors.
                "rs-gold": "#C9A961",
                "rs-orange": "#FF981F",
                "rs-brown-dark": "#1a1a1a",
                "rs-brown-medium": "#2a2a2a",
                "rs-brown-light": "#7a7a7a",
                "rs-green": "#00FF00",
                "rs-red": "#FF0000",
                "rs-yellow": "#FFEB3B",
                "rs-cyan": "#00FFFF",
                // shadcn semantic tokens (driven by CSS variables)
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
};

export default config;
