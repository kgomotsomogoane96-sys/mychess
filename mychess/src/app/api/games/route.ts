import { ensureDatabase } from "@/lib/bootstrap";
import { dbUnavailable } from "@/lib/db-status";
import { ensureProfile, insertParsedGame, listGamesPage } from "@/lib/store";
import { splitPgn } from "@/lib/pgn";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unavailable = dbUnavailable(); if (unavailable) return unavailable;
  await ensureDatabase();
  const url = new URL(request.url);
  const person = await ensureProfile();
  const page = await listGamesPage({ accountIds: person.activeAccountId ? [person.activeAccountId] : null, q: url.searchParams.get("q") ?? undefined, color: url.searchParams.get("color") ?? undefined, result: url.searchParams.get("result") ?? undefined, speed: url.searchParams.get("speed") ?? undefined, status: url.searchParams.get("status") ?? undefined, opening: url.searchParams.get("opening") ?? undefined, page: Number(url.searchParams.get("page") || 1), pageSize: Math.min(60, Number(url.searchParams.get("pageSize") || 24)), sort: url.searchParams.get("sort") ?? undefined });
  return Response.json(page);
}

export async function POST(request: Request) {
  const unavailable = dbUnavailable(); if (unavailable) return unavailable;
  await ensureDatabase();
  const body = (await request.json()) as { pgn?: string; source?: string; youColor?: "white" | "black" | null };
  const raw = String(body.pgn ?? "");
  if (raw.length > 2_000_000) return Response.json({ error: "That file is too large. Please keep PGN imports under 2 MB." }, { status: 413 });
  const chunks = splitPgn(raw);
  if (!chunks.length) return Response.json({ error: "Paste a PGN or a FEN first." }, { status: 400 });
  if (chunks.length > 200) return Response.json({ error: "That file has more than 200 games. Split it and try again." }, { status: 400 });
  await ensureProfile();
  const saved = []; const errors = [];
  for (const chunk of chunks) {
    const result = await insertParsedGame(chunk, { source: body.source || "pgn", youColor: body.youColor });
    if ("error" in result) errors.push(result.error); else saved.push(result);
  }
  if (!saved.length) return Response.json({ error: errors[0] || "No games could be read." }, { status: 400 });
  return Response.json({ saved, errors });
}
