import { DATABASE_ENV_NAMES, DIRECT_DATABASE_ENV_NAMES, databaseLooksLocal, databaseSource, databaseUsesSsl, directDatabaseSource } from "@/lib/database-url";

export const dynamic = "force-dynamic";

/** Public diagnostic endpoint. Never returns connection strings or secrets. */
export async function GET() {
  const source = databaseSource();
  const direct = directDatabaseSource();
  return Response.json({
    storage: "PostgreSQL via Drizzle ORM",
    authentication: "None — protect the deployment at the platform level",
    databaseConfigured: Boolean(source),
    databaseEnv: source?.name ?? null,
    supportedEnvNames: DATABASE_ENV_NAMES,
    directDatabaseEnv: direct?.name ?? null,
    directEnvNames: DIRECT_DATABASE_ENV_NAMES,
    databaseLooksLocal: databaseLooksLocal(),
    databaseSsl: databaseUsesSsl(),
    autoBootstrap: true,
    bootstrapEndpoint: "POST /api/setup/bootstrap",
    seedAsset: "/mc-seed.sql.gz",
    bundledGames: 11897,
    bundledReferenceGames: 8494,
    cronSecretConfigured: Boolean(process.env.CRON_SECRET),
    vercel: Boolean(process.env.VERCEL),
    schemaCommand: "npx drizzle-kit push",
  });
}
