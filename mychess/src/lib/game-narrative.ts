import { Chess, type Square } from "chess.js";
import { CLASS_META } from "@/lib/labels";
import { formatEval, winPercentFromCp } from "@/lib/math";
import type { AnalyzedMove, ClassName, Phase, Profile } from "@/lib/types";

export type BookReply = { san: string; count: number };
export type BookMap = Record<string, BookReply[]>;

export type NarrativeReply = BookReply & { plan: string };
export type Narrative = {
  ply: number;
  moveNumber: string;
  san: string;
  color: "w" | "b";
  classification: ClassName;
  label: string;
  fen: string;
  what: string;
  engine: string;
  alternative: string | null;
  think: string[];
  replies: NarrativeReply[];
  verdict: string;
  evalBefore: number;
  evalAfter: number;
  cpLoss: number;
  phase: Phase;
};

const PIECE: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
const FILES = "abcdefgh";
const CENTER = ["d4", "e4", "d5", "e5"];

function allSquares() {
  const squares: Square[] = [];
  for (const file of FILES) for (let rank = 1; rank <= 8; rank += 1) squares.push(`${file}${rank}` as Square);
  return squares;
}
const SQUARES = allSquares();

function opponentHalf(color: "w" | "b") {
  return SQUARES.filter(square => (color === "w" ? Number(square[1]) >= 5 : Number(square[1]) <= 4));
}

function attackedBy(chess: Chess, square: Square, color: "w" | "b") {
  try { return chess.attackers(square, color).length > 0; } catch { return false; }
}

function describeWhat(move: AnalyzedMove) {
  const before = new Chess(move.fenBefore);
  const after = new Chess(move.fenAfter);
  const piece = PIECE[move.piece] ?? "piece";
  const from = move.uci.slice(0, 2);
  const to = move.uci.slice(2, 4);
  const captured = before.get(to as Square);
  const parts: string[] = [];

  if (move.san.startsWith("O-O")) {
    parts.push(`${move.san} moves the king two squares toward the rook and brings that rook beside it — it counts as one move, and it solves king safety while connecting the rooks.`);
  } else {
    parts.push(`The ${piece} moves from ${from} to ${to}${captured ? `, capturing the ${PIECE[captured.type] ?? "piece"}` : ""}${move.uci.length > 4 ? ` and promoting to a ${PIECE[move.uci[4]] ?? "queen"}` : ""}.`);
  }

  if (move.piece === "p" && "de".includes(from[0]) && ["2", "7"].includes(from[1]) && Math.abs(Number(to[1]) - Number(from[1])) === 2) {
    parts.push("It opens lines for the queen and bishops while fighting for two central squares — that is why pawn moves like this are so useful early.");
  }
  if (["n", "b"].includes(move.piece) && ["1", "8"].includes(from[1])) {
    parts.push("It develops a piece off the back rank, giving it real squares instead of a parking spot.");
  }
  if (move.piece === "r") {
    const ownPawns = SQUARES.some(square => square[0] === to[0] && after.get(square)?.type === "p" && after.get(square)?.color === move.color);
    if (!ownPawns) parts.push("The rook now uses an open file — a long-term asset.");
  }
  if (move.san.includes("+") || after.isCheck()) {
    parts.push("It gives check, so the opponent must answer the king first. Forcing moves like this narrow their choices.");
  }
  if (after.isCheckmate()) parts.push("That is checkmate: the king is attacked and has no legal escape.");

  // Count the squares the mover now controls in the opponent's half.
  const half = opponentHalf(move.color);
  const controlled = half.filter(square => attackedBy(after, square, move.color));
  const central = CENTER.filter(square => attackedBy(after, square as Square, move.color));
  if (controlled.length >= 4) {
    parts.push(`After the move, your pieces reach ${controlled.length} squares in the opponent's half${central.length ? `, including ${central.join(", ")}` : ""}.`);
  }
  return parts.join(" ");
}

function engineSentence(move: AnalyzedMove) {
  const sign = move.color === "w" ? 1 : -1;
  const before = move.evalBefore * sign;
  const after = move.evalAfter * sign;
  const best = move.lines?.[0];
  const line = best?.pvSan || move.lines?.[0]?.pvSan || "";
  const winBefore = winPercentFromCp(before);
  const winAfter = winPercentFromCp(after);
  const verdict = move.classification === "book"
    ? "You are still inside known opening theory — the engine has no strong preference yet."
    : `Stockfish evaluated the position for the mover at ${formatEval(before, move.mateBefore)} before the move and ${formatEval(after, move.mateAfter)} after it (about ${Math.round(winBefore)}% → ${Math.round(winAfter)}% winning chances).`;
  return `${verdict}${best ? ` Its first choice was ${best.san || move.bestSan}${line ? `, with the line ${line}` : ""}.` : ""}${move.cpLoss > 0 ? ` This move gave away roughly ${move.cpLoss} centipawns.` : ""}`;
}

function alternativeSentence(move: AnalyzedMove) {
  if (move.classification === "book") return "Here the useful question is not the engine's top move, but which plan you want out of the opening.";
  if (move.bestUci === move.uci) return "You found the engine's first choice. Notice the job this move does and repeat that shape.";
  const line = move.lines?.[0]?.pvSan || "";
  return `A cleaner idea was ${move.bestSan}${line ? `, continuing ${line}` : ""}. Compare the piece's new square with where it started — that difference is the lesson.`;
}

function thinkList(move: AnalyzedMove, phase: Phase) {
  const base = ["Look at checks, captures and threats for both sides.", "Ask what your opponent wants next, not just what you want.", "Before committing, check what your move leaves undefended."];
  if (phase === "opening") return ["Which central squares does this move fight for?", "Have you developed a new piece and kept the king safe?", "If they break with a pawn, which piece is ready to answer?"];
  if (phase === "endgame") return ["Can your king become active?", "Count the pawns — is there a passed pawn to push?", "Trade pieces only when the resulting pawn ending is good for you."];
  if (move.features?.hung || move.classification === "blunder") return ["Name the cheapest attacker on the square your piece just landed on.", "What does their most forcing reply win?", "Is there a quiet defensive move that keeps material level?"];
  if (move.features?.missedMate || move.classification === "miss") return ["List every check before choosing a quiet move.", "Where is their king's escape square?", "Does a forcing move win material or mate immediately?"];
  if (move.classification === "best" || move.classification === "great") return ["Which of your pieces became more useful?", "What is the opponent's only good reply?", "What would you do if they ignore your idea?"];
  return base;
}

const REPLY_PLANS: Record<string, string> = {
  e5: "They occupy the centre. Bring a knight to f3, develop the bishop, and prepare d4 — don't let them keep e5 for free.",
  c5: "The Sicilian: asymmetry from move one. If you are White, develop knights and consider d4; if you are Black, use the open c-file.",
  e6: "They are building a French/Caro wedge. Prepare d4, keep the bishop active, and watch for the ...c5 or ...d5 break.",
  c6: "Solid. Claim space with d4 and c4, and have a plan for ...d5 before it arrives.",
  d5: "They claim the centre. Consider cxd5 or e4, then develop with tempo against the advanced pawn.",
  Nf6: "They hit e4 and control the centre with a piece. Defend e4 with Nc3 or push e5, then finish kingside development.",
  Nc6: "They defend e5. Develop the bishop, castle, and only then choose a pawn break.",
  d6: "Flexible. Ask whether they want e5 or a fianchetto, and keep a knight ready for d5.",
  g6: "A fianchetto is coming. Watch the long diagonal and decide whether to challenge it with c4 or e4.",
  Bb4: "A pin. Ask whether taking on c3 helps you or doubles your pawns before reacting.",
  Bc5: "The bishop eyes f2/f7. Castle early and consider c3–d4 to strike the centre.",
  "O-O": "Their king is safe now. Stop hoping for a quick attack — build a plan with pawn breaks and piece placement.",
};

function planForReply(san: string) {
  const clean = san.replace(/[+#!?]/g, "");
  if (REPLY_PLANS[clean]) return REPLY_PLANS[clean];
  if (clean.startsWith("N")) return `After ${san}, ask which central square that knight fights for; answer with a developing move that contests it.`;
  if (clean.startsWith("B")) return `After ${san}, notice the bishop's new diagonal and keep your king off it.`;
  if (clean.length <= 2 || clean[0] === clean[0]?.toLowerCase()) return `After ${san}, pause: which pawn break did they allow, and which of your pieces is still undeveloped?`;
  return `After ${san}, re-run the routine: checks, captures, threats, then king safety.`;
}

function verdictFor(move: AnalyzedMove, profile: Profile) {
  const meta = CLASS_META[move.classification] ?? CLASS_META.good;
  const name = profile.displayName && profile.displayName !== "You" ? profile.displayName : "You";
  const who = move.color === "w" ? "White" : "Black";
  if (["mistake", "blunder", "inaccuracy", "miss"].includes(move.classification)) {
    return `${who} played ${move.san}: ${meta.label.toLowerCase()}. ${meta.blurb} The transferable lesson is in the alternative — study that idea, not the notation.`;
  }
  if (move.classification === "brilliant") return `${who} found ${move.san} — a sound sacrifice. ${meta.blurb} ${name}, remember the follow-up: material was traded for time and open lines.`;
  if (move.classification === "book") return `${move.san} is known theory. The coach's job here is to explain the plan behind the move, so you are not lost when they deviate.`;
  return `${who} played ${move.san}: ${meta.label.toLowerCase()}. ${meta.blurb}`;
}

/** Turn a stored engine analysis into a move-by-move lesson. Pure: safe in the browser. */
export function buildNarrative(moves: AnalyzedMove[], book: BookMap, profile: Profile): Narrative[] {
  const sans = moves.map(move => move.san);
  return moves.map((move, index) => {
    const classification = (move.classification ?? "good") as ClassName;
    const prefix = sans.slice(0, index).join(" ");
    const replies = (book[prefix] ?? [])
      .filter(reply => reply.san !== move.san)
      .slice(0, 3)
      .map(reply => ({ ...reply, plan: planForReply(reply.san) }));
    const moveNumber = `${Math.ceil(move.ply / 2)}${move.ply % 2 ? "." : "…"}`;
    const sign = move.color === "w" ? 1 : -1;
    return {
      ply: move.ply,
      moveNumber,
      san: move.san,
      color: move.color,
      classification,
      label: (CLASS_META[classification] ?? CLASS_META.good).label,
      fen: move.fenBefore,
      what: describeWhat(move),
      engine: engineSentence(move),
      alternative: alternativeSentence(move),
      think: thinkList(move, move.phase ?? "middlegame"),
      replies,
      verdict: verdictFor({ ...move, classification } as AnalyzedMove, profile),
      evalBefore: move.evalBefore * sign,
      evalAfter: move.evalAfter * sign,
      cpLoss: move.cpLoss ?? 0,
      phase: move.phase ?? "middlegame",
    };
  });
}
