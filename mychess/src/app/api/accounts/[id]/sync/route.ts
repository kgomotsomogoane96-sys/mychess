import { ensureDatabase } from "@/lib/bootstrap";
import { dbUnavailable } from "@/lib/db-status";
import { getAccount, syncAccount } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const active = globalThis as typeof globalThis & { __mychessSyncing?: Set<string> };
active.__mychessSyncing ??= new Set();

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const unavailable = dbUnavailable(); if (unavailable) return unavailable;
  await ensureDatabase();
  const { id } = await context.params;
  const account = await getAccount(id);
  if (!account) return Response.json({ error: "Account not found" }, { status: 404 });
  if (active.__mychessSyncing!.has(id)) return Response.json({ error: "This account is already syncing." }, { status: 409 });
  const url = new URL(request.url);
  const full = url.searchParams.get("full") === "1";
  const reset = url.searchParams.get("reset") !== "0";
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      active.__mychessSyncing!.add(id);
      const send = (payload: unknown) => { try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)); } catch { /* client left; keep syncing */ } };
      try { await syncAccount(id, send, { full, reset, batchSize: 3 }); }
      catch (error) { send({ type: "error", message: error instanceof Error ? error.message : "Sync failed" }); }
      finally { active.__mychessSyncing!.delete(id); try { controller.close(); } catch { /* already closed */ } }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
