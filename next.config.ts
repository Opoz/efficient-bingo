import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Static export — GitHub Pages only serves static files, no Node server.
    output: "export",
    // This repo deploys as a project page at
    // https://opoz.github.io/efficient-bingo/, a subpath, not the domain
    // root — every asset URL needs this prefix or they 404 on Pages (while
    // still working fine locally, since localhost has no subpath).
    basePath: "/efficient-bingo",
};

export default nextConfig;
