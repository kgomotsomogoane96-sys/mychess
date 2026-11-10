import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MYCHESS — your personal chess lab",
    short_name: "MYCHESS",
    description: "Stockfish reviews of your own games, plain-English coaching, puzzles from your positions, and a daily theory study.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0c0b",
    theme_color: "#63f45b",
    orientation: "any",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
