import { ensureDatabase } from "@/lib/bootstrap";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { theoryProgress } from "@/db/schema";
import { WORKSPACE_UID } from "@/lib/constants";
import { dbUnavailable } from "@/lib/db-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const unavailable = dbUnavailable(); if (unavailable) return unavailable;
  await ensureDatabase();
  const rows = await db.select().from(theoryProgress).where(eq(theoryProgress.uid, WORKSPACE_UID)).orderBy(desc(theoryProgress.completedAt));
  return Response.json({ uid: WORKSPACE_UID, progress: rows });
}

export async function POST(request: Request) {
  const unavailable = dbUnavailable(); if (unavailable) return unavailable;
  await ensureDatabase();
  const body = (await request.json()) as { moduleId?: string; correct?: number; attempts?: number; score?: number; notes?: string };
  if (!body.moduleId) return Response.json({ error: "Missing lesson" }, { status: 400 });
  const values = {
    id: `${WORKSPACE_UID}:${body.moduleId}`,
    uid: WORKSPACE_UID,
    moduleId: body.moduleId,
    correct: Math.max(0, Number(body.correct) || 0),
    attempts: Math.max(0, Number(body.attempts) || 0),
    bestScore: Math.max(0, Math.min(100, Number(body.score) || 0)),
    notes: String(body.notes ?? "").slice(0, 2000),
    updatedAt: new Date(),
  };
  await db.insert(theoryProgress).values(values).onConflictDoUpdate({
    target: [theoryProgress.uid, theoryProgress.moduleId],
    set: { correct: values.correct, attempts: values.attempts, bestScore: sql`greatest(${theoryProgress.bestScore}, ${values.bestScore})`, notes: values.notes, updatedAt: new Date() },
  });
  return Response.json({ ok: true, ...values });
}
