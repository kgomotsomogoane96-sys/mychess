import { ensureDatabase } from "@/lib/bootstrap";
import { dbUnavailable } from "@/lib/db-status";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { referenceGames, syncCursors } from "@/db/schema";
import { ELITE_PLAYERS, fetchMonth, parseReference } from "@/lib/reference";
import { listChesscomArchives } from "@/lib/platforms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const active = globalThis as typeof globalThis & { __mychessRefSync?: boolean };
active.__mychessRefSync ??= false;

/** One bounded batch per request; the browser calls again until `complete: true`. */
export async function GET(request: Request) {
  const unavailable = dbUnavailable(); if (unavailable) return unavailable;
  await ensureDatabase();
  if (active.__mychessRefSync) return Response.json({ error: "The reference library is already importing." }, { status: 409 });
  const url = new URL(request.url);
  const full = url.searchParams.get("full") === "1";
  const reset = url.searchParams.get("reset") !== "0";
  const stateId = `reference:${full ? "full" : "refresh"}`;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      active.__mychessRefSync = true;
      const send = (payload: unknown) => { try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)); } catch { /* client left */ } };
      let imported = 0, scanned = 0;
      try {
        if (reset) await db.delete(syncCursors).where(eq(syncCursors.id, stateId));
        const saved = (await db.select().from(syncCursors).where(eq(syncCursors.id, stateId)).limit(1))[0];
        const players = full ? ELITE_PLAYERS : ELITE_PLAYERS.slice(0, 8);
        let cursor = Math.min(saved?.cursor ?? 0, players.length);
        let complete = cursor >= players.length;
        const existing = new Set((await db.select({ url: referenceGames.externalUrl }).from(referenceGames)).map(row => row.url));
        if (!complete) {
          const player = players[cursor];
          send({ type: "start", message: `Reading ${player.name}'s public games (${cursor + 1} of ${players.length})…`, cursor });
          try {
            const archives = (await listChesscomArchives(player.username)).slice(0, full ? 3 : 2);
            for (const archive of archives) {
              const games = await fetchMonth(archive);
              const rows = [];
              for (const game of games) {
                scanned += 1;
                const link = typeof game.url === "string" ? game.url : null;
                if (link && existing.has(link)) continue;
                try {
                  rows.push({ id: crypto.randomUUID(), ...parseReference(String(game.pgn), { source: "chesscom", url: link, tags: [player.name, "elite", String(game.time_class ?? "standard")] }) });
                  if (link) existing.add(link);
                } catch { /* unreadable PGN */ }
              }
              for (let i = 0; i < rows.length; i += 100) await db.insert(referenceGames).values(rows.slice(i, i + 100)).onConflictDoNothing();
              imported += rows.length;
            }
          } catch (error) { send({ type: "warning", message: `${player.name}: ${error instanceof Error ? error.message : "skipped"}` }); }
          cursor += 1;
          complete = cursor >= players.length;
          send({ type: "player", message: `${imported} new games from that player.${complete ? "" : " Continuing…"}`, imported, scanned, cursor, complete });
        }
        await db.insert(syncCursors).values({ id: stateId, scope: full ? "full" : "refresh", cursor, untouched: 0, complete, updatedAt: new Date() })
          .onConflictDoUpdate({ target: syncCursors.id, set: { cursor, complete, updatedAt: new Date() } });
        const total = await db.select({ value: sql<number>`count(*)::int` }).from(referenceGames);
        send({ type: "done", message: complete ? `Reference library up to date: ${total[0]?.value ?? 0} games.` : `${imported} new games in this batch. Continuing…`, imported, scanned, complete, cursor, total: total[0]?.value ?? 0 });
      } catch (error) {
        send({ type: "error", message: error instanceof Error ? error.message : "Import failed" });
      } finally {
        active.__mychessRefSync = false;
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
