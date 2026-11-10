import type { ColorName } from "@/lib/types";

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };

export type GameFacts = {
  openingLine: string;
  endgameType: string | null;
  endgameStartPly: number | null;
  endgameDiff: number | null;
  whiteCastledPly: number | null;
  blackCastledPly: number | null;
};

type Material = { white: number; black: number; nonPawnTotal: number; nonPawnCount: number; queens: number; rooks: number; minors: number; pawns: number };

export function materialFromFen(fen: string): Material {
  const board = fen.split(" ")[0];
  const result: Material = { white: 0, black: 0, nonPawnTotal: 0, nonPawnCount: 0, queens: 0, rooks: 0, minors: 0, pawns: 0 };
  for (const ch of board) {
    const lower = ch.toLowerCase();
    const value = PIECE_VALUE[lower];
    if (!value) continue;
    if (ch === lower) result.black += value; else result.white += value;
    if (lower === "p") { result.pawns += 1; continue; }
    result.nonPawnTotal += value; result.nonPawnCount += 1;
    if (lower === "q") result.queens += 1; else if (lower === "r") result.rooks += 1; else result.minors += 1;
  }
  return result;
}

export function isEndgame(material: Material) {
  return material.queens === 0 ? material.nonPawnTotal <= 13 : material.nonPawnCount <= 2;
}

export function endgameTypeOf(material: Material) {
  if (material.nonPawnCount === 0) return "pawn";
  if (material.queens && !material.rooks && !material.minors) return "queen";
  if (material.rooks && !material.queens && !material.minors) return "rook";
  if (material.minors && !material.queens && !material.rooks) return "minor piece";
  if (material.rooks && material.minors && !material.queens) return "rook & minor";
  return "queen & pieces";
}

export function gameFacts(moves: { san: string; color: "w" | "b"; fenAfter: string }[]): GameFacts {
  const facts: GameFacts = { openingLine: moves.slice(0, 12).map(move => move.san).join(" "), endgameType: null, endgameStartPly: null, endgameDiff: null, whiteCastledPly: null, blackCastledPly: null };
  moves.forEach((move, index) => {
    const ply = index + 1;
    if (move.san.startsWith("O-O")) { if (move.color === "w" && facts.whiteCastledPly == null) facts.whiteCastledPly = ply; if (move.color === "b" && facts.blackCastledPly == null) facts.blackCastledPly = ply; }
    if (facts.endgameStartPly == null && ply >= 16) {
      const material = materialFromFen(move.fenAfter);
      if (isEndgame(material)) { facts.endgameStartPly = ply; facts.endgameType = endgameTypeOf(material); facts.endgameDiff = material.white - material.black; }
    }
  });
  return facts;
}

export function resultForColor(result: string, color: ColorName | null): "win" | "loss" | "draw" | null {
  if (!color || result === "*") return null;
  if (result === "1/2-1/2") return "draw";
  const whiteWon = result === "1-0";
  return (whiteWon && color === "white") || (!whiteWon && color === "black") ? "win" : "loss";
}

const CHESSCOM_RESULTS: Record<string, string> = {
  win: "win", checkmated: "checkmate", resigned: "resignation", timeout: "time", abandoned: "abandonment", lose: "loss", agreed: "agreement", repetition: "repetition",
  stalemate: "stalemate", insufficient: "insufficient material", "50move": "fifty-move rule", timevsinsufficient: "time vs. insufficient material", kingofthehill: "variant", threecheck: "variant", bughousepartnerlose: "variant",
};

export function terminationLabel(yourResult: string | null, oppResult: string | null, text: string | null) {
  if (yourResult && oppResult) {
    if (yourResult === "win") return `Won by ${CHESSCOM_RESULTS[oppResult] ?? oppResult}`;
    if (oppResult === "win") return `Lost by ${CHESSCOM_RESULTS[yourResult] ?? yourResult}`;
    return `Draw by ${CHESSCOM_RESULTS[yourResult] ?? yourResult}`;
  }
  if (!text) return null;
  const lower = text.toLowerCase();
  if (lower.includes("time")) return lower.includes("won") ? "Won on time" : "Decided on time";
  if (lower.includes("checkmate")) return "Checkmate";
  if (lower.includes("resign")) return "Resignation";
  if (lower.includes("agree")) return "Draw by agreement";
  if (lower.includes("repetition")) return "Draw by repetition";
  if (lower.includes("stalemate")) return "Stalemate";
  if (lower.includes("insufficient")) return "Draw by insufficient material";
  return text.slice(0, 60);
}

export function terminationFromText(text: string | null): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (lower.includes("time")) return "timeout";
  if (lower.includes("checkmate")) return "checkmated";
  if (lower.includes("resign")) return "resigned";
  if (lower.includes("agree")) return "agreed";
  if (lower.includes("repetition")) return "repetition";
  if (lower.includes("stalemate")) return "stalemate";
  if (lower.includes("insufficient")) return "insufficient";
  if (lower.includes("abandon")) return "abandoned";
  return null;
}

const FAMILY_WORDS = new Set(["Defense", "Game", "Opening", "Gambit", "System", "Attack", "Variation", "Declined", "Accepted"]);
const FIXES: [RegExp, string][] = [[/\bQueens\b/g, "Queen's"], [/\bKings\b/g, "King's"], [/\bPetrovs\b/g, "Petrov's"], [/\bAlekhines\b/g, "Alekhine's"], [/\bBishops\b/g, "Bishop's"], [/\bCaro Kann\b/g, "Caro-Kann"], [/\bNimzo Indian\b/g, "Nimzo-Indian"], [/\bBogo Indian\b/g, "Bogo-Indian"], [/\bGrunfeld\b/g, "Grünfeld"], [/\bReti\b/g, "Réti"], [/\bPirc\b/g, "Pirc"], [/\bNimzowitsch Larsen\b/g, "Nimzowitsch-Larsen"], [/\bVan t Kruijs\b/g, "Van 't Kruijs"]];

export function tidyOpeningName(name: string) {
  let value = name.replace(/-/g, " ").replace(/\s+/g, " ").trim();
  for (const [pattern, replacement] of FIXES) value = value.replace(pattern, replacement);
  return value;
}

export function openingFromChesscomUrl(url: string | null | undefined) {
  if (!url) return null;
  const slug = url.split("/openings/")[1];
  if (!slug) return null;
  const name = tidyOpeningName(decodeURIComponent(slug).replace(/\.\.\./g, "…"));
  const words = name.split(" ");
  let family = words.slice(0, 2).join(" ");
  if (words[2] && FAMILY_WORDS.has(words[2]) && !["Declined", "Accepted"].includes(words[2])) family = words.slice(0, 3).join(" ");
  if (words.length === 1) family = words[0];
  return { name, family };
}

export function familyFromName(name: string) {
  const head = name.split(":")[0].split(",")[0].trim();
  const words = head.split(" ");
  if (words.length <= 2) return head;
  return words[2] && FAMILY_WORDS.has(words[2]) ? words.slice(0, 3).join(" ") : words.slice(0, 2).join(" ");
}
