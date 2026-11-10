import { Chess } from "chess.js";
import { buildLesson } from "@/lib/learning";
import { playUci } from "@/lib/lines";
import { evaluatePracticality } from "@/lib/puzzle-quality";
import type { AnalyzedMove, ColorName, DrillKind, StudyFocus } from "@/lib/types";

export type DrillInput = { kind: DrillKind; found: boolean; ply: number; fen: string; solution: string; solutionSan: string; playedSan: string; prompt: string; theme: string; classification: string };

export const DRILL_KINDS: Record<DrillKind, { label: string; short: string; description: string }> = {
  find_win: { label: "Find the win", short: "Win", description: "You had a winning shot in a playable position. Find it this time." },
  punish: { label: "Punish the mistake", short: "Punish", description: "Your opponent just slipped. Find the move that makes them pay." },
  defend: { label: "Hold the position", short: "Defend", description: "You were under pressure but still had play. Find the move that keeps you in the game." },
  endgame: { label: "Endgame technique", short: "Endgame", description: "Fewer pieces, bigger decisions. Find the precise move." },
  opening: { label: "Opening habits", short: "Opening", description: "An early decision that shaped the game. Choose the principled move." },
  improve: { label: "Better plans", short: "Plan", description: "A quiet middlegame moment where a stronger idea was available." },
};

/** Only positions with real play become practice. Dead-lost positions are skipped. */
export function makeDrills(moves: AnalyzedMove[], color: ColorName | null, focus: StudyFocus): DrillInput[] {
  const side = color === "white" ? "w" : color === "black" ? "b" : null;
  const candidates: (DrillInput & { score: number })[] = [];
  moves.forEach((move, index) => {
    if (side && move.color !== side) return;
    if (move.forced) return;

    // Core quality gate: reject hopeless, material-drained, no-choice positions.
    const quality = evaluatePracticality(move);
    if (!quality.practical) return;

    const previous = moves[index - 1];
    const opponentSlipped = previous && previous.color !== move.color && ["blunder", "mistake"].includes(previous.classification);
    const lost = move.cpLoss;
    const legal = (() => { try { playUci(new Chess(move.fenBefore), move.bestUci); return true; } catch { return false; } })();
    if (!legal || move.bestUci === move.uci && !opponentSlipped) return;

    let kind: DrillKind = "improve"; let found = false; let score = lost;
    if (opponentSlipped && move.bestUci === move.uci) { kind = "punish"; found = true; score = 40 + Math.min(previous.cpLoss, 400) / 10; }
    else if (opponentSlipped && lost >= 35) { kind = "punish"; score = lost + 80; }
    else if (move.classification === "miss" || (move.features.missedMate && lost >= 35)) { kind = "find_win"; score = lost + 70; }
    else if (quality.evalForMover < 120 && ["mistake", "blunder"].includes(move.classification)) { kind = "defend"; score = lost + 40; }
    else if (move.phase === "endgame" && lost >= 35) { kind = "endgame"; score = lost + 30; }
    else if (move.phase === "opening" && lost >= 35) { kind = "opening"; score = lost + 20; }
    else if (lost < 35) return;

    // Prefer playable phases and practical themes, not just big blunders.
    if (quality.practicalTheme === "Tactics") score += 45;
    if (quality.phaseTag === "Opening") score += 25;
    if (quality.phaseTag === "Endgame" && quality.materialGap >= -2) score += 25;
    if (quality.legalMoves >= 18) score += 20;
    if (focus === "tactics" && ["find_win", "punish", "defend"].includes(kind)) score += 100;
    if (focus === "openings" && kind === "opening") score += 100;
    if (focus === "endgames" && kind === "endgame") score += 100;

    const lesson = buildLesson(move, color);
    const theme = move.features.hung ? "Piece safety" : move.features.missedMate ? "Finish the attack" : kind === "punish" ? "Spot the slip" : kind === "defend" ? "Defensive resources" : move.phase === "opening" ? "Opening principles" : move.phase === "endgame" ? "Endgame technique" : quality.practicalTheme === "Tactics" ? "Middlegame tactics" : "Middlegame planning";
    candidates.push({ kind, found, score, ply: move.ply, fen: move.fenBefore, solution: move.bestUci, solutionSan: move.bestSan, playedSan: move.san, prompt: `${lesson.question} ${lesson.habit}`, theme, classification: move.classification });
  });
  const picked = candidates.sort((a, b) => b.score - a.score);
  const foundOnes = picked.filter(item => item.found).slice(0, 2);
  const missed = picked.filter(item => !item.found).slice(0, 10);
  return [...missed, ...foundOnes].map(({ score: _score, ...drill }) => drill);
}
