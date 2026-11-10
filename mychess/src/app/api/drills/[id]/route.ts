import { ensureDatabase } from "@/lib/bootstrap";
import { dbUnavailable } from "@/lib/db-status";
import { recordDrill } from "@/lib/store";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const unavailable = dbUnavailable(); if (unavailable) return unavailable;
  await ensureDatabase();
  const { id } = await context.params;
  const body = (await request.json()) as { outcome?: "solved" | "revealed" | "missed" };
  if (!body.outcome || !["solved", "revealed", "missed"].includes(body.outcome)) return Response.json({ error: "Unknown practice outcome" }, { status: 400 });
  const drill = await recordDrill(id, body.outcome);
  if (!drill) return Response.json({ error: "Practice position not found" }, { status: 404 });
  return Response.json({ ok: true, attempts: drill.attempts, solved: drill.solved });
}
