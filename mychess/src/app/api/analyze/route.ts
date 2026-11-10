import { ensureDatabase } from "@/lib/bootstrap";
import { dbUnavailable } from "@/lib/db-status";
import { analyzePgn } from "@/lib/analyze";
import { makeDrills } from "@/lib/learning-drills";
import { engineBusy } from "@/lib/uci";
import { manualPriority } from "@/lib/worker";
import { ensureProfile, getGame, markGameStatus, replaceDrills, saveAnalysis } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const unavailable = dbUnavailable(); if (unavailable) return unavailable;
  await ensureDatabase();
  const url = new URL(request.url);
  const gameId = url.searchParams.get("gameId");
  if (!gameId) return Response.json({ error: "Missing game" }, { status: 400 });
  const game = await getGame(gameId);
  if (!game) return Response.json({ error: "Game not found" }, { status: 404 });
  const profile = await ensureProfile();
  const depth = Math.max(8, Math.min(14, Number(url.searchParams.get("depth")) || profile.depth));
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => { try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)); } catch { /* client disconnected */ } };
      manualPriority(1);
      try {
        if (engineBusy()) send({ type: "waiting", message: "Stockfish is finishing a background game. Your review starts next." });
        send({ type: "start", total: game.plyCount + 1, depth });
        if (game.status === "queued") await markGameStatus(game.id, "imported");
        const analysis = await analyzePgn({ pgn: game.pgn, depth, profile, youColor: game.youColor, opponent: game.youColor === "white" ? game.blackName : game.whiteName, signal: request.signal, onProgress: send });
        await saveAnalysis(game.id, analysis);
        await replaceDrills(game.id, game.accountId, makeDrills(analysis.moves, game.youColor, profile.focus));
        send({ type: "done", accuracyWhite: analysis.accuracyWhite, accuracyBlack: analysis.accuracyBlack, headline: analysis.summary.headline });
      } catch (error) {
        send({ type: "error", message: error instanceof Error ? error.message : "Analysis couldn't finish. Please try again." });
      } finally {
        manualPriority(-1);
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
