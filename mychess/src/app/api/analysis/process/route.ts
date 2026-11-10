import { analyzePgn } from "@/lib/analyze";
import { makeDrills } from "@/lib/learning-drills";
import { dbUnavailable } from "@/lib/db-status";
import { ensureDatabase } from "@/lib/bootstrap";
import { ensureProfile, markGameStatus, nextQueued, queueCounts, replaceDrills, saveAnalysis } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Serverless-safe analysis loop. Vercel has no persistent background worker, so
 * the browser calls this in a loop; each call analyzes queued games until its
 * time budget is nearly used, then reports progress so the client continues.
 */
export async function POST(request: Request) {
  const unavailable = dbUnavailable(); if (unavailable) return unavailable;
  await ensureDatabase();
  const body = (await request.json().catch(() => ({}))) as { limit?: number; budgetMs?: number };
  const limit = Math.max(1, Math.min(60, Number(body.limit) || 8));
  const budgetMs = Math.max(5_000, Math.min(45_000, Number(body.budgetMs) || 38_000));
  const profile = await ensureProfile();
  const started = Date.now();
  let processed = 0, failed = 0, current = "";
  try {
    while (processed + failed < limit && Date.now() - started < budgetMs) {
      const game = await nextQueued();
      if (!game) break;
      current = `${game.whiteName} vs ${game.blackName}`;
      await markGameStatus(game.id, "analyzing");
      try {
        const analysis = await analyzePgn({
          pgn: game.pgn,
          depth: profile.bulkDepth,
          profile,
          youColor: game.youColor,
          opponent: game.youColor === "white" ? game.blackName : game.whiteName,
        });
        await saveAnalysis(game.id, analysis);
        await replaceDrills(game.id, game.accountId, makeDrills(analysis.moves, game.youColor, profile.focus));
        processed += 1;
      } catch (error) {
        failed += 1;
        await markGameStatus(game.id, "failed", error instanceof Error ? error.message : "Analysis failed");
      }
    }
    const counts = await queueCounts(null);
    return Response.json({ ok: true, processed, failed, queued: counts.queued, analyzed: counts.analyzed, current, elapsedMs: Date.now() - started });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Analysis run failed" }, { status: 500 });
  }
}
