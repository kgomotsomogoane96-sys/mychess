import { dbUnavailable } from "@/lib/db-status";
import { ensureDatabase, seedDatabase } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Called once automatically after hydration, or manually with action:"force". */
export async function POST(request: Request) {
  const unavailable = dbUnavailable(); if (unavailable) return unavailable;
  try {
    const body = (await request.json().catch(() => ({}))) as { action?: string };
    await ensureDatabase();
    const result = await seedDatabase({ force: body.action === "force", origin: new URL(request.url).origin });
    return Response.json({ ok: true, schemaCreated: true, action: body.action === "force" ? "force" : "auto", ...result });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Database bootstrap failed." }, { status: 500 });
  }
}
