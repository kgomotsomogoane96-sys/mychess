import type { BoardThemeName, ClassName } from "@/lib/types";

export const CLASS_META: Record<
  ClassName,
  { label: string; glyph: string; color: string; ink: string; blurb: string }
> = {
  brilliant: {
    label: "Brilliant",
    glyph: "!!",
    color: "#14938f",
    ink: "#f7fffe",
    blurb: "A sound sacrifice. The engine still wants it.",
  },
  great: {
    label: "Great",
    glyph: "!",
    color: "#2f6fed",
    ink: "#f5f8ff",
    blurb: "The only move that holds the position together.",
  },
  best: {
    label: "Best",
    glyph: "★",
    color: "#2f7d4a",
    ink: "#f4fff7",
    blurb: "Stockfish's first choice.",
  },
  excellent: {
    label: "Excellent",
    glyph: "✦",
    color: "#5c9a55",
    ink: "#f7fff6",
    blurb: "A whisker from the best move.",
  },
  good: {
    label: "Good",
    glyph: "·",
    color: "#7d8f55",
    ink: "#fbfcf6",
    blurb: "Solid. The position barely notices.",
  },
  book: {
    label: "Book",
    glyph: "Bb",
    color: "#a67c3d",
    ink: "#fffaf1",
    blurb: "Still inside the local opening tree.",
  },
  inaccuracy: {
    label: "Inaccuracy",
    glyph: "?!",
    color: "#c4961a",
    ink: "#1c1608",
    blurb: "Playable, but a clearer move was there.",
  },
  mistake: {
    label: "Mistake",
    glyph: "?",
    color: "#d36a1e",
    ink: "#fff8f2",
    blurb: "This gives the opponent a real chance.",
  },
  miss: {
    label: "Miss",
    glyph: "✕",
    color: "#c45448",
    ink: "#fff7f5",
    blurb: "A winning idea was sitting on the board.",
  },
  blunder: {
    label: "Blunder",
    glyph: "??",
    color: "#b1332b",
    ink: "#fff6f5",
    blurb: "The evaluation swings hard.",
  },
};

export const BOARD_THEMES: Record<
  BoardThemeName,
  {
    light: string;
    dark: string;
    frame: string;
    last: string;
    select: string;
    coord: string;
    dot: string;
  }
> = {
  neon: {
    light: "#a8bbaa",
    dark: "#4b6855",
    frame: "#1b211d",
    last: "rgba(104, 255, 91, 0.48)",
    select: "rgba(163, 255, 88, 0.6)",
    coord: "#e9f5e8",
    dot: "#172b1c",
  },
  walnut: {
    light: "#f0d9b5",
    dark: "#b58863",
    frame: "#5c3b24",
    last: "rgba(232, 176, 64, 0.62)",
    select: "rgba(92, 59, 36, 0.28)",
    coord: "#f6ead7",
    dot: "#3d2818",
  },
  ink: {
    light: "#efe6d6",
    dark: "#667564",
    frame: "#243028",
    last: "rgba(226, 181, 106, 0.55)",
    select: "rgba(36, 48, 40, 0.28)",
    coord: "#efe6d6",
    dot: "#1c2820",
  },
  sage: {
    light: "#e8f0e4",
    dark: "#7d9a76",
    frame: "#2c4032",
    last: "rgba(201, 137, 58, 0.5)",
    select: "rgba(47, 125, 74, 0.28)",
    coord: "#f3f7f1",
    dot: "#243428",
  },
  ice: {
    light: "#eef3f7",
    dark: "#7f97b0",
    frame: "#243446",
    last: "rgba(226, 181, 106, 0.58)",
    select: "rgba(36, 52, 70, 0.24)",
    coord: "#f4f7fb",
    dot: "#1d2c3d",
  },
};

export const BAD_CLASSES = new Set<ClassName>(["inaccuracy", "mistake", "miss", "blunder"]);
export const SHARP_CLASSES = new Set<ClassName>(["mistake", "miss", "blunder", "brilliant", "great"]);

export function classMeta(name: string) {
  if (name in CLASS_META) return CLASS_META[name as ClassName];
  return CLASS_META.good;
}
