import { DATABASE_ENV_NAMES, databaseUrl } from "@/lib/database-url";

/** Friendly 503 instead of an opaque crash when no supported DB URL exists. */
export function dbUnavailable() {
  if (databaseUrl()) return null;
  return Response.json({
    error: `No database URL found. Set one of ${DATABASE_ENV_NAMES.join(", ")} in Vercel → Environment Variables, redeploy, then run \`npx drizzle-kit push\`.`,
  }, { status: 503 });
}
