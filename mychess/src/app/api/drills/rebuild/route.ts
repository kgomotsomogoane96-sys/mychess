import { asc, eq, inArray, sql } from "drizzle-orm";
import { Chess } from "chess.js";
import { materialFromFen } from "@/lib/features";
import { db } from "@/db";
import { drills, games } from "@/db/schema";
import { dbUnavailable } from "@/lib/db-status";
import { makeDrills } from "@/lib/learning-drills";
import { ensureProfile, replaceDrills } from "@/lib/store";
import type { AnalyzedMove, ColorName } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Regenerates practice queues from stored analysis, dropping dead-lost
 * positions. Runs in resumable batches so serverless timeouts can't leave
 * the library half-rebuilt. Pass ?offset=&limit= or let the UI loop.
 */
export async function POST(request: Request) {
  const unavailable = dbUnavailable(); if (unavailable) return unavailable;
  const url = new URL(request.url);
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
  const limit = Math.min(60, Math.max(1, Number(url.searchParams.get("limit") ?? 40) || 40));
  const profile = await ensureProfile();
  const rows = await db.select({
    id: games.id, accountId: games.accountId, youColor: games.youColor, moves: games.moves,
  }).from(games).where(eq(games.status, "analyzed")).orderBy(asc(games.id)).limit(limit).offset(offset);

  let added = 0, processed = 0;
  for (const row of rows) {
    const moves = (row.moves ?? []) as AnalyzedMove[];
    if (!moves.length) continue;
    const next = makeDrills(moves, (row.youColor as ColorName | null) ?? null, profile.focus);
    await replaceDrills(row.id, row.accountId, next);
    added += next.length;
    processed += 1;
  }

  // Final batch: purge anything that still slipped through (e.g. drills left
  // by an older build or a concurrent analysis worker).
  let purged = 0;
  if (rows.length < limit) {
    const all = await db.select({ id: drills.id, fen: drills.fen }).from(drills);
    const bad: string[] = [];
    for (const row of all) {
      let legal = 0;
      try { legal = new Chess(row.fen).moves().length; } catch { legal = 0; }
      const material = materialFromFen(row.fen);
      const sign = row.fen.split(" ")[1] === "w" ? 1 : -1;
      const gap = (material.white - material.black) * sign;
      const thin = material.pawns + material.nonPawnCount < 4;
      if (legal < 5 || gap <= -5 || thin) bad.push(row.id);
    }
    for (let i = 0; i < bad.length; i += 100) {
      await db.delete(drills).where(inArray(drills.id, bad.slice(i, i + 100)));
    }
    purged = bad.length;
  }

  const [{ value: total }] = await db.select({ value: sql<number>`cast(count(*) as int)` }).from(drills);
  return Response.json({
    ok: true,
    processed,
    added,
    offset,
    nextOffset: rows.length === limit ? offset + limit : null,
    totalDrills: Number(total ?? 0),
    purged,
  });
}
