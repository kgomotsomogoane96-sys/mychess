import { Chess } from "chess.js";

export type OpeningMove = { san: string; note: string };
export type OpeningSideline = { name: string; note: string; moves: string[] };
export type OpeningLesson = {
  id: string;
  name: string;
  eco: string;
  side: "white" | "black";
  family: string;
  level: "Foundation" | "Club" | "Advanced";
  blurb: string;
  mainline: OpeningMove[];
  sidelines: OpeningSideline[];
};

/**
 * A curated theory curriculum: the main line and the two sidelines that decide
 * most practical games. Notes explain the idea behind each move — not memorised
 * move orders. Extend freely; the trainer renders any lesson with moves.
 */
export const OPENINGS: OpeningLesson[] = [
  {
    id: "ruy-lopez", name: "Ruy Lopez", eco: "C60", side: "white", family: "King's Pawn", level: "Club",
    blurb: "The classical way to pressure e5: pin the knight, castle fast, and fight for the centre with d4.",
    mainline: [
      { san: "e4", note: "Takes the centre and opens lines for the queen and bishop." },
      { san: "Nf3", note: "Develops and attacks e5 — this is the whole opening in miniature." },
      { san: "Bb5", note: "The Ruy: the bishop pins the knight defending e5. It is a threat, not just a move." },
      { san: "O-O", note: "King safety first. The bishop can stay on b5 or retreat; the king is the priority." },
      { san: "Re1", note: "The rook backs the e-pawn and eyes the e-file. Quiet, but it prepares d4." },
      { san: "Bb3", note: "A retreat that keeps the bishop on the a2–g8 diagonal — the strongest diagonal in the opening." },
      { san: "c3", note: "Prepares d4 and gives the bishop a home on c2 or b3's line." },
      { san: "d4", note: "The point of the whole plan: fight for the centre while your king is safe." },
      { san: "h3", note: "A useful waiting move that stops Bg4 pinning the knight." },
    ],
    sidelines: [
      { name: "Berlin Defence", note: "3…Nf6 keeps the centre flexible. After 4.O-O Nxe4 White gets long-term pressure in the endgame — the famous Berlin Wall.", moves: ["e4","e5","Nf3","Nc6","Bb5","Nf6","O-O","Nxe4"] },
      { name: "Marshall Attack", note: "Black gives up a pawn for a lead in development and open lines against the king. Study the sacrifices before playing it.", moves: ["e4","e5","Nf3","Nc6","Bb5","a6","Ba4","Nf6","O-O","Be7","Re1","b5","Bb3","O-O","c3","d5"] },
    ],
  },
  {
    id: "italian", name: "Italian Game", eco: "C50", side: "white", family: "King's Pawn", level: "Foundation",
    blurb: "The simplest complete opening: develop toward the centre, castle, then strike with d4 or f4.",
    mainline: [
      { san: "e4", note: "Central space." },
      { san: "Nf3", note: "Attacks e5 and clears the way to castle." },
      { san: "Bc4", note: "The eye is on f7 — the weakest square in Black's camp." },
      { san: "c3", note: "Prepares d4 and gives the knight a retreat square." },
      { san: "d3", note: "Solid. You keep the tension and castle next." },
      { san: "O-O", note: "King safe. Now the rook can support d4 or a4–a5 plans." },
    ],
    sidelines: [
      { name: "Evans Gambit", note: "4.b4 and 5.c3 gambits a pawn for open lines and fast development. Romantic and completely sound at club level.", moves: ["e4","e5","Nf3","Nc6","Bc4","Bc5","b4","Bxb4","c3","Ba5","d4"] },
      { name: "Fried Liver", note: "4.Ng5 attacks f7 immediately. The refutation is 4…Nf6 5.Nxf7 — only play this if you study the forcing line.", moves: ["e4","e5","Nf3","Nc6","Bc4","Nf6","Ng5","d5","exd5","Na5"] },
    ],
  },
  {
    id: "queens-gambit", name: "Queen's Gambit", eco: "D30", side: "white", family: "Queen's Pawn", level: "Club",
    blurb: "Offer the c-pawn to own the centre. If Black takes, you get free development and central control.",
    mainline: [
      { san: "d4", note: "Central space without committing the king's pawn." },
      { san: "c4", note: "The gambit. Black cannot keep the pawn without losing time." },
      { san: "Nc3", note: "Adds a second attacker to d5 — the pressure is the point." },
      { san: "Nf3", note: "Development that also supports e3 and Bf4." },
      { san: "Bg5", note: "Pins the f6-knight that defends d5." },
      { san: "e3", note: "Opens the bishop and supports d4. Modest, but structurally sound." },
      { san: "Bd3", note: "The bishop aims at the kingside; once Black castles, e4 or Ne5 follows." },
    ],
    sidelines: [
      { name: "Exchange Variation", note: "5.cxd5 gives Black a hanging pawns structure. Plan: pressure c5 and d4.", moves: ["d4","d5","c4","e6","Nc3","Nf6","Bg5","Be7","e3","O-O","Nf3","h6","Bh4","b6","cxd5","exd5"] },
      { name: "Catalan", note: "g3 and Bg2 trade the centre for a long diagonal that bites the queenside for the whole game.", moves: ["d4","Nf6","c4","e6","g3","d5","Bg2","Be7","Nf3","O-O"] },
    ],
  },
  {
    id: "london", name: "London System", eco: "D02", side: "white", family: "Queen's Pawn", level: "Foundation",
    blurb: "One reliable setup against almost anything. Learn the plans once, and you always have a move.",
    mainline: [
      { san: "d4", note: "Space." },
      { san: "Nf3", note: "Stops e5 and keeps options open." },
      { san: "Bf4", note: "The London bishop: it develops before e3 blocks it." },
      { san: "e3", note: "Solidifies d4 and opens the dark-square bishop." },
      { san: "c3", note: "The pyramid: d4 backed by c3 and e3 is hard to shift." },
      { san: "Bd3", note: "Kingside battery on h7." },
      { san: "Nbd2", note: "The knight supports e4 and c4 breaks." },
    ],
    sidelines: [
      { name: "Jobava London", note: "Nc3 alongside Bf4 is sharper: the knight eyes d5 and can jump to e4.", moves: ["d4","d5","Nc3","Nf6","Bf4"] },
      { name: "Anti-Indian setup", note: "Against Nf6 setups, e3 plus Nbd2 keeps the structure; break with e4 only when prepared.", moves: ["d4","Nf6","Nf3","e6","Bf4","b6","e3","Bb7","Bd3"] },
    ],
  },
  {
    id: "english", name: "English Opening", eco: "A10", side: "white", family: "Flank", level: "Club",
    blurb: "A flexible flank opening: control d5, develop the knights, and transpose when the moment is right.",
    mainline: [
      { san: "c4", note: "Pressures d5 without committing a central pawn yet." },
      { san: "Nc3", note: "Development that makes d5 harder to achieve." },
      { san: "Nf3", note: "Flexible: e3 or g3 both follow." },
      { san: "g3", note: "The fianchetto is the English's signature: the bishop slices the long diagonal." },
      { san: "Bg2", note: "The bishop eyes the queenside and the centre from a safe distance." },
      { san: "O-O", note: "Safe king, quiet moves — the point is pressure, not a quick attack." },
    ],
    sidelines: [
      { name: "Four Knights English", note: "Both sides develop all four knights; plans come from pawn breaks c3–d4 or e3–d4.", moves: ["c4","e5","Nc3","Nf6","Nf3","Nc6"] },
      { name: "Reversed Sicilian", note: "2…e5 turns it into a Sicilian with colours reversed. Open the f-file early with f4 if you know it.", moves: ["c4","e5","Nc3","Nf6","Nf3","Nc6","g3"] },
    ],
  },
  {
    id: "sicilian-najdorf", name: "Sicilian Najdorf", eco: "B90", side: "black", family: "Sicilian", level: "Advanced",
    blurb: "The strongest counterattack against e4: unbalanced pawn structures and a queenside majority to play with.",
    mainline: [
      { san: "e4", note: "Black's aim: attack d4 and fight for the centre from the flank." },
      { san: "c5", note: "The Sicilian: asymmetry from move one." },
      { san: "d6", note: "Keeps the knight flexible and prepares Nf6." },
      { san: "cxd4", note: "Exchange the flank pawn for a central pawn — the basic trade." },
      { san: "Nxd4", note: "The knight centralises; the open c-file becomes Black's territory." },
      { san: "Nf6", note: "Attacks e4 and completes development." },
      { san: "a6", note: "The Najdorf: stops Bb5/Nb5 and prepares a later b5 expansion." },
      { san: "e5", note: "A thematic break that opens lines toward the king or wins space." },
      { san: "Be6", note: "Development that eyes d5 and supports b5." },
    ],
    sidelines: [
      { name: "English Attack setup", note: "White plays f3, Qd2, O-O-O and g4. Black should strike with …b5 before g4 arrives.", moves: ["e4","c5","Nf3","d6","d4","cxd4","Nxd4","Nf6","Nc3","a6","Be3","e5","Nb3","Be6","f3","Be7","Qd2","O-O"] },
      { name: "Poisoned Pawn", note: "6…Qb6!? grabs b2 and dares White to prove compensation. Only with full preparation.", moves: ["e4","c5","Nf3","d6","d4","cxd4","Nxd4","Nf6","Nc3","a6","Bg5","e6","f4","Qb6"] },
    ],
  },
  {
    id: "sicilian-dragon", name: "Sicilian Dragon", eco: "B70", side: "black", family: "Sicilian", level: "Club",
    blurb: "A fianchettoed bishop and opposite-side attacks. Concrete, sharp, and very learnable.",
    mainline: [
      { san: "e4", note: "Fight for the centre from the flank." },
      { san: "c5", note: "The Sicilian trade." },
      { san: "d6", note: "Flexible: the d-pawn supports e5." },
      { san: "cxd4", note: "Trade the flank pawn." },
      { san: "Nxd4", note: "Central knight." },
      { san: "Nf6", note: "Attacks e4." },
      { san: "g6", note: "The Dragon: the bishop takes the long diagonal." },
      { san: "Bg7", note: "The bishop becomes a major attacking piece on h8–a1." },
      { san: "O-O", note: "Castle. Black can later push …b5 and attack the queenside." },
    ],
    sidelines: [
      { name: "Yugoslav Attack", note: "White plays Be3, f3, Qd2 and O-O-O. Black must attack on the queenside faster than White attacks on the kingside.", moves: ["e4","c5","Nf3","d6","d4","cxd4","Nxd4","Nf6","Nc3","g6","Be3","Bg7","f3","O-O","Qd2"] },
      { name: "Classical setup", note: "Against quieter White systems, …Nc6 and …d5 is the break to aim for.", moves: ["e4","c5","Nf3","d6","Nc3","Nc6","d4","cxd4","Nxd4","Nf6","g6"] },
    ],
  },
  {
    id: "french", name: "French Defence", eco: "C00", side: "black", family: "King's Pawn", level: "Club",
    blurb: "A solid wedge on d5 with the c5 break to attack the centre. Structure matters more than memorising lines.",
    mainline: [
      { san: "e4", note: "Build the pawn chain: d5 and e6 make d4 hard to use." },
      { san: "e6", note: "Supports d5 and prepares the bishop." },
      { san: "d5", note: "Claims space and challenges e4." },
      { san: "d4", note: "Maintain the chain and prepare c5." },
      { san: "c5", note: "The break. This is the French plan in one move." },
      { san: "Nc6", note: "Development that pressures d4." },
    ],
    sidelines: [
      { name: "Winawer Variation", note: "3.Nc3 Bb4 pins the knight. After e5 the position is closed; the c5 break becomes essential.", moves: ["e4","e6","d4","d5","Nc3","Bb4","e5","c5","a3","Bxc3+","bxc3"] },
      { name: "Advance French", note: "3.e5 closes the centre. Plan: build f6 or c5 breaks before White expands with f4–f5.", moves: ["e4","e6","d4","d5","e5","c5","c3","Nc6","Nf3"] },
    ],
  },
  {
    id: "caro-kann", name: "Caro-Kann", eco: "B10", side: "black", family: "King's Pawn", level: "Club",
    blurb: "The most durable defence to e4: solid pawns, active bishops, and an endgame that is never bad.",
    mainline: [
      { san: "e4", note: "Prepare d5 and build a strong centre." },
      { san: "c6", note: "Supports d5 without blocking the light bishop." },
      { san: "d5", note: "Claims the centre." },
      { san: "dxe4", note: "Free the light bishop — the Caro's key advantage over the French." },
      { san: "Bf5", note: "The bishop gets out before …e6 locks it in." },
      { san: "Nf3", note: "Development and support for e5 ideas." },
    ],
    sidelines: [
      { name: "Classical", note: "4…Bf5 is the main line. Keep the bishop active and aim for a sound endgame.", moves: ["e4","c6","d4","d5","Nc3","dxe4","Nxe4","Bf5","Ng3","Bg6","Nf3"] },
      { name: "Advance Caro", note: "3.e5 closes the centre. The c5 break becomes urgent: play …c5 before White consolidates.", moves: ["e4","c6","d4","d5","e5","Bf5","Nc3","e6","Nf3"] },
    ],
  },
  {
    id: "qgd", name: "Queen's Gambit Declined", eco: "D30", side: "black", family: "Queen's Pawn", level: "Club",
    blurb: "A classical defence to 1.d4: hold the centre, develop, and aim for the e5 break.",
    mainline: [
      { san: "d4", note: "Hold the centre with e6 and d5." },
      { san: "d5", note: "The pawn chain is the defence." },
      { san: "e6", note: "Supports d5 and opens the dark bishop." },
      { san: "Nf6", note: "Development that controls e4." },
      { san: "Be7", note: "Prepares castling and stops pins on f6." },
      { san: "O-O", note: "King safety first." },
      { san: "Nbd7", note: "The knight supports e5 and c5 breaks." },
    ],
    sidelines: [
      { name: "Tartakower", note: "The …b6 fianchetto keeps the c8-bishop alive instead of locking it behind pawns.", moves: ["d4","d5","c4","e6","Nc3","Nf6","Bg5","Be7","e3","O-O","Bd3","b6"] },
      { name: "Orthodox", note: "…c6 and …Qc7 are the old setup. Aim for a position where the c8-bishop is useful.", moves: ["d4","d5","c4","e6","Nc3","Nf6","Bg5","Be7","Nf3","O-O","e3","h6","Bh4"] },
    ],
  },
  {
    id: "slav", name: "Slav Defence", eco: "D10", side: "black", family: "Queen's Pawn", level: "Club",
    blurb: "The d5-pawn stays protected by c6, so the c8-bishop gets out before the pawn chain closes.",
    mainline: [
      { san: "d4", note: "Hold the centre without locking in your bishop." },
      { san: "d5", note: "The chain." },
      { san: "c6", note: "The Slav idea: d5 is defended without …e6." },
      { san: "Nf6", note: "Development and pressure on e4." },
      { san: "Bf5", note: "The whole point: the bishop is free to move." },
    ],
    sidelines: [
      { name: "Botvinnik", note: "The sharpest line — 5…dxc4 followed by …b5. Study it as a weapon, not a default.", moves: ["d4","d5","c4","c6","Nf3","Nf6","Nc3","dxc4","a4","Bf5","e3","e6","Bxc4","Bb4"] },
      { name: "Exchange Slav", note: "After cxd5 the structure is symmetrical. Small advantages only: the c-file and the bishop pair if traded.", moves: ["d4","d5","c4","c6","cxd5","cxd5","Nc3","Nf6"] },
    ],
  },
  {
    id: "nimzo-indian", name: "Nimzo-Indian", eco: "E20", side: "black", family: "Indian", level: "Advanced",
    blurb: "The most respected defence in chess: fight the centre with pieces, not pawns, and provoke weaknesses.",
    mainline: [
      { san: "d4", note: "Fight for the centre with pieces." },
      { san: "Nf6", note: "Control e4 without committing pawns." },
      { san: "e6", note: "Open the dark bishop." },
      { san: "Bb4", note: "The pin. Black is willing to give up the bishop pair to wreck White's structure." },
      { san: "O-O", note: "Castle and target the doubled pawns after …Bxc3." },
      { san: "d5", note: "The centre. Black wins space and opens the c-file." },
    ],
    sidelines: [
      { name: "Rubinstein", note: "4.e3 is White's calmest choice. The plan is Bd3, Nf3 and d4–e4 — meet it with …c5 and …Nc6.", moves: ["d4","Nf6","c4","e6","Nc3","Bb4","e3","O-O","Bd3","d5","Nf3"] },
      { name: "Sämisch", note: "4.f3 supports e4 and aims for a kingside attack. Answer with …d5 and …c5 before White consolidates.", moves: ["d4","Nf6","c4","e6","Nc3","Bb4","f3","d5","a3","Bxc3+","bxc3"] },
    ],
  },
  {
    id: "kings-indian", name: "King's Indian Defence", eco: "E60", side: "black", family: "Indian", level: "Club",
    blurb: "The counterattacking defence: castle fast, build the kingside pawns, and strike with …f5.",
    mainline: [
      { san: "d4", note: "Fianchetto and castle — the centre can wait." },
      { san: "Nf6", note: "Attacks e4 and develops." },
      { san: "g6", note: "The bishop takes the long diagonal." },
      { san: "Bg7", note: "The bishop becomes a monster on a1–h8." },
      { san: "d6", note: "Supports e5 and keeps the pawn structure flexible." },
      { san: "O-O", note: "King safety first." },
      { san: "e5", note: "The break. Black's entire plan is to push …f5 and attack the king." },
    ],
    sidelines: [
      { name: "Classical Attack", note: "White plays Be2 and O-O. Meet the centre with …e5 and use the f-file after …f5.", moves: ["d4","Nf6","c4","g6","Nc3","Bg7","e4","d6","Nf3","O-O","Be2","e5"] },
      { name: "Sämisch / 5.f3", note: "f3 supports e4 and aims for g4. Meet it with …Nc6 and …e5 before the attack starts.", moves: ["d4","Nf6","c4","g6","Nc3","Bg7","e4","d6","f3"] },
    ],
  },
  {
    id: "grunfeld", name: "Grünfeld Defence", eco: "D80", side: "black", family: "Indian", level: "Advanced",
    blurb: "Give White the centre to break it apart with pieces. The most principled way to fight 1.d4.",
    mainline: [
      { san: "d4", note: "Fight for the centre with pieces." },
      { san: "Nf6", note: "Develop and control e4." },
      { san: "g6", note: "The fianchetto will pressure d4 from afar." },
      { san: "d5", note: "The Grünfeld break: invite cxd5 and then pile on d4." },
      { san: "Nxd5", note: "Trade the centre for piece activity and pressure on c3/d4." },
      { san: "Nxc3", note: "The knight takes back; Black targets the c3-pawn with …c5 and …Nc6." },
    ],
    sidelines: [
      { name: "Exchange Variation", note: "After bxc3 White has a big centre — your whole plan is to break it with …c5 and …Nc6.", moves: ["d4","Nf6","c4","g6","Nc3","d5","cxd5","Nxd5","e4","Nxc3","bxc3","Bg7","Nf3","c5"] },
      { name: "Russian System", note: "Nf3 and Qb3 is White's calmer route. Keep …d5 and …c5 as your breaks.", moves: ["d4","Nf6","c4","g6","Nc3","d5","Nf3","Bg7"] },
    ],
  },
  {
    id: "petroff", name: "Petroff Defence", eco: "C42", side: "black", family: "King's Pawn", level: "Club",
    blurb: "The most solid answer to 1.e4. Avoids opening traps and heads for a playable endgame.",
    mainline: [
      { san: "e4", note: "Copy White and attack e4." },
      { san: "e5", note: "The Petroff idea: symmetry first, imbalance later." },
      { san: "Nf3", note: "Attack the knight back." },
      { san: "Nf6", note: "The counterattack on e4." },
      { san: "Nxe4", note: "Grab the pawn temporarily; the d5 break frees the position." },
      { san: "d6", note: "Kicks the knight and opens the light bishop." },
    ],
    sidelines: [
      { name: "Classical Attack", note: "3.Nxe5 and 4.d4 leads to an open, balanced game. Keep the bishop pair if possible.", moves: ["e4","e5","Nf3","Nf6","Nxe5","d6","Nf3","Nxe4","d4"] },
      { name: "Stafford Gambit", note: "3…Nc6 4…Nf6 invites 5.Nxc6 bxc6 with attacking chances for the pawn. Refutations exist — only play with preparation.", moves: ["e4","e5","Nf3","Nf6","Nxe5","Nc6"] },
    ],
  },
  {
    id: "caro-closing", name: "Caro-Kann Advance", eco: "B12", side: "black", family: "King's Pawn", level: "Foundation",
    blurb: "A simple pawn structure and clear breaks. The fastest way to get a playable position against 1.e4.",
    mainline: [
      { san: "e4", note: "Prepare the d5 wedge." },
      { san: "c6", note: "The Caro idea: support d5 without locking the bishop." },
      { san: "d5", note: "Claim the centre." },
      { san: "e5", note: "White closes the centre. Your plan becomes …c5 and piece development." },
      { san: "c5", note: "The break that frees the position." },
      { san: "Nc6", note: "Development that pressures d4." },
    ],
    sidelines: [
      { name: "Advance Tal", note: "h5 and …Nh6 are aggressive ideas against White's early expansion.", moves: ["e4","c6","d4","d5","e5","Bf5","Nc3","e6","Nf3","Nd7"] },
      { name: "Modern Mainline", note: "The bishop develops before …e6. Keep it out of the pawn chain and aim for …c5 followed by …Ne5.", moves: ["e4","c6","d4","d5","e5","Bf5","Nc3","e6","Nf3","Nd7","Be2"] },
    ],
  },
];

export function openingById(id: string) {
  return OPENINGS.find(opening => opening.id === id) ?? OPENINGS[0];
}

export function fenFromOpening(opening: OpeningLesson, ply: number, moves: string[] = opening.mainline.map(m => m.san)) {
  const chess = new Chess();
  for (const san of moves.slice(0, ply)) {
    try { chess.move(san); } catch { break; }
  }
  return chess.fen();
}
