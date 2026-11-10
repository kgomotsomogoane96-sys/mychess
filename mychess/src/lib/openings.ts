import { Chess } from "chess.js";

type Line = { name: string; eco: string; sans: string[] };

const LINES: Line[] = [
  { name: "Italian Game", eco: "C50", sans: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"] },
  { name: "Two Knights Defense", eco: "C55", sans: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6"] },
  { name: "Evans Gambit", eco: "C51", sans: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "b4"] },
  { name: "Ruy Lopez", eco: "C60", sans: ["e4", "e5", "Nf3", "Nc6", "Bb5"] },
  { name: "Ruy Lopez, Morphy", eco: "C70", sans: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6"] },
  { name: "Ruy Lopez, Berlin", eco: "C65", sans: ["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6"] },
  { name: "Scotch Game", eco: "C44", sans: ["e4", "e5", "Nf3", "Nc6", "d4", "exd4"] },
  { name: "Philidor Defense", eco: "C41", sans: ["e4", "e5", "Nf3", "d6"] },
  { name: "Petrov Defense", eco: "C42", sans: ["e4", "e5", "Nf3", "Nf6"] },
  { name: "King's Gambit", eco: "C30", sans: ["e4", "e5", "f4"] },
  { name: "Vienna Game", eco: "C25", sans: ["e4", "e5", "Nc3"] },
  { name: "Sicilian Defense", eco: "B20", sans: ["e4", "c5"] },
  { name: "Sicilian, Open", eco: "B50", sans: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3"] },
  { name: "Sicilian Najdorf", eco: "B90", sans: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"] },
  { name: "Sicilian Dragon", eco: "B70", sans: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "g6"] },
  { name: "Sicilian Alapin", eco: "B22", sans: ["e4", "c5", "c3"] },
  { name: "Closed Sicilian", eco: "B23", sans: ["e4", "c5", "Nc3"] },
  { name: "French Defense", eco: "C00", sans: ["e4", "e6", "d4", "d5"] },
  { name: "French Winawer", eco: "C15", sans: ["e4", "e6", "d4", "d5", "Nc3", "Bb4"] },
  { name: "French Advance", eco: "C02", sans: ["e4", "e6", "d4", "d5", "e5"] },
  { name: "Caro-Kann", eco: "B10", sans: ["e4", "c6", "d4", "d5"] },
  { name: "Caro-Kann Advance", eco: "B12", sans: ["e4", "c6", "d4", "d5", "e5"] },
  { name: "Scandinavian Defense", eco: "B01", sans: ["e4", "d5"] },
  { name: "Alekhine Defense", eco: "B02", sans: ["e4", "Nf6"] },
  { name: "Pirc Defense", eco: "B07", sans: ["e4", "d6", "d4", "Nf6", "Nc3", "g6"] },
  { name: "Modern Defense", eco: "B06", sans: ["e4", "g6", "d4", "Bg7"] },
  { name: "Queen's Gambit", eco: "D06", sans: ["d4", "d5", "c4"] },
  { name: "Queen's Gambit Declined", eco: "D30", sans: ["d4", "d5", "c4", "e6"] },
  { name: "Slav Defense", eco: "D10", sans: ["d4", "d5", "c4", "c6"] },
  { name: "Queen's Gambit Accepted", eco: "D20", sans: ["d4", "d5", "c4", "dxc4"] },
  { name: "Nimzo-Indian", eco: "E20", sans: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"] },
  { name: "Queen's Indian", eco: "E12", sans: ["d4", "Nf6", "c4", "e6", "Nf3", "b6"] },
  { name: "King's Indian", eco: "E60", sans: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7"] },
  { name: "Grünfeld Defense", eco: "D80", sans: ["d4", "Nf6", "c4", "g6", "Nc3", "d5"] },
  { name: "Dutch Defense", eco: "A80", sans: ["d4", "f5"] },
  { name: "London System", eco: "D02", sans: ["d4", "d5", "Nf3", "Nf6", "Bf4"] },
  { name: "English Opening", eco: "A20", sans: ["c4", "e5"] },
  { name: "English Symmetrical", eco: "A30", sans: ["c4", "c5"] },
  { name: "Réti Opening", eco: "A09", sans: ["Nf3", "d5", "c4"] },
  { name: "Bird's Opening", eco: "A02", sans: ["f4"] },
];

export type OpeningMatch = { name: string; eco: string; bookPlies: number; uci: string[] };

function lineToUci(sans: string[]) {
  const chess = new Chess();
  const uci: string[] = [];
  for (const san of sans) {
    try {
      const move = chess.move(san);
      if (!move) break;
      uci.push(`${move.from}${move.to}${move.promotion ?? ""}`);
    } catch {
      break;
    }
  }
  return uci;
}

const COMPILED = LINES.map((line) => ({ ...line, uci: lineToUci(line.sans) })).filter(
  (line) => line.uci.length > 0,
);

export function matchOpening(uciMoves: string[]): OpeningMatch | null {
  let best: OpeningMatch | null = null;
  for (const line of COMPILED) {
    let i = 0;
    while (i < line.uci.length && i < uciMoves.length && line.uci[i] === uciMoves[i]) i += 1;
    if (i === 0) continue;
    if (!best || i > best.bookPlies) {
      best = { name: line.name, eco: line.eco, bookPlies: i, uci: line.uci };
    }
  }
  return best;
}

export function openingName(uciMoves: string[], header?: string | null, eco?: string | null) {
  const match = matchOpening(uciMoves);
  if (header && (!match || match.bookPlies < 3)) {
    return { name: header, eco: eco || match?.eco || null, bookPlies: match?.bookPlies ?? 0 };
  }
  if (match && match.bookPlies >= 1) {
    return { name: match.name, eco: eco || match.eco, bookPlies: match.bookPlies };
  }
  return { name: header || "Uncharted opening", eco: eco || null, bookPlies: 0 };
}
