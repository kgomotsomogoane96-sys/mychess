import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { referenceGames } from "@/db/schema";
import { dbUnavailable } from "@/lib/db-status";
import { ensureDatabase } from "@/lib/bootstrap";
import { HALL_OF_FAME, eraFromDate, tierFromGame } from "@/lib/hall-of-fame";
import { parseReference } from "@/lib/reference";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Idempotent: inserts the curated classics and backfills era/tier tags. */
export async function POST() {
  const unavailable = dbUnavailable(); if (unavailable) return unavailable;
  await ensureDatabase();
  try {
    let inserted = 0;
    for (const game of HALL_OF_FAME) {
      const existing = await db.select({ id: referenceGames.id }).from(referenceGames).where(eq(referenceGames.id, game.id)).limit(1);
      if (existing.length) continue;
      const parsed = parseReference(game.pgn, { source: "hall", url: null, tags: [...game.tags, game.event] });
      await db.insert(referenceGames).values({
        id: game.id,
        externalUrl: null,
        source: "hall",
        whiteName: game.whiteName,
        blackName: game.blackName,
        whiteElo: game.whiteElo,
        blackElo: game.blackElo,
        result: game.result,
        opening: parsed.opening,
        openingFamily: parsed.openingFamily,
        eco: parsed.eco,
        event: game.event,
        speed: "classical",
        playedAt: new Date(game.date),
        pgn: parsed.pgn,
        initialFen: parsed.initialFen,
        midgameFen: parsed.midgameFen,
        midgamePly: parsed.midgamePly,
        plyCount: parsed.plyCount,
        tags: [...parsed.tags, ...game.tags],
        era: eraFromDate(game.date),
        tier: tierFromGame({ whiteElo: game.whiteElo, blackElo: game.blackElo, tags: game.tags }),
      });
      inserted += 1;
    }
    await db.execute(sql`UPDATE reference_games SET era = CASE
      WHEN played_at IS NULL THEN 'unknown'
      WHEN EXTRACT(YEAR FROM played_at) < 1900 THEN '1800s'
      WHEN EXTRACT(YEAR FROM played_at) < 2000 THEN '1900s'
      WHEN EXTRACT(YEAR FROM played_at) < 2010 THEN '2000s'
      WHEN EXTRACT(YEAR FROM played_at) < 2020 THEN '2010s'
      ELSE '2020s' END
      WHERE era IS NULL OR era = ''`);
    await db.execute(sql`UPDATE reference_games SET tier = CASE
      WHEN tags::text LIKE '%immortal%' OR tags::text LIKE '%legendary%' THEN 'legendary'
      WHEN tags::text LIKE '%masterpiece%' THEN 'masterpiece'
      WHEN GREATEST(COALESCE(white_elo,0), COALESCE(black_elo,0)) >= 2450 THEN 'elite'
      ELSE 'club' END
      WHERE tier IS NULL OR tier = ''`);
    const [total, legendary, masterpiece, elite] = await Promise.all([
      db.select({ value: sql<number>`cast(count(*) as int)` }).from(referenceGames),
      db.select({ value: sql<number>`cast(count(*) as int)` }).from(referenceGames).where(eq(referenceGames.tier, "legendary")),
      db.select({ value: sql<number>`cast(count(*) as int)` }).from(referenceGames).where(eq(referenceGames.tier, "masterpiece")),
      db.select({ value: sql<number>`cast(count(*) as int)` }).from(referenceGames).where(eq(referenceGames.tier, "elite")),
    ]);
    return Response.json({ ok: true, inserted, total: total[0]?.value ?? 0, legendary: legendary[0]?.value ?? 0, masterpiece: masterpiece[0]?.value ?? 0, elite: elite[0]?.value ?? 0 });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Seed failed" }, { status: 500 });
  }
}
