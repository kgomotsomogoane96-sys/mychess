import { Chess } from "chess.js";

export type TheoryModule = {
  id: string; title: string; category: "Evaluation" | "Planning" | "Pieces" | "Pawns" | "King safety" | "Endgames" | "Calculation" | "Attack" | "Openings" | "Defence";
  minutes: number; level: "Foundation" | "Club" | "Advanced";
  promise: string; concept: string[]; checklist: string[]; moves: string[]; fen: string;
  prompt: string; habit: string; quiz: { question: string; options: string[]; correct: number; why: string };
  tags: string[];
};

function position(moves: string[], setup?: string) {
  const chess = setup ? new Chess(setup) : new Chess();
  for (const san of moves) { try { chess.move(san); } catch { break; } }
  return chess.fen();
}

const RAW: Omit<TheoryModule, "fen">[] = [
  {
    id: "evaluation", title: "How to read a position", category: "Evaluation", minutes: 8, level: "Foundation",
    promise: "Stop guessing who's better. Learn the four questions Stockfish asks before it shows a number.",
    concept: [
      "An engine evaluation is not a magic score. It is the result of asking four ordinary questions: who has more material, whose king is safe, whose pieces have useful squares, and what do the pawns allow?",
      "When you can answer those in plain words, a number like +1.2 becomes a story: one side has the safer king and a better bishop, not a mysterious advantage.",
      "The point isn't to calculate like Stockfish. It's to know what to look at so your next move has a reason."
    ],
    checklist: ["Count material first — but don't stop there.", "Look at king cover and open lines toward each king.", "Find the least useful piece on each side.", "Notice pawn islands, passed pawns, and fixed pawns."],
    moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d3", "d6", "O-O", "O-O", "Re1", "h6", "h3", "Re8"],
    prompt: "White to move. Before choosing anything, say what each side wants — then find the move that improves White's least useful piece.",
    habit: "Before every move, name one thing that is good for you and one thing that is good for your opponent. That is evaluation in human language.",
    quiz: { question: "Material is equal. What should decide your plan next?", options: ["Play the first check you see", "King safety, piece activity, and pawn structure", "Trade as many pieces as possible"], correct: 1, why: "Checks are only useful if they lead somewhere. Positional features decide what a good plan looks like." },
    tags: ["Evaluation", "Piece activity", "Pawn structure"],
  },
  {
    id: "worst-piece", title: "Improve your worst piece", category: "Planning", minutes: 7, level: "Foundation",
    promise: "A plan is often just one question: which of my pieces is doing the least?",
    concept: [
      "Beginners look for a move that threatens something. Strong players look for a move that improves a piece that has no future.",
      "A knight on the rim, a bishop blocked by its own pawns, a rook behind a pawn wall — each is a small problem you can fix before a tactic appears.",
      "Stockfish's quiet moves often look pointless until you notice the piece it just gave a better square."
    ],
    checklist: ["Name your least active piece.", "Find the square where it would have the most influence.", "Check whether the route is safe.", "Only then look for threats."],
    moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6", "Be2", "e5", "Nb3", "Be7", "O-O", "O-O"],
    prompt: "White to move. White's pieces are developed but one of them has almost no prospects. Find the move that gives it a future.",
    habit: "In quiet positions, ask 'which of my pieces would I least like to defend with?' Improve that piece first.",
    quiz: { question: "No tactics are available. What is a reliable way to find a plan?", options: ["Improve your least active piece", "Push a random pawn", "Move the queen twice"], correct: 0, why: "Improving the worst piece raises the value of your whole position without giving the opponent a target." },
    tags: ["Planning", "Piece activity", "Quiet moves"],
  },
  {
    id: "outposts", title: "Knight outposts and good bishops", category: "Pieces", minutes: 8, level: "Club",
    promise: "Learn the piece configurations that engines quietly fight over: protected knight squares and unblocked bishops.",
    concept: [
      "A knight on a central square protected by a pawn, where no enemy pawn can chase it away, is called an outpost. It can become stronger than a bishop.",
      "A bishop is 'good' when its own pawns don't block its diagonals. Trading your bad bishop for the opponent's good one is a real plan, not a small detail.",
      "Stockfish evaluates these long-term shapes. You can learn to see them without reading engine numbers."
    ],
    checklist: ["Can an enemy pawn ever kick this knight?", "Is the knight protected by a pawn?", "Are your bishop's diagonals blocked by your own pawns?", "Which minor piece would you most like to exchange?"],
    moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6", "Be3", "e5", "Nb3", "Be6", "f3", "Be7", "Qd2", "O-O"],
    prompt: "White to move. Look for a square where a white knight cannot be chased away by a pawn. Which configuration should White build?",
    habit: "Before moving a knight, ask: 'what pawn protects this square, and what pawn could kick me away?'",
    quiz: { question: "What makes a knight outpost valuable?", options: ["It is on the back rank", "A pawn protects it and no enemy pawn can drive it away", "It is next to your king"], correct: 1, why: "Permanence is the key: a protected central knight becomes a long-term attacking piece." },
    tags: ["Knights", "Bishops", "Piece configuration"],
  },
  {
    id: "pawn-structure", title: "Pawns are the map", category: "Pawns", minutes: 8, level: "Club",
    promise: "Understand isolated pawns, majorities, and why pawn moves cannot be taken back.",
    concept: [
      "Pawns never move backwards. Every pawn move permanently changes which squares can be occupied and which files can be opened.",
      "An isolated pawn has no neighbour to defend it; it can be a weakness in an ending but also gives space and piece activity in the middlegame.",
      "A pawn majority is a plan: create a passed pawn on the side where you have more pawns."
    ],
    checklist: ["Count pawn islands for both sides.", "Find pawn majorities on each wing.", "Identify pawns that can never be defended by another pawn.", "Look for a break that changes the structure."],
    moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "cxd5", "exd5", "Bg5", "Be7", "e3", "O-O", "Bd3", "c6", "Qc2", "Nbd7"],
    prompt: "White to move in a Queen's Gambit Exchange structure. Describe the pawn map, then find White's most natural plan.",
    habit: "After any pawn move, ask: 'which square did I just give up forever, and which file could open?'",
    quiz: { question: "Which pawn feature most often creates a long-term plan?", options: ["A pawn majority or a protected passed pawn", "A pawn on its starting square", "Having more pawns on the same file"], correct: 0, why: "Majorities and passed pawns create playable endgame plans; doubled pawns on one file usually do the opposite." },
    tags: ["Pawn structure", "Planning", "Endgame transfer"],
  },
  {
    id: "king-safety", title: "Attack the king, not the pieces", category: "King safety", minutes: 7, level: "Foundation",
    promise: "Learn why an uncastled king changes the value of every other piece on the board.",
    concept: [
      "A king stuck in the centre is a tactical target. Open files toward it can be worth more than a pawn or even a piece.",
      "When the opponent's king is exposed, forcing moves matter: checks, captures, and threats that demand a reply.",
      "Stockfish often sacrifices material precisely because king safety outweighs the material count."
    ],
    checklist: ["Where is each king, and can it castle?", "Which file or diagonal points at the king?", "What is the most forcing move available?", "Can the king run away after your first check?"],
    moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "Ng5", "d5", "exd5", "Na5", "Bb5+", "c6", "dxc6", "bxc6", "Be2", "h6", "Nf3", "e4", "Ne5", "Bd6"],
    prompt: "White to move. Black's king is still in the centre. Find the most forcing idea rather than a quiet developing move.",
    habit: "When the enemy king hasn't castled, look at every check and every capture before making a quiet move.",
    quiz: { question: "Why might a sacrifice work when a king is exposed?", options: ["Because sacrifices always win material", "Because open lines and forced replies can be worth more than material", "Because engines prefer fewer pieces"], correct: 1, why: "King danger converts time and open lines into a concrete attack; material is only one part of the evaluation." },
    tags: ["King safety", "Forcing moves", "Attack"],
  },
  {
    id: "endgame-king", title: "Your king becomes a piece", category: "Endgames", minutes: 7, level: "Foundation",
    promise: "The simplest endgame idea, and the one that changes everything: activate the king.",
    concept: [
      "In the opening the king hides. In the ending, with few attacking pieces left, the king becomes one of your strongest pieces.",
      "A king one square closer to a passed pawn can decide the game. The engine's evaluation in a pawn ending often swings on a single king move.",
      "Before counting pawns, ask which king can get to the important squares first."
    ],
    checklist: ["Count material: is this really an endgame?", "Where is the action — passed pawns, weak pawns, or an open file?", "Which king arrives first?", "Can a pawn race be calculated to the end?"],
    moves: [], prompt: "White to move in a king-and-pawn ending. Bring the king toward the action; then ask Stockfish which king move it prefers.",
    habit: "When queens come off, stop hiding your king. Centralise it and make it work.",
    quiz: { question: "What changes most when queens are traded?", options: ["King safety stops mattering, so the king should become active", "Pawns stop mattering", "You should always attack immediately"], correct: 0, why: "With fewer attacking pieces, king activity becomes a decisive endgame resource." },
    tags: ["Endgames", "King activity", "Pawn endings"],
  },
  {
    id: "calculation", title: "Checks, captures, threats", category: "Calculation", minutes: 6, level: "Foundation",
    promise: "A calculation routine you can actually remember under pressure.",
    concept: [
      "You don't need to see ten moves ahead. You need a consistent order: look at checks, then captures, then threats — for both sides.",
      "A forcing move narrows the opponent's replies, which makes calculation shorter and more reliable.",
      "Before you play your candidate move, ask the same three questions from the opponent's point of view. That one habit prevents most blunders."
    ],
    checklist: ["List every check for you.", "List every capture for you.", "List the opponent's checks and captures after your move.", "Only then decide."],
    moves: ["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6"],
    prompt: "White to move. There is a forcing move with a concrete threat on the board. Use the routine to find it.",
    habit: "Never play a move until you have asked what your opponent's most forcing reply is.",
    quiz: { question: "What is the most reliable first step when calculating?", options: ["Look at quiet improving moves", "Look at checks, captures, and threats", "Count the total material"], correct: 1, why: "Forcing moves limit the opponent's replies, making the calculation tree small enough for a human." },
    tags: ["Calculation", "Blunder prevention", "Forcing moves"],
  },
  {
    id: "convert", title: "Convert an advantage", category: "Planning", minutes: 8, level: "Club",
    promise: "When you're winning, the hard part is not finding more — it's taking away their counterplay.",
    concept: [
      "A big advantage is often lost because the winning side keeps attacking instead of simplifying.",
      "Trade pieces (not necessarily pawns) when ahead in material, keep your king safe, and remove the opponent's active pieces first.",
      "Stockfish's top move in a winning position is frequently quiet: it kills counterplay before cashing in."
    ],
    checklist: ["What is the opponent's most active piece?", "Can you trade it without giving back material?", "Is your king still safe?", "What is their only source of counterplay?"],
    moves: [], prompt: "White is a queen up. Find the safe, simplifying move Stockfish prefers over a flashy attack.",
    habit: "When ahead, reduce the opponent's active pieces before pushing for a finish. When behind, keep pieces on and create complications.",
    quiz: { question: "You are winning material. What usually helps most?", options: ["Trade off the opponent's active pieces", "Launch an attack with your king", "Push every pawn"], correct: 0, why: "Fewer active enemy pieces means less counterplay — the safest route to converting." },
    tags: ["Conversion", "Simplifying", "Playing ahead"],
  },
  {
    id: "openings", title: "Why opening moves work", category: "Openings", minutes: 6, level: "Foundation",
    promise: "Replace memorised move orders with three jobs: centre, development, king safety.",
    concept: [
      "Opening theory is not a list of moves to memorise. Each natural move serves one of three jobs: fight for the centre, bring a piece out, or get the king safe.",
      "If you understand the job, you can find a sensible move even when the opponent leaves the book.",
      "Stockfish doesn't care about names. It cares about squares, time, and king cover."
    ],
    checklist: ["Do I control or occupy a central square?", "Is every minor piece on a useful square?", "Can I castle soon?", "Am I moving the same piece twice without a reason?"],
    moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"],
    prompt: "White to move. Choose a move that completes one of the three opening jobs.",
    habit: "When you leave your opening book, pick the move that develops a new piece or gets the king safe — not the one that simply looks aggressive.",
    quiz: { question: "Which is the clearest opening priority?", options: ["Move the queen out early", "Develop pieces and castle", "Push all pawns on one wing"], correct: 1, why: "Development and king safety prevent early tactics; early queen moves invite tempo losses." },
    tags: ["Opening principles", "Development", "King safety"],
  },
  {
    id: "defence", title: "Defend by finding their idea", category: "Defence", minutes: 8, level: "Advanced",
    promise: "The best defensive move is often the one that stops the opponent's plan before it becomes a threat.",
    concept: [
      "Defence is not passive. The first step is to ask what your opponent wants: which square, which file, which pawn break?",
      "A good defensive move either stops that idea, trades the attacking piece, or creates a counter-threat that forces them to slow down.",
      "The engine's 'only move' is frequently a quiet move that takes away a single crucial square."
    ],
    checklist: ["What is their next threat if you do nothing?", "Which of their pieces makes the attack work?", "Can you trade it?", "Can you counterattack in the centre?"],
    moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5", "Bb3", "d6", "c3", "O-O", "h3", "Na5", "Bc2", "c5", "d4", "Qc7", "Nbd2", "cxd4", "cxd4", "Bb7"],
    prompt: "White to move. Before looking for your own plan, name Black's idea — then find the move that keeps the centre under control.",
    habit: "Before defending, say your opponent's threat out loud. You cannot stop a plan you haven't identified.",
    quiz: { question: "What is the first question in defence?", options: ["How do I attack the king?", "What is my opponent threatening and which piece makes it work?", "Can I trade queens immediately?"], correct: 1, why: "Identifying the threat tells you which defensive resource actually matters." },
    tags: ["Defence", "Prophylaxis", "Counterplay"],
  },
];

const CUSTOM: Record<string, string> = {
  "endgame-king": "8/8/5pk1/6p1/8/5PP1/6K1/8 w - - 0 1",
  convert: "4k3/8/8/8/8/8/3Q4/4K3 w - - 0 1",
};

export const THEORY_MODULES: TheoryModule[] = RAW.map(module => ({ ...module, category: module.category.trim() as TheoryModule["category"], fen: CUSTOM[module.id] ?? position(module.moves) }));
export function moduleById(id: string) { return THEORY_MODULES.find(module => module.id === id) ?? THEORY_MODULES[0]; }
export function dayKey(date = new Date()) { return date.toISOString().slice(0, 10); }
export function todayModule(date = new Date()) {
  const epochDay = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000);
  return THEORY_MODULES[((epochDay % THEORY_MODULES.length) + THEORY_MODULES.length) % THEORY_MODULES.length];
}
