import { ensureDatabase } from "@/lib/bootstrap";
import { dbUnavailable } from "@/lib/db-status";
import { deleteGame, getGame, updateGameFields } from "@/lib/store";
import type { ColorName } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const unavailable = dbUnavailable(); if (unavailable) return unavailable;
  await ensureDatabase();
  const { id } = await context.params;
  const game = await getGame(id);
  if (!game) return Response.json({ error: "Game not found" }, { status: 404 });
  return Response.json(game);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const unavailable = dbUnavailable(); if (unavailable) return unavailable;
  await ensureDatabase();
  const { id } = await context.params;
  const game = await getGame(id);
  if (!game) return Response.json({ error: "Game not found" }, { status: 404 });
  const body = (await request.json()) as { notes?: string; youColor?: ColorName | null | "" };
  const patch: { notes?: string; youColor?: ColorName | null } = {};
  if (typeof body.notes === "string") patch.notes = body.notes.slice(0, 4000);
  if (body.youColor === "white" || body.youColor === "black" || body.youColor === null || body.youColor === "") {
    patch.youColor = body.youColor || null;
  }
  await updateGameFields(id, patch);
  return Response.json(await getGame(id));
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const unavailable = dbUnavailable(); if (unavailable) return unavailable;
  await ensureDatabase();
  const { id } = await context.params;
  await deleteGame(id);
  return Response.json({ ok: true });
}
