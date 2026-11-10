import { ensureDatabase } from "@/lib/bootstrap";
import { dbUnavailable } from "@/lib/db-status";
import { ensureProfile, getAccount, removeAccount, saveProfile } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const unavailable = dbUnavailable(); if (unavailable) return unavailable;
  await ensureDatabase();
  const { id } = await context.params;
  await removeAccount(id);
  return Response.json({ ok: true });
}

export async function PATCH(_: Request, context: { params: Promise<{ id: string }> }) {
  const unavailable = dbUnavailable(); if (unavailable) return unavailable;
  await ensureDatabase();
  const { id } = await context.params;
  const account = await getAccount(id);
  if (!account) return Response.json({ error: "Account not found" }, { status: 404 });
  const person = await ensureProfile();
  await saveProfile({ ...person, activeAccountId: id });
  return Response.json({ ok: true });
}
