import { ensureDatabase } from "@/lib/bootstrap";
import { dbUnavailable } from "@/lib/db-status";
import { clearQueue, ensureProfile, queueGames, recentlyAnalyzed } from "@/lib/store";
import { pauseWorker, startWorker, workerStatus } from "@/lib/worker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const unavailable = dbUnavailable(); if (unavailable) return unavailable;
  await ensureDatabase();
  const person = await ensureProfile();
  const scope = person.activeAccountId ? [person.activeAccountId] : null;
  const [status, recent] = await Promise.all([workerStatus(scope), recentlyAnalyzed(scope, 8)]);
  return Response.json({ status, recent });
}

export async function POST(request: Request) {
  const unavailable = dbUnavailable(); if (unavailable) return unavailable;
  await ensureDatabase();
  const body = (await request.json()) as { action?: string; scope?: "recent" | "losses" | "rapid" | "unanalyzed" | "ids"; limit?: number; ids?: string[] };
  const person = await ensureProfile();
  const accountIds = person.activeAccountId ? [person.activeAccountId] : null;
  if (body.action === "pause") { pauseWorker(); return Response.json({ ok: true }); }
  if (body.action === "resume") { startWorker(); return Response.json({ ok: true }); }
  if (body.action === "clear") { pauseWorker(); await clearQueue(); return Response.json({ ok: true }); }
  if (body.action === "queue") {
    const queued = await queueGames({ accountIds, scope: body.scope ?? "recent", limit: Math.max(1, Math.min(Number(body.limit) || 25, 5000)), ids: body.ids });
    startWorker();
    return Response.json({ ok: true, queued });
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
}
