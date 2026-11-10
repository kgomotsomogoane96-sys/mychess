import { Chess } from "chess.js";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { referenceGames } from "@/db/schema";
import { openingFromChesscomUrl } from "@/lib/features";
import type { ReferenceGame } from "@/lib/types";

export const ELITE_PLAYERS = [
  { username: "magnuscarlsen", name: "Magnus Carlsen" },
  { username: "hikaru", name: "Hikaru Nakamura" },
  { username: "fabianocaruana", name: "Fabiano Caruana" },
  { username: "dingliren", name: "Ding Liren" },
  { username: "gukeshdommaraju", name: "Gukesh Dommaraju" },
  { username: "anishgiri", name: "Anish Giri" },
  { username: "wesleyso", name: "Wesley So" },
  { username: "levonaronian", name: "Levon Aronian" },
  { username: "alexandrabotez", name: "Alexandra Botez" },
  { username: "chessqueen", name: "Anna Cramling" },
  { username: "danielnaroditsky", name: "Daniel Naroditsky" },
  { username: "chessbrah", name: "Eric Hansen" },
];

type Remote = Record<string, unknown> & { pgn?: string; url?: string };

export async function fetchMonth(url: string): Promise<Remote[]> {
  const response = await fetch(url, { headers: { "User-Agent": "MYCHESS public game study" }, cache: "no-store" });
  if (!response.ok) return [];
  const json = await response.json() as { games?: Remote[] };
  return (json.games ?? []).filter(game => game.pgn && (!game.rules || game.rules === "chess"));
}

export function parseReference(raw: string, meta: { source: string; url: string | null; tags: string[] }) {
  const chess = new Chess();
  chess.loadPgn(raw, { strict: false });
  const headers = chess.getHeaders();
  const history = chess.history({ verbose: true });
  const initialFen = history[0]?.before ?? headers.FEN ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const middle = history[Math.min(history.length - 1, Math.max(11, Math.floor(history.length * .44)))]?.after ?? initialFen;
  const opening = openingFromChesscomUrl(headers.ECOUrl);
  const white = headers.White && headers.White !== "?" ? headers.White : "White";
  const black = headers.Black && headers.Black !== "?" ? headers.Black : "Black";
  const date = headers.UTCDate || headers.Date;
  const parsedDate = date && /^\d{4}\.\d{2}\.\d{2}/.test(date) ? new Date(`${date.slice(0, 4)}-${date.slice(5, 7)}-${date.slice(8, 10)}T${headers.UTCTime || "12:00:00"}Z`) : null;
  const playedAt = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;
  return {
    externalUrl: meta.url, source: meta.source, whiteName: white, blackName: black,
    whiteElo: Number(headers.WhiteElo) || null, blackElo: Number(headers.BlackElo) || null,
    result: headers.Result || "*", opening: opening?.name ?? (headers.Opening && headers.Opening !== "?" ? headers.Opening : "Uncharted opening"),
    openingFamily: opening?.family ?? (headers.Opening && headers.Opening !== "?" ? headers.Opening.split(":")[0] : "Uncharted opening"),
    eco: headers.ECO || null, event: headers.Event && headers.Event !== "?" ? headers.Event : null,
    speed: typeof headers.TimeControl === "string" ? (Number(headers.TimeControl.split("+")[0]) < 180 ? "bullet" : Number(headers.TimeControl.split("+")[0]) < 600 ? "blitz" : "rapid") : null,
    playedAt, pgn: chess.pgn(), initialFen, midgameFen: middle, midgamePly: Math.min(history.length, Math.max(12, Math.floor(history.length * .44))),
    plyCount: history.length, tags: meta.tags,
  };
}

export async function referenceCount() {
  const rows = await db.select({ value: sql<number>`count(*)::int` }).from(referenceGames);
  return rows[0]?.value ?? 0;
}

export async function listReference(options: { q?: string; opening?: string; player?: string; era?: string; tier?: string; page?: number; pageSize?: number }) {
  const clauses = [];
  if (options.q) clauses.push(or(ilike(referenceGames.whiteName, `%${options.q}%`), ilike(referenceGames.blackName, `%${options.q}%`), ilike(referenceGames.opening, `%${options.q}%`)));
  if (options.opening) clauses.push(eq(referenceGames.openingFamily, options.opening));
  if (options.player) clauses.push(or(ilike(referenceGames.whiteName, `%${options.player}%`), ilike(referenceGames.blackName, `%${options.player}%`)));
  if (options.era && options.era !== "all") clauses.push(eq(referenceGames.era, options.era));
  if (options.tier && options.tier !== "all") clauses.push(eq(referenceGames.tier, options.tier));
  const where = clauses.length ? and(...clauses) : undefined;
  const pageSize = Math.min(60, options.pageSize ?? 30); const page = Math.max(1, options.page ?? 1);
  const [rows, totals, families] = await Promise.all([
    db.select().from(referenceGames).where(where).orderBy(desc(referenceGames.playedAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ value: sql<number>`count(*)::int` }).from(referenceGames).where(where),
    db.select({ name: referenceGames.openingFamily, value: sql<number>`count(*)::int` }).from(referenceGames).groupBy(referenceGames.openingFamily).orderBy(desc(sql`count(*)`)).limit(10),
  ]);
  return { items: rows.map(row => ({ ...row, playedAt: row.playedAt?.toISOString() ?? null }) as ReferenceGame), total: totals[0]?.value ?? 0, page, pageSize, families: families.map(row => ({ name: row.name, count: row.value })) };
}
