import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Task–Activity Contribution Sim",
  description: "Local prototype for exploring task/activity points contribution",
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
