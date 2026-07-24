import type { Metadata } from "next";
import "./globals.css";

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
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
