import { sql } from "drizzle-orm";
import { db } from "@/db";
import { DATABASE_ENV_NAMES, databaseUrl } from "@/lib/database-url";
import { ensureDatabase } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!databaseUrl()) {
    return Response.json({ ok: false, error: `No database URL found. Expected one of ${DATABASE_ENV_NAMES.join(", ")}.` }, { status: 503 });
  }
  await ensureDatabase();
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Database unavailable" }, { status: 503 });
  }
}
