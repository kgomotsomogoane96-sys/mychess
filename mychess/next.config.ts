import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["stockfish"],
  // Environment files are injected by Vercel at runtime. Excluding them from
  // tracing keeps local secrets out of the prebuilt deployment artifact.
  outputFileTracingExcludes: {
    "/*": ["./.env", "./.env.local", "./.env.*.local", "./.env.example"],
  },
  // The engine's JS is traced automatically, but its WASM binary is not.
  // Without it, spawned Stockfish exits immediately on Vercel.
  outputFileTracingIncludes: {
    "/*": [
      "node_modules/stockfish/bin/stockfish-19-lite-single.js",
      "node_modules/stockfish/bin/stockfish-19-lite-single.wasm",
    ],
  },
  async headers() {
    return [
      { source: "/engine/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/mc-seed.sql.gz", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
      { source: "/pieces/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
  async redirects() {
    return [
      { source: "/archive", destination: "/games", permanent: true },
      { source: "/study", destination: "/practice", permanent: true },
      { source: "/patterns", destination: "/habits", permanent: true },
      { source: "/login", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
