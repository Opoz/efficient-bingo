import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const runescape = localFont({
    src: "./fonts/runescape.ttf",
    variable: "--font-runescape",
    display: "swap",
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
        <html lang="en" className={runescape.variable}>
            <body>{children}</body>
        </html>
    );
}
