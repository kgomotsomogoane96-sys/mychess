import { Chess, type Square } from "chess.js";

export function uciOf(move: { from: string; to: string; promotion?: string }) {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

export function playUci(chess: Chess, uci: string) {
  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  const promotion = uci.slice(4, 5) || undefined;
  return chess.move({ from, to, promotion: promotion as "q" | "r" | "b" | "n" | undefined });
}

export function pvToSan(fen: string, pv: string[], limit = 8) {
  const chess = new Chess(fen);
  const sans: string[] = [];
  for (const uci of pv.slice(0, limit)) {
    try {
      const move = playUci(chess, uci);
      if (!move) break;
      sans.push(move.san);
    } catch {
      break;
    }
  }
  return sans.join(" ");
}

export function sanOfUci(fen: string, uci: string) {
  return pvToSan(fen, [uci], 1) || uci;
}

export function materialValue(piece: string) {
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  return values[piece] ?? 0;
}

export function totalMaterial(fen: string) {
  const chess = new Chess(fen);
  let total = 0;
  for (const row of chess.board()) {
    for (const piece of row) {
      if (piece && piece.type !== "k") total += materialValue(piece.type);
    }
  }
  return total;
}

export function phaseOf(ply: number, fenAfter: string): "opening" | "middlegame" | "endgame" {
  const material = totalMaterial(fenAfter);
  if (material <= 20) return "endgame";
  if (ply <= 18) return "opening";
  return "middlegame";
}
