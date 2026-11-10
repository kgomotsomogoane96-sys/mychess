import { readFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { Pool, type PoolClient } from "pg";
import { DIRECT_DATABASE_ENV_NAMES, databaseUrl, directDatabaseSource, urlUsesSsl } from "@/lib/database-url";
import { EXTRA_SQL, SCHEMA_SQL } from "@/lib/schema-sql";

let schemaPromise: Promise<void> | null = null;
let seedBufferPromise: Promise<Buffer> | null = null;
let directPool: Pool | null = null;

/**
 * DDL and bulk inserts must not go through PgBouncer transaction pooling.
 * Neon's Vercel integration exposes DATABASE_URL_UNPOOLED for exactly this.
 */
function getDirectPool() {
  const source = directDatabaseSource();
  if (!source) throw new Error(`No PostgreSQL URL found. Set one of ${DIRECT_DATABASE_ENV_NAMES.join(", ")} or DATABASE_URL.`);
  if (!directPool) {
    directPool = new Pool({
      connectionString: source.url,
      ssl: urlUsesSsl(source.url) ? { rejectUnauthorized: false } : undefined,
      max: 2,
      keepAlive: true,
      connectionTimeoutMillis: 15000,
    });
    // Same auto-suspend protection as the main pool: without an 'error'
    // listener, a dropped idle connection crashes the function.
    directPool.on("error", () => undefined);
  }
  return directPool;
}

/** Retries a statement while a suspended pooler wakes up. */
async function runStatement(pool: Pool, statement: string): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await pool.query(statement);
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      const retryable = code === "57P01" || code === "57P03" || code === "08000" || code === "08003" || code === "08006" || code === "58000" || /timeout|terminated|EOF|ECONNRESET|ETIMEDOUT|ENETUNREACH/i.test(String((error as Error)?.message ?? ""));
      if (!retryable || attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

/** Creates every table/index if missing. Safe to call concurrently. */
export function ensureDatabase() {
  if (!databaseUrl()) throw new Error("No PostgreSQL URL is configured.");
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const pool = getDirectPool();
      // One cheap existence probe. Every page calls this; running 20+ DDL
      // statements on each serverless cold start was a major source of the
      // 2–5s first-load delay. Warm deployments now pay a single SELECT.
      const probe = await runStatement(pool, `SELECT
        to_regclass('public.games') IS NOT NULL AS games,
        to_regclass('public.reference_games') IS NOT NULL AS reference_games,
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profile' AND column_name='piece_set') AS piece_set`);
      const row = (probe as unknown as { rows?: { games?: boolean; reference_games?: boolean; piece_set?: boolean }[] })?.rows?.[0];
      if (row?.games && row?.reference_games && row?.piece_set) return;

      // Cold/empty database: send all idempotent DDL in ONE round trip using
      // PostgreSQL's simple multi-statement query protocol.
      const statements = [
        ...SCHEMA_SQL.split("--> statement-breakpoint").map(chunk => chunk.trim()).filter(Boolean),
        ...EXTRA_SQL.split(";").map(chunk => chunk.trim()).filter(Boolean),
      ].map(statement => statement.endsWith(";") ? statement : `${statement};`);
      await runStatement(pool, statements.join("\n"));
    })().catch(error => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

function loadSeedBuffer(origin: string) {
  if (!seedBufferPromise) {
    seedBufferPromise = (async () => {
      try {
        return await readFile(path.join(process.cwd(), "public", "mc-seed.sql.gz"));
      } catch {
        const base = origin || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://127.0.0.1:${process.env.PORT ?? 3000}`);
        const response = await fetch(`${base}/mc-seed.sql.gz`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Bundled snapshot unavailable (${response.status}).`);
        return Buffer.from(await response.arrayBuffer());
      }
    })().catch(error => { seedBufferPromise = null; throw error; });
  }
  return seedBufferPromise;
}

async function connectWithRetry(): Promise<PoolClient> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await getDirectPool().connect();
    } catch (error) {
      const message = String((error as Error)?.message ?? "");
      const retryable = /timeout|terminated|EOF|ECONNRESET|ETIMEDOUT|ENETUNREACH|57P|080/i.test(message);
      if (!retryable || attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw new Error("Could not connect to the database after 3 attempts.");
}

export type SeedResult = { seeded: boolean; games: number; reason?: string };

/** Restores the bundled 11,897-game library into an empty database. */
export async function seedDatabase(options: { force?: boolean; origin?: string } = {}): Promise<SeedResult> {
  await ensureDatabase();
  const client = await connectWithRetry();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(918273645)");
    const before = await client.query<{ count: number }>("SELECT count(*)::int AS count FROM games");
    const existing = Number(before.rows[0]?.count ?? 0);
    if (!options.force && existing > 0) {
      await client.query("COMMIT");
      return { seeded: false, games: existing, reason: "database already populated" };
    }
    if (options.force) await client.query("TRUNCATE TABLE drills, games, reference_games, theory_progress, accounts, profile RESTART IDENTITY CASCADE");
    const buffer = await loadSeedBuffer(options.origin ?? "");
    let seedSql = gunzipSync(buffer).toString("utf8");
    seedSql = seedSql
      .replace(/^\\(restrict|unrestrict).*$/gm, "")
      .replace(/^SET /gm, "SET LOCAL ")
      .replace(/^SELECT pg_catalog\.set_config\('search_path', '', false\);$/gm, "SET LOCAL search_path TO public;")
      + "\nSET LOCAL search_path TO public;\n";
    await client.query(seedSql);
    await client.query("COMMIT");
    await client.query("RESET ALL; SET search_path TO public;").catch(() => undefined);
    const after = await client.query<{ count: number }>("SELECT count(*)::int AS count FROM games");
    return { seeded: true, games: Number(after.rows[0]?.count ?? 0) };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
