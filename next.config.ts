import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Static export — GitHub Pages only serves static files, no Node server.
    output: "export",
    // This repo deploys as a project page at
    // https://opoz.github.io/efficient-bingo/, a subpath, not the domain
    // root — every asset URL needs this prefix or they 404 on Pages. Applies
    // to `next dev` too (not just build), so it's gated to production only —
    // otherwise localhost:3000/ 404s and you'd have to remember to visit
    // localhost:3000/efficient-bingo instead.
    basePath: process.env.NODE_ENV === "production" ? "/efficient-bingo" : "",
};

export default nextConfig;
