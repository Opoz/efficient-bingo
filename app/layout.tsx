import type { Metadata, Viewport } from "next";
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
};

// Declares this page as an intentional dark theme (renders <meta
// name="color-scheme" content="dark">). Auto-dark extensions like Dark
// Reader check this before deciding whether to apply their own color
// filter — without it, they don't know the page is already dark and will
// try to "fix" it anyway, causing exactly the kind of tint/hue shift
// reported here.
export const viewport: Viewport = {
    colorScheme: "dark",
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
