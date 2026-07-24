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
    title: "tile–Activity Contribution Sim",
    description:
        "Local prototype for exploring tile/activity points contribution",
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
