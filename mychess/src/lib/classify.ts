import { Chess } from "chess.js";
import { CLASS_NAMES, type AnalyzedMove, type ClassName, type MoveFeatures, type Phase } from "@/lib/types";
import { accuracyFromWinLoss, round1, scoreToCp, studyAccuracy, toWhitePerspective, winPercentFromCp } from "@/lib/math";
import { materialValue, phaseOf, pvToSan, sanOfUci } from "@/lib/lines";
import type { EngineLine } from "@/lib/uci";

export type ReplayMove = {
  ply: number;
  san: string;
  uci: string;
  color: "w" | "b";
  piece: string;
  captured?: string;
  from: string;
  to: string;
  fenBefore: string;
  fenAfter: string;
  legalCount: number;
};

function cheapestAttacker(chess: Chess, square: string, color: "w" | "b") {
  const squares = chess.attackers(square as never, color);
  let cheapest = Infinity;
  for (const from of squares) {
    const piece = chess.get(from);
    if (!piece) continue;
    cheapest = Math.min(cheapest, materialValue(piece.type));
  }
  return cheapest;
}

export function sacrificeLoss(fenAfter: string, to: string, mover: "w" | "b", piece: string, captured?: string) {
  const chess = new Chess(fenAfter);
  if (chess.isCheckmate() || chess.isGameOver()) return 0;
  const opp = mover === "w" ? "b" : "w";
  const attackers = chess.attackers(to as never, opp);
  if (!attackers.length) return 0;
  const defenders = chess.attackers(to as never, mover);
  const pieceValue = materialValue(piece);
  const capturedValue = captured ? materialValue(captured) : 0;
  const cheapest = cheapestAttacker(chess, to, opp);
  if (!Number.isFinite(cheapest)) return 0;
  if (!defenders.length) return Math.max(0, pieceValue - capturedValue);
  if (cheapest < pieceValue && capturedValue < pieceValue) return pieceValue - cheapest;
  return 0;
}

function emptyCounts() {
  return Object.fromEntries(CLASS_NAMES.map((name) => [name, { w: 0, b: 0 }])) as Record<
    ClassName,
    { w: number; b: number }
  >;
}

export function classifyMove(input: {
  move: ReplayMove;
  before: EngineLine[];
  afterCpWhite: number;
  afterMateWhite: number | null;
  book: boolean;
}): Omit<AnalyzedMove, "themes"> & { themes: string[] } {
  const turn = input.move.color;
  const best = input.before[0];
  const second = input.before[1];
  const bestWhite = best
    ? toWhitePerspective(best.cp, best.mate, turn)
    : { cp: 0, mate: null as number | null };
  const playedWhite = { cp: input.afterCpWhite, mate: input.afterMateWhite };
  const bestMoverCp = scoreToCp(best?.cp ?? 0, best?.mate ?? null);
  const playedMoverCp = turn === "w" ? playedWhite.cp : -playedWhite.cp;
  const rawLoss = Math.max(0, bestMoverCp - playedMoverCp);
  const bestUci = best?.pv[0] ?? input.move.uci;
  const isBest = bestUci === input.move.uci;
  const cpLoss = isBest ? 0 : Math.min(1000, Math.round(rawLoss));
  const winBefore = winPercentFromCp(bestMoverCp);
  const winAfter = winPercentFromCp(isBest ? bestMoverCp : playedMoverCp);
  const winLoss = isBest ? 0 : Math.max(0, winBefore - winAfter);
  const forced = input.move.legalCount <= 1;
  const sac = sacrificeLoss(input.move.fenAfter, input.move.to, turn, input.move.piece, input.move.captured);
  const sacrifice = sac >= 2;
  const secondCp = second ? scoreToCp(second.cp, second.mate) : bestMoverCp - 400;
  const onlyGood = !second || bestMoverCp - secondCp >= 180;
  const notLosing = winAfter >= 42 || (playedWhite.mate != null && (turn === "w" ? playedWhite.mate > 0 : playedWhite.mate < 0));
  const missedMate = Boolean(best?.mate && best.mate > 0 && !isBest);
  const bestSan = best ? sanOfUci(input.move.fenBefore, best.pv[0]) : input.move.san;
  const bestIsCapture = bestSan.includes("x");
  const bestIsCheck = bestSan.includes("+") || bestSan.includes("#");
  const bestIsCastle = bestSan === "O-O" || bestSan === "O-O-O";
  const hung = sac >= 3 && !isBest;

  let classification: ClassName = "good";
  if (forced) classification = input.book ? "book" : "best";
  else if (input.book && cpLoss < 150) classification = "book";
  else if (isBest && sacrifice && notLosing && input.move.piece !== "k") classification = "brilliant";
  else if (isBest && onlyGood && !input.book) classification = "great";
  else if (isBest) classification = "best";
  else if (hung && (winLoss >= 18 || cpLoss >= 250)) classification = "blunder";
  else if (missedMate && winLoss < 28) classification = "miss";
  else if (winLoss >= 25 || cpLoss >= 300) classification = "blunder";
  else if (winBefore >= 72 && winAfter <= 60 && winLoss >= 10) classification = "miss";
  else if (winLoss >= 16 || cpLoss >= 140) classification = "mistake";
  else if (winLoss >= 8 || cpLoss >= 55) classification = "inaccuracy";
  else if (winLoss >= 4 || cpLoss >= 22) classification = "good";
  else classification = "excellent";

  const accuracy = isBest || classification === "book" || forced ? 100 : round1(accuracyFromWinLoss(winLoss));
  const features: MoveFeatures = {
    hung,
    missedCapture: !isBest && bestIsCapture && !input.move.san.includes("x"),
    missedMate,
    missedCheck: !isBest && bestIsCheck && !input.move.san.includes("+") && !input.move.san.includes("#"),
    missedCastle: !isBest && bestIsCastle,
  };
  const themes: string[] = [];
  if (features.hung) themes.push("hanging piece");
  if (features.missedMate) themes.push("missed mate");
  if (features.missedCapture) themes.push("missed capture");
  if (features.missedCheck) themes.push("missed check");
  if (features.missedCastle) themes.push("missed castle");
  if (input.move.ply <= 16) themes.push("opening");
  if (phaseOf(input.move.ply, input.move.fenAfter) === "endgame") themes.push("endgame");
  if (sacrifice && isBest) themes.push("sacrifice");

  const lines = input.before.slice(0, 2).map((line) => ({
    uci: line.pv[0] ?? "",
    san: sanOfUci(input.move.fenBefore, line.pv[0] ?? ""),
    cp: line.cp,
    mate: line.mate,
    pvSan: pvToSan(input.move.fenBefore, line.pv, 8),
  }));

  return {
    ply: input.move.ply,
    san: input.move.san,
    uci: input.move.uci,
    color: input.move.color,
    piece: input.move.piece,
    fenBefore: input.move.fenBefore,
    fenAfter: input.move.fenAfter,
    evalBefore: Math.round(bestWhite.cp),
    evalAfter: Math.round(playedWhite.cp),
    mateBefore: bestWhite.mate,
    mateAfter: playedWhite.mate,
    bestUci,
    bestSan,
    lines,
    cpLoss,
    winBefore: round1(winBefore),
    winAfter: round1(winAfter),
    accuracy,
    classification,
    sacrifice,
    forced,
    phase: phaseOf(input.move.ply, input.move.fenAfter) as Phase,
    features,
    themes,
  };
}

export function averageByColor(moves: AnalyzedMove[], pick: (move: AnalyzedMove) => number) {
  const white = moves.filter((move) => move.color === "w");
  const black = moves.filter((move) => move.color === "b");
  return {
    white: white.length ? studyAccuracy(white.map(pick)) : 0,
    black: black.length ? studyAccuracy(black.map(pick)) : 0,
    whiteAcpl: white.length
      ? Math.round(white.reduce((sum, move) => sum + move.cpLoss, 0) / white.length)
      : 0,
    blackAcpl: black.length
      ? Math.round(black.reduce((sum, move) => sum + move.cpLoss, 0) / black.length)
      : 0,
  };
}

export function countClasses(moves: AnalyzedMove[]) {
  const counts = emptyCounts();
  for (const move of moves) counts[move.classification][move.color] += 1;
  return counts;
}

export { emptyCounts };
