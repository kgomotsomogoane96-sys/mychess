import { Chess } from "chess.js";
import { familyFromName, gameFacts, openingFromChesscomUrl, terminationFromText, type GameFacts } from "@/lib/features";
import { uciOf } from "@/lib/lines";
import { openingName } from "@/lib/openings";
import type { ColorName } from "@/lib/types";
import type { ReplayMove } from "@/lib/classify";

export type ParsedGame = {
  pgn: string; pgnHash: string; whiteName: string; blackName: string; whiteRating: number | null; blackRating: number | null; result: string;
  opening: string; openingFamily: string; eco: string | null; timeControl: string | null; speed: string | null; event: string | null; site: string | null;
  playedAt: Date | null; initialFen: string; plyCount: number; uciMoves: string[]; bookPlies: number; moves: ReplayMove[]; facts: GameFacts; terminationText: string | null; terminationCode: string | null;
};

function headerNumber(value?: string | null) { if (!value) return null; const n = Number(value); return Number.isFinite(n) && n > 0 ? Math.round(n) : null; }

export function parsePgnDate(date?: string | null, time?: string | null) {
  if (!date) return null;
  const match = date.match(/^(\d{4})\.(\d{2}|\?\?)\.(\d{2}|\?\?)/);
  if (!match) return null;
  const year = Number(match[1]); if (!year) return null;
  const month = match[2] === "??" ? 1 : Number(match[2]);
  const day = match[3] === "??" ? 1 : Number(match[3]);
  const clock = time?.match(/^(\d{2}):(\d{2}):(\d{2})/);
  return new Date(Date.UTC(year, month - 1, day, clock ? Number(clock[1]) : 12, clock ? Number(clock[2]) : 0, clock ? Number(clock[3]) : 0));
}

export function speedFromTimeControl(tc?: string | null) {
  if (!tc || tc === "-") return null;
  const [base, inc] = tc.split("+").map(Number);
  if (!Number.isFinite(base)) return tc.includes("/") ? "daily" : null;
  const estimate = base + (Number.isFinite(inc) ? inc * 40 : 0);
  if (estimate < 180) return "bullet";
  if (estimate < 600) return "blitz";
  if (estimate < 1800) return "rapid";
  return "classical";
}

export function formatTimeControl(tc?: string | null) {
  if (!tc || tc === "-") return "casual";
  if (tc.includes("/")) return "daily";
  const [base, inc] = tc.split("+");
  const seconds = Number(base);
  if (!Number.isFinite(seconds)) return tc;
  const clock = seconds >= 60 ? `${Math.round(seconds / 60)} min` : `${seconds}s`;
  return inc && inc !== "0" ? `${clock} + ${inc}s` : clock;
}

export function splitPgn(raw: string) {
  const text = raw.replace(/\r/g, "").trim();
  if (!text) return [];
  if (!text.includes("[Event") && looksLikeFen(text)) {
    const fen = text.split("\n")[0].trim();
    return [`[Event "Position"]\n[Site "MYCHESS"]\n[Date "${todayStamp()}"]\n[White "White"]\n[Black "Black"]\n[Result "*"]\n[SetUp "1"]\n[FEN "${fen}"]\n\n* `];
  }
  const parts = text.split(/\n(?=\[Event\s)/).map(part => part.trim()).filter(Boolean);
  return parts.length ? parts : [text];
}

function todayStamp() { const now = new Date(); return `${now.getUTCFullYear()}.${String(now.getUTCMonth() + 1).padStart(2, "0")}.${String(now.getUTCDate()).padStart(2, "0")}`; }
export function looksLikeFen(text: string) { const fen = text.trim().split(/\s+/); return fen.length >= 4 && /^([rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+$/.test(fen[0]); }

export function hashPgn(pgn: string) {
  let hash = 5381; const text = pgn.replace(/\s+/g, " ").trim();
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  return `p${hash.toString(16)}${text.length.toString(16)}`;
}

export function parseGame(raw: string, options: { legal?: boolean } = {}): ParsedGame {
  const chess = new Chess();
  chess.loadPgn(raw, { strict: false });
  const headers = chess.getHeaders();
  const history = chess.history({ verbose: true });
  const initialFen = history[0]?.before ?? headers.FEN ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const moves: ReplayMove[] = history.map((move, index) => ({
    ply: index + 1, san: move.san, uci: uciOf(move), color: move.color, piece: move.piece, captured: move.captured, from: move.from, to: move.to,
    fenBefore: move.before, fenAfter: move.after, legalCount: options.legal ? new Chess(move.before).moves().length : 0,
  }));
  const uciMoves = moves.map(move => move.uci);
  const local = openingName(uciMoves, null, headers.ECO);
  const chesscom = openingFromChesscomUrl(headers.ECOUrl);
  const headerName = headers.Opening && headers.Opening !== "?" ? headers.Opening : null;
  const opening = chesscom?.name ?? headerName ?? local.name;
  const openingFamily = chesscom?.family ?? (headerName ? familyFromName(headerName) : local.bookPlies >= 3 ? local.name : familyFromName(local.name));
  const pgn = chess.pgn();
  return {
    pgn, pgnHash: hashPgn(pgn),
    whiteName: headers.White && headers.White !== "?" ? headers.White : "White", blackName: headers.Black && headers.Black !== "?" ? headers.Black : "Black",
    whiteRating: headerNumber(headers.WhiteElo), blackRating: headerNumber(headers.BlackElo), result: headers.Result || "*",
    opening, openingFamily, eco: headers.ECO || local.eco || null, timeControl: headers.TimeControl || null, speed: speedFromTimeControl(headers.TimeControl),
    event: headers.Event && headers.Event !== "?" ? headers.Event : null, site: headers.Site && headers.Site !== "?" ? headers.Site : null,
    playedAt: parsePgnDate(headers.UTCDate || headers.Date, headers.UTCTime || headers.StartTime), initialFen, plyCount: moves.length, uciMoves, bookPlies: local.bookPlies, moves,
    facts: gameFacts(moves), terminationText: headers.Termination || null, terminationCode: terminationFromText(headers.Termination || null),
  };
}

export function detectYou(white: string, black: string, names: string[]): ColorName | null {
  const set = new Set(names.map(name => name.trim().toLowerCase()).filter(name => name && !["you", "white", "black"].includes(name)));
  if (set.has(white.trim().toLowerCase())) return "white";
  if (set.has(black.trim().toLowerCase())) return "black";
  return null;
}

export function resultLabel(result: string, you?: ColorName | null) {
  if (result === "1-0") return you === "black" ? "Loss" : you === "white" ? "Win" : "White won";
  if (result === "0-1") return you === "white" ? "Loss" : you === "black" ? "Win" : "Black won";
  if (result === "1/2-1/2") return "Draw";
  return "Unfinished";
}

export function scoreFor(result: string, color: ColorName) {
  if (result === "1/2-1/2") return 0.5;
  if (result === "1-0") return color === "white" ? 1 : 0;
  if (result === "0-1") return color === "black" ? 1 : 0;
  return null;
}
