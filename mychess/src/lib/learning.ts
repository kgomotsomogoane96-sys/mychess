import { Chess, type Move, type Square } from "chess.js";
import type { AnalyzedMove, ColorName } from "@/lib/types";
import { playUci } from "@/lib/lines";

export const PIECE_NAMES: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

export type MoveLesson = {
  title: string;
  summary: string;
  what: string;
  why: string;
  idea: string;
  habit: string;
  question: string;
  tags: string[];
  observation: string | null;
};

export function describeMove(fen: string, uci: string): { text: string; move: Move | null } {
  try {
    const chess = new Chess(fen);
    const move = playUci(chess, uci);
    const piece = PIECE_NAMES[move.piece];
    if (move.san.startsWith("O-O")) return { text: `Castling moves your king two squares toward the rook, then brings that rook beside it. Two pieces move, but it counts as one turn.`, move };
    let text = `The ${piece} moves from ${move.from} to ${move.to}.`;
    if (move.captured) text += ` It captures the ${PIECE_NAMES[move.captured]} on ${move.to}.`;
    if (move.promotion) text += ` The pawn becomes a ${PIECE_NAMES[move.promotion]}.`;
    if (chess.isCheckmate()) text += " That's checkmate: the king is attacked and has no legal escape.";
    else if (chess.isCheck()) text += " It also puts the king in check, so the king must be made safe immediately.";
    return { text, move };
  } catch { return { text: "This is the move played in the game.", move: null }; }
}

function purpose(move: Move, after: Chess, phase: string) {
  if (move.san.startsWith("O-O")) return "The idea is to get your king out of the center and bring a rook closer to the action.";
  if (after.isCheckmate()) return "This finishes the game. The king cannot escape, block the check, or capture the checking piece.";
  if (move.captured) return `Winning material matters, but always look at the recapture. Here, the engine's line supports taking the ${PIECE_NAMES[move.captured]}.`;
  if (after.isCheck()) return "A check forces a response. The engine likes the position after that forced reply.";
  if (["d4", "e4", "d5", "e5"].includes(move.to) && move.piece === "p") return "This pawn claims space in the center. Central space gives your pieces more useful squares.";
  if (phase === "opening" && ["n", "b"].includes(move.piece) && ["1", "8"].includes(move.from[1])) return "This develops a piece: it leaves the back rank and gets ready to take part in the game. In the opening, bring pieces out before launching an attack.";
  if (move.piece === "r") {
    const file = move.to[0];
    const pawns = after.board().flat().filter(p => p?.type === "p" && p.square[0] === file);
    if (!pawns.length) return "The rook reaches an open file—a file with no pawns blocking it. Rooks use those lanes to become active.";
  }
  if (move.piece === "k" && phase === "endgame" && ["d", "e", "c", "f"].includes(move.to[0])) return "With fewer pieces left, the king can become a useful attacker. This move brings it toward the action.";
  return "It improves the position in Stockfish's calculation. Follow the next few moves to see the idea, rather than memorizing the notation.";
}

function exchangeScore(fen: string, square: Square, depth: number): number {
  if (depth <= 0) return 0;
  const chess = new Chess(fen);
  const target = chess.get(square);
  if (!target) return 0;
  const captures = chess.moves({ verbose: true }).filter(m => m.to === square && m.captured).sort((a, b) => VALUES[a.piece] - VALUES[b.piece]);
  let best = 0;
  for (const capture of captures.slice(0, 4)) {
    const next = new Chess(fen);
    next.move({ from: capture.from, to: capture.to, promotion: capture.promotion });
    const gain = VALUES[capture.captured!] + (capture.promotion ? VALUES[capture.promotion] - 1 : 0) - exchangeScore(next.fen(), square, depth - 1);
    best = Math.max(best, gain);
  }
  return best;
}

function loosePieceObservation(move: AnalyzedMove) {
  if (move.cpLoss < 80 || !["mistake", "blunder", "inaccuracy"].includes(move.classification)) return null;
  try {
    const chess = new Chess(move.fenAfter);
    if (chess.isGameOver()) return null;
    const candidates = chess.board().flat().filter(p => p && p.color === move.color && p.type !== "k" && VALUES[p.type] >= 3);
    let best: { gain: number; san: string; square: string; piece: string } | null = null;
    for (const piece of candidates) {
      const gain = exchangeScore(chess.fen(), piece!.square, 5);
      if (gain >= 2 && (!best || gain > best.gain)) {
        const capture = chess.moves({ verbose: true }).filter(m => m.to === piece!.square && m.captured).sort((a, b) => VALUES[a.piece] - VALUES[b.piece])[0];
        if (capture) best = { gain, san: capture.san, square: piece!.square, piece: PIECE_NAMES[piece!.type] };
      }
    }
    return best ? `Board check: look at your ${best.piece} on ${best.square}. ${best.san} is a possible capture, and a simple exchange appears favorable for the other side. A check or counterattack could change that—verify it on the board.` : null;
  } catch { return null; }
}

function evaluationSentence(move: AnalyzedMove) {
  const sign = move.color === "w" ? 1 : -1;
  const before = move.evalBefore * sign;
  const after = move.evalAfter * sign;
  const mateAfter = move.mateAfter == null ? null : move.mateAfter * sign;
  if (mateAfter != null) return mateAfter > 0 ? `Stockfish now sees a forced mate in your favor in ${Math.abs(mateAfter)} move${Math.abs(mateAfter) === 1 ? "" : "s"}, if the strongest replies are played.` : `Stockfish now sees a forced mate for the other side in ${Math.abs(mateAfter)} move${Math.abs(mateAfter) === 1 ? "" : "s"}. This is the turning point to understand.`;
  const label = (cp: number) => Math.abs(cp) < 60 ? "roughly balanced" : `${Math.abs(cp) < 180 ? "a small edge" : Math.abs(cp) < 350 ? "a useful advantage" : "a winning position"} for ${cp > 0 ? "you" : "the other side"}`;
  if (move.cpLoss < 45) return `The engine's picture stays ${label(after)}. You haven't given away a meaningful advantage here.`;
  return `Before the move, the position was ${label(before)}. After it, the engine sees ${label(after)}. That change—not the label alone—is why this move deserves a closer look.`;
}

export function buildLesson(move: AnalyzedMove, color?: ColorName | null): MoveLesson {
  const played = describeMove(move.fenBefore, move.uci);
  const best = describeMove(move.fenBefore, move.bestUci);
  const personal = !color || (color === "white" ? "w" : "b") === move.color;
  const sideName = move.color === "w" ? "White" : "Black";
  const owner = personal ? "you" : sideName;
  const bestChess = new Chess(move.fenBefore);
  let bestMove: Move | null = null;
  try { bestMove = playUci(bestChess, move.bestUci); } catch { /* stored line may be unavailable */ }
  const idea = bestMove ? `${move.bestSan}: ${purpose(bestMove, bestChess, move.phase)}` : "Follow the engine's first choice and compare the resulting position.";
  const question = `You're playing ${sideName}. Look at checks, captures, and threats for both sides. What move would you choose?`;
  const observation = loosePieceObservation(move);
  let title = "A useful move. Here's the idea.";
  let habit = "Before you move, ask: what is my opponent threatening, and what does my move leave behind?";
  let tags = ["Build the habit"];
  if (move.classification === "book") {
    title = "A familiar opening move.";
    habit = "Learn the purpose of an opening—center, development, king safety—not just the order of the moves.";
    tags = ["Opening principles"];
  } else if (move.classification === "brilliant") {
    title = "Giving up material, on purpose.";
    habit = "A sacrifice is a trade: material for time, open lines, or an attack. Play the follow-up before trying it in your own game.";
    tags = ["Sacrifice", "Follow-up matters"];
  } else if (move.classification === "great") {
    title = "The engine found a clear best answer.";
    tags = ["Important position"];
  } else if (move.classification === "miss" && move.features.missedMate) {
    title = "There was a finish on the board.";
    habit = "When the opponent's king is exposed, look at every check first. You don't have to play the first check you see—just make sure you look.";
    tags = ["Checks first"];
  } else if (move.classification === "miss") {
    title = "A chance worth noticing.";
    habit = "When your opponent leaves a piece loose or a king exposed, pause. Look for a forcing move before making a quiet one.";
    tags = ["Spot the chance"];
  } else if (["blunder", "mistake"].includes(move.classification)) {
    title = move.classification === "blunder" ? "This is the move worth learning from." : "There was a safer, stronger idea.";
    if (move.features.hung) habit = "Try the landing-square check: after your piece moves, can it be taken? What does that exchange cost?";
    else if (move.phase === "opening") habit = "In the opening, check three jobs: control the center, develop your pieces, and get your king safe.";
    else if (move.phase === "endgame") habit = "In an ending, count the pawns and ask whether your king can help. One lost pawn can decide the game.";
    tags = ["Learn, don't label", "One move at a time"];
  } else if (move.classification === "inaccuracy") {
    title = "Playable, but there was a little more.";
    habit = "Compare two candidate moves before choosing. Ask which one improves your least useful piece.";
    tags = ["Small improvement"];
  }
  const bestIsDifferent = move.bestUci !== move.uci;
  const summary = bestIsDifferent ? `${owner === "you" ? "You" : sideName} played ${move.san}. Stockfish prefers ${move.bestSan}. Let's understand the difference, not just memorize a new move.` : `${owner === "you" ? "You" : sideName} played ${move.san}, and the engine agrees with the choice. Here's what makes it useful.`;
  return { title, summary, what: played.text, why: evaluationSentence(move), idea, habit, question, tags, observation };
}

export function lineSteps(fen: string, pvSan: string, limit = 5) {
  const chess = new Chess(fen);
  const steps: { san: string; comment: string; fen: string }[] = [];
  for (const san of pvSan.split(/\s+/).filter(Boolean).slice(0, limit)) {
    try {
      const move = chess.move(san);
      let comment = `${PIECE_NAMES[move.piece]} ${move.from} → ${move.to}`;
      if (move.captured) comment = `Captures the ${PIECE_NAMES[move.captured]}.`;
      if (chess.isCheckmate()) comment = "Checkmate. No legal escape.";
      else if (chess.isCheck()) comment = "Check: the king must respond.";
      if (move.san.startsWith("O-O")) comment = "Castle: king safety and a connected rook.";
      steps.push({ san: move.san, comment, fen: chess.fen() });
    } catch { break; }
  }
  return steps;
}

export function drillFeedback(fen: string, solution: string) {
  const described = describeMove(fen, solution);
  return described.move ? purpose(described.move, new Chess(new Chess(fen).move(described.move).after), "middlegame") : "Compare the piece's new square with where it started.";
}
