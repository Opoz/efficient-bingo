import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const runescape = localFont({
    src: "./fonts/runescape.ttf",
    variable: "--font-runescape",
    display: "swap",
});

// runescapecn component fonts — the imported Button/Card/Dialog/Badge/etc.
// reference these CSS variables directly (font-[family-name:var(--font-rs)]
// and friends).
const rs = localFont({
    src: "./fonts/rs/RuneScape-Plain-12.ttf",
    variable: "--font-rs",
    display: "swap",
    fallback: ["monospace"],
});
const rsBold = localFont({
    src: "./fonts/rs/RuneScape-Bold-12.ttf",
    variable: "--font-rs-bold",
    display: "swap",
    fallback: ["monospace"],
});
const rsQuill = localFont({
    src: "./fonts/rs/RuneScape-Quill.ttf",
    variable: "--font-rs-quill",
    display: "swap",
    fallback: ["serif"],
});
const rsQuillCaps = localFont({
    src: "./fonts/rs/RuneScape-Quill-Caps.ttf",
    variable: "--font-rs-quill-caps",
    display: "swap",
    fallback: ["serif"],
});

export const metadata: Metadata = {
    title: "Efficient Bingo",
    description:
        "Local prototype for exploring tile/activity points contribution",
    // Dark Reader's own documented opt-out: a <meta name="darkreader-lock">
    // makes it skip this page's color processing entirely, rather than just
    // hinting via color-scheme (which it's free to ignore). Content value is
    // irrelevant — Dark Reader only checks the tag's presence — but Next's
    // metadata `other` field silently drops entries with an empty string
    // value, so it needs a non-empty placeholder to actually render. See
    // https://github.com/darkreader/darkreader#how-to-disable-dark-reader-on-your-website
    other: {
        "darkreader-lock": "1",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="en"
            className={`${runescape.variable} ${rs.variable} ${rsBold.variable} ${rsQuill.variable} ${rsQuillCaps.variable}`}
        >
            <body>{children}</body>
        </html>
    );
}
