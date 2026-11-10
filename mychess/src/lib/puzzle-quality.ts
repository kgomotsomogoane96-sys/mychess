import { Chess } from "chess.js";
import { materialFromFen } from "@/lib/features";
import { scoreToCp } from "@/lib/math";
import type { AnalyzedMove } from "@/lib/types";

export type Practicality = {
  practical: boolean;
  reason: string;
  evalForMover: number;
  materialGap: number;
  legalMoves: number;
  phaseTag: "Opening" | "Middlegame" | "Endgame";
  practicalTheme: string;
};

/**
 * A position is worth practising only if the side to move has real choices
 * and something to play for. We deliberately reject "dead lost" positions:
 * a lone king against a queen, a forced mate against us, or a huge material
 * deficit. There is no transferable lesson in stalling for luck.
 */
export function evaluatePracticality(move: AnalyzedMove, options: { strict?: boolean } = {}): Practicality {
  const strict = options.strict !== false;
  const sign = move.color === "w" ? 1 : -1;
  const fen = move.fenBefore;
  const material = materialFromFen(fen);
  const materialGap = (material.white - material.black) * sign;
  const bestLine = move.lines?.[0];
  const evalForMover = bestLine
    ? scoreToCp(bestLine.cp, bestLine.mate)
    : move.evalBefore * sign;
  const moverMate = (bestLine?.mate ?? move.mateBefore) != null
    ? (bestLine?.mate ?? move.mateBefore)! * sign
    : null;
  let legalMoves = 0;
  let inCheck = false;
  let moverMaterial = 0;
  let opponentMaterial = 0;
  try {
    const chess = new Chess(fen);
    legalMoves = chess.moves().length;
    inCheck = chess.isCheck();
    moverMaterial = move.color === "w" ? material.white : material.black;
    opponentMaterial = move.color === "w" ? material.black : material.white;
  } catch {
    return { practical: false, reason: "Illegal or unreadable position", evalForMover, materialGap, legalMoves: 0, phaseTag: "Middlegame", practicalTheme: "Broken position" };
  }

  const phaseTag = move.phase === "opening" ? "Opening" : move.phase === "endgame" ? "Endgame" : "Middlegame";
  const tactical = move.features.hung || move.features.missedCapture || move.features.missedMate || move.features.missedCheck;
  const practicalTheme = tactical ? "Tactics" : phaseTag === "Opening" ? "Opening principles" : phaseTag === "Endgame" ? "Endgame technique" : "Middlegame planning";

  const reject = (reason: string): Practicality => ({ practical: false, reason, evalForMover, materialGap, legalMoves, phaseTag, practicalTheme });

  // 1. No play left: game already over or practically no legal choices.
  if (legalMoves === 0) return reject("No legal moves — game is over");
  if (legalMoves < 5) return reject("Too few legal moves — a forced survival position");

  // 2. A forced mate against the mover, or a hopeless evaluation.
  if (moverMate != null && moverMate < 0) return reject("Forced mate against you — nothing to learn here");
  if (Math.abs(evalForMover) >= 90000) return reject("Forced mate position");
  if (evalForMover <= (strict ? -280 : -450)) return reject("Already a lost position — no practical decision");

  // 3. Big material deficit: e.g. king + pawn versus a queen, or one queen
  //    against rooks and a pawn avalanche.
  if (materialGap <= -5) return reject("Down too much material — the position has no play");
  if (materialGap <= -3 && evalForMover <= -150) return reject("Worse material and losing evaluation");

  // 4. The mover has no pieces to coordinate with (bare king or a pawn or two)
  //    while the opponent still has serious force.
  if (moverMaterial <= 2 && opponentMaterial >= 9) return reject("No material to play with against a dominant opponent");
  if (material.pawns + material.nonPawnCount < 4) return reject("Too little material on the board");

  // 5. In check with a single-digit move count and a lost evaluation is just
  //    king shuffling, not a teachable tactical position.
  if (inCheck && legalMoves <= 4 && evalForMover < 0) return reject("Forced king move in a lost position");

  // 6. Very early or very late positions still count, but only with real
  //    choices. Ply 1-2 with a symmetric start has little to decide.
  if (move.ply <= 2 && move.cpLoss < 60) return reject("Opening move with no instructive decision");

  return { practical: true, reason: "Playable position", evalForMover, materialGap, legalMoves, phaseTag, practicalTheme };
}
