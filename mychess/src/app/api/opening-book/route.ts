import { and, isNotNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { games } from "@/db/schema";
import { cached } from "@/lib/cache";
import { ensureDatabase } from "@/lib/bootstrap";
import { dbUnavailable } from "@/lib/db-status";
import type { BookMap, BookReply } from "@/lib/game-narrative";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Curated first-move priors when a personal archive is still small. */
const PRIORS: Record<string, BookReply[]> = {
  "": [
    { san: "e4", count: 460 }, { san: "d4", count: 380 }, { san: "Nf3", count: 95 }, { san: "c4", count: 80 }, { san: "g3", count: 18 },
  ],
  "e4": [
    { san: "e5", count: 210 }, { san: "c5", count: 180 }, { san: "e6", count: 75 }, { san: "c6", count: 62 }, { san: "d5", count: 24 }, { san: "Nf6", count: 20 },
  ],
  "d4": [
    { san: "Nf6", count: 175 }, { san: "d5", count: 160 }, { san: "g6", count: 48 }, { san: "e6", count: 38 }, { san: "f5", count: 16 },
  ],
  "e4 e5": [
    { san: "Nf3", count: 240 }, { san: "Bc4", count: 58 }, { san: "f4", count: 32 }, { san: "Nc3", count: 26 },
  ],
  "e4 c5": [
    { san: "Nf3", count: 230 }, { san: "Nc3", count: 48 }, { san: "c3", count: 34 },
  ],
  "d4 d5": [
    { san: "c4", count: 210 }, { san: "Nf3", count: 62 }, { san: "Bf4", count: 40 },
  ],
};

async function buildBook(): Promise<BookMap> {
  await ensureDatabase();
  const rows = await db.select({ line: games.openingLine }).from(games).where(and(isNotNull(games.openingLine), ne(games.openingLine, ""))).limit(25000);
  const counts = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const sans = row.line.split(/\s+/).filter(Boolean).slice(0, 14);
    for (let i = 0; i < sans.length; i += 1) {
      const prefix = sans.slice(0, i).join(" ");
      const san = sans[i].replace(/[!?+#]/g, "");
      if (!san) continue;
      let bucket = counts.get(prefix);
      if (!bucket) counts.set(prefix, (bucket = new Map()));
      bucket.set(san, (bucket.get(san) ?? 0) + 1);
    }
  }
  // Add the curated priors so the first moves always have an answer.
  for (const [prefix, replies] of Object.entries(PRIORS)) {
    let bucket = counts.get(prefix);
    if (!bucket) counts.set(prefix, (bucket = new Map()));
    for (const reply of replies) bucket.set(reply.san, (bucket.get(reply.san) ?? 0) + reply.count);
  }
  // Public masters explorer, when this deployment can reach it.
  try {
    const response = await fetch("https://explorer.lichess.ovh/masters?fen=rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR%20w%20KQkq%20-%200%201&moves=6&topGames=0", {
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (response.ok) {
      const json = (await response.json()) as { moves?: { san: string; white: number; draws: number; black: number }[] };
      const bucket = counts.get("") ?? new Map<string, number>();
      for (const move of json.moves ?? []) {
        const gamesCount = move.white + move.draws + move.black;
        bucket.set(move.san, (bucket.get(move.san) ?? 0) + gamesCount);
      }
      counts.set("", bucket);
    }
  } catch { /* personal archive still supplies the book */ }

  const book: BookMap = {};
  for (const [prefix, bucket] of counts) {
    const replies = [...bucket.entries()]
      .map(([san, count]) => ({ san, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .filter(reply => reply.count >= 2);
    if (replies.length) book[prefix] = replies;
  }
  return book;
}

export async function GET() {
  const unavailable = dbUnavailable(); if (unavailable) return unavailable;
  try {
    const book = await cached("opening-book-v1", 5 * 60_000, buildBook);
    return Response.json({ ok: true, book });
  } catch (error) {
    return Response.json({ ok: false, book: PRIORS, error: error instanceof Error ? error.message : "Book unavailable" }, { status: 200 });
  }
}
