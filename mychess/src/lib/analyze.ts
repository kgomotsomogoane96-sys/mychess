import { Chess } from "chess.js";
import { classifyMove, countClasses } from "@/lib/classify";
import { buildLesson } from "@/lib/learning";
import { pvToSan } from "@/lib/lines";
import { estimateRating, mean, round1, studyAccuracy, toWhitePerspective, winPercentFromCp } from "@/lib/math";
import { parseGame } from "@/lib/pgn";
import type { AnalyzedMove, ClassName, GameSummary, PositionTail, Profile } from "@/lib/types";
import { newGame, withEngine, type EngineLine } from "@/lib/uci";
import { BAD_CLASSES } from "@/lib/labels";

export type AnalysisProgress = {
  type: "start" | "ply" | "done";
  index?: number;
  total: number;
  san?: string;
  eval?: number;
};

const PHASES = ["opening", "middlegame", "endgame"] as const;

function phaseAccuracy(moves: AnalyzedMove[], phase: (typeof PHASES)[number], color: "w" | "b") {
  const values = moves.filter((move) => move.phase === phase && move.color === color).map((move) => move.accuracy);
  return values.length ? round1(studyAccuracy(values)) : null;
}

function yourMoves(moves: AnalyzedMove[], youColor: "white" | "black" | null) {
  if (!youColor) return moves;
  return moves.filter((move) => (youColor === "white" ? move.color === "w" : move.color === "b"));
}

export async function analyzePgn(options: {
  pgn: string;
  depth: number;
  profile: Profile;
  youColor: "white" | "black" | null;
  opponent: string;
  onProgress?: (event: AnalysisProgress) => void;
  signal?: AbortSignal;
}) {
  const parsed = parseGame(options.pgn, { legal: true });
  const depth = Math.max(6, Math.min(16, options.depth));
  const searches: EngineLine[][] = [];
  const fens = [parsed.initialFen, ...parsed.moves.map((move) => move.fenAfter)];
  const total = fens.length;

  await withEngine(`review ${parsed.whiteName}`, async (session) => {
    await newGame(session);
    for (let index = 0; index < fens.length; index += 1) {
      if (options.signal?.aborted) {
        session.stop();
        throw new Error("Analysis stopped");
      }
      const chess = new Chess(fens[index]);
      if (chess.isGameOver()) {
        searches.push([]);
      } else {
        searches.push(await session.analyze(fens[index], depth));
      }
      options.onProgress?.({
        type: index === 0 ? "start" : "ply",
        index,
        total,
        san: parsed.moves[index - 1]?.san,
        eval: searches[index][0] ? toWhitePerspective(searches[index][0].cp, searches[index][0].mate, chess.turn()).cp : 0,
      });
    }
  });

  const moves: AnalyzedMove[] = parsed.moves.map((move, index) => {
    const after = searches[index + 1]?.[0];
    const afterTurn = move.color === "w" ? "b" : "w";
    const terminal = new Chess(move.fenAfter);
    const terminalWhite = terminal.isCheckmate()
      ? { cp: move.color === "w" ? 100000 : -100000, mate: move.color === "w" ? 1 : -1 }
      : { cp: 0, mate: null as number | null };
    const afterWhite = after ? toWhitePerspective(after.cp, after.mate, afterTurn) : terminalWhite;
    const classified = classifyMove({
      move,
      before: searches[index] ?? [],
      afterCpWhite: afterWhite.cp,
      afterMateWhite: afterWhite.mate,
      book: move.ply <= parsed.bookPlies,
    });
    return classified;
  });

  const finalFen = fens[fens.length - 1];
  const finalSearch = searches[searches.length - 1] ?? [];
  const finalChess = new Chess(finalFen);
  const finalTurn = finalChess.turn();
  const finalWhite = finalSearch[0]
    ? toWhitePerspective(finalSearch[0].cp, finalSearch[0].mate, finalTurn)
    : finalChess.isCheckmate()
      ? { cp: finalTurn === "w" ? -100000 : 100000, mate: finalTurn === "w" ? -1 : 1 }
      : { cp: 0, mate: null as number | null };
  const tail: PositionTail = {
    fen: finalFen,
    evalWhite: Math.round(finalWhite.cp),
    mate: finalWhite.mate,
    lines: finalSearch.slice(0, 2).map((line) => ({
      uci: line.pv[0] ?? "",
      san: line.pv[0] ? pvToSan(finalFen, [line.pv[0]], 1) : "",
      cp: line.cp,
      mate: line.mate,
      pvSan: pvToSan(finalFen, line.pv, 8),
    })),
  };

  const whiteMoves = moves.filter((move) => move.color === "w");
  const blackMoves = moves.filter((move) => move.color === "b");
  const accuracyWhite = whiteMoves.length ? studyAccuracy(whiteMoves.map((move) => move.accuracy)) : 0;
  const accuracyBlack = blackMoves.length ? studyAccuracy(blackMoves.map((move) => move.accuracy)) : 0;
  const acplWhite = whiteMoves.length ? Math.round(mean(whiteMoves.map((move) => move.cpLoss))) : 0;
  const acplBlack = blackMoves.length ? Math.round(mean(blackMoves.map((move) => move.cpLoss))) : 0;
  const counts = countClasses(moves);
  const yours = yourMoves(moves, options.youColor);
  const important = [...yours].filter(move => BAD_CLASSES.has(move.classification)).sort((a, b) => b.cpLoss - a.cpLoss);
  const lessons = [...new Set(important.map(move => buildLesson(move, options.youColor).habit))].slice(0, 3);
  if (!lessons.length) lessons.push("Keep a simple checks–captures–threats routine. Compare two candidate moves before choosing, and notice what each move leaves behind.");
  const phaseLeak = PHASES.map((phase) => {
    const values = yours.filter((move) => move.phase === phase);
    return { phase, accuracy: values.length ? studyAccuracy(values.map((move) => move.accuracy)) : null };
  })
    .filter((item) => item.accuracy != null)
    .sort((a, b) => (a.accuracy ?? 100) - (b.accuracy ?? 100))[0];

  const momentScore = (move: AnalyzedMove) =>
    move.cpLoss +
    (move.classification === "brilliant" || move.classification === "great" ? 140 : 0) +
    (move.classification === "miss" ? 50 : 0);
  const keyMoments = [...moves]
    .filter((move) => ["brilliant", "great", "miss", "mistake", "blunder"].includes(move.classification))
    .sort((a, b) => momentScore(b) - momentScore(a))
    .slice(0, 8)
    .sort((a, b) => a.ply - b.ply)
    .map((move) => ({
      ply: move.ply,
      classification: move.classification as ClassName,
      san: move.san,
      color: move.color,
      comment: buildLesson(move, options.youColor).summary,
    }));

  const themeCounts = { w: {} as Record<string, number>, b: {} as Record<string, number> };
  for (const move of moves) {
    if (!BAD_CLASSES.has(move.classification)) continue;
    for (const theme of move.themes) themeCounts[move.color][theme] = (themeCounts[move.color][theme] ?? 0) + 1;
  }
  const summary: GameSummary = {
    model: "hearthline-winpercent-v1",
    counts,
    themeCounts,
    phaseAccuracy: {
      opening: { w: phaseAccuracy(moves, "opening", "w"), b: phaseAccuracy(moves, "opening", "b") },
      middlegame: { w: phaseAccuracy(moves, "middlegame", "w"), b: phaseAccuracy(moves, "middlegame", "b") },
      endgame: { w: phaseAccuracy(moves, "endgame", "w"), b: phaseAccuracy(moves, "endgame", "b") },
    },
    lessons,
    headline: options.youColor ? `Your ${options.youColor} game, decoded. ${important.length} moment${important.length === 1 ? "" : "s"} worth a closer look.` : "A game worth understanding. Explore the moments that changed the position.",
    keyMoments,
    yourLeak: phaseLeak?.accuracy != null ? phaseLeak.phase : null,
  };

  return {
    parsed,
    moves,
    tail,
    summary,
    depth,
    accuracyWhite,
    accuracyBlack,
    acplWhite,
    acplBlack,
    estimatedWhite: estimateRating(accuracyWhite, acplWhite),
    estimatedBlack: estimateRating(accuracyBlack, acplBlack),
    whiteWin: winPercentFromCp(tail.evalWhite),
  };
}
