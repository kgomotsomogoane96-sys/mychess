import { ensureDatabase } from "@/lib/bootstrap";
import { dbUnavailable } from "@/lib/db-status";
import { analyzePgn } from "@/lib/analyze";
import { makeDrills } from "@/lib/learning-drills";
import { ensureProfile, markGameStatus, nextQueued, queueCounts, replaceDrills, saveAnalysis } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Vercel has no persistent Node process, so the in-memory background worker
 * cannot run there. Call this endpoint from an external scheduler. Each call
 * processes queued games for up to ~45 seconds and leaves the rest for next time.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (secret && header !== `Bearer ${secret}`) return Response.json({ error: "Invalid cron secret." }, { status: 401 });
  if (!secret) return Response.json({ error: "Set CRON_SECRET to enable the Vercel analysis endpoint." }, { status: 503 });
  const unavailable = dbUnavailable(); if (unavailable) return unavailable;
  await ensureDatabase();

  const started = Date.now();
  let processed = 0, failed = 0;
  const profile = await ensureProfile();
  while (Date.now() - started < 45000) {
    const game = await nextQueued();
    if (!game) break;
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
      await markGameStatus(game.id, "failed", error instanceof Error ? error.message : "Analysis failed");
      failed += 1;
    }
  }
  const counts = await queueCounts(null);
  return Response.json({ processed, failed, queued: counts.queued, analyzed: counts.analyzed, elapsedSeconds: Math.round((Date.now() - started) / 1000) });
}
