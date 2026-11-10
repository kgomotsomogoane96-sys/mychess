import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool as PgPool } from "pg";
import { Pool } from "pg";
import { DATABASE_ENV_NAMES, databaseLooksLocal, databaseUrl, databaseUsesSsl } from "@/lib/database-url";
import * as schema from "./schema";

type Database = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as typeof globalThis & {
  __mychessPool?: PgPool;
  __mychessDb?: Database;
};

/**
 * Wakes a suspended pooler before the first real query. Resolves even on
 * failure so that later queries fall through to pg's own connection retry.
 */
function warmupPool(pool: PgPool) {
  return (async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        await pool.query("SELECT 1");
        return;
      } catch {
        if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
  })();
}

function database(): Database {
  if (globalForDb.__mychessDb) return globalForDb.__mychessDb;

  const url = databaseUrl();
  if (!url) {
    throw new Error(`No database URL found. Set one of ${DATABASE_ENV_NAMES.join(", ")} in your deployment environment, then run \`npx drizzle-kit push\`.`);
  }
  if (databaseLooksLocal() && process.env.VERCEL) {
    throw new Error("The database URL points to localhost. Vercel needs a managed PostgreSQL host, not the sandbox database.");
  }

  const rawPool = new Pool({
    connectionString: url,
    ssl: databaseUsesSsl() ? { rejectUnauthorized: false } : undefined,
    max: 6,
    keepAlive: true,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 25000,
  });
  // Neon's free pooler auto-suspends after ~5 min idle and drops idle
  // connections on wake. Without an 'error' listener that first drop is an
  // unhandled 'error' event that crashes the whole serverless function —
  // the classic intermittent first-hit 500. pg replaces dead idle clients
  // on the next acquire, so swallowing the event is the standard fix.
  rawPool.on("error", () => undefined);

  // Gate query execution behind the pooler wake-up. Drizzle runs every
  // query through pool.query() and every transaction through pool.connect(),
  // so gating those two methods absorbs cold-start latency without changing
  // the Drizzle query API (which must stay synchronous at build time).
  const ready = warmupPool(rawPool);
  const pool: PgPool = new Proxy(rawPool, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      if ((property === "query" || property === "connect") && typeof value === "function") {
        return (...args: unknown[]) =>
          ready.then(() => (value as (...a: unknown[]) => unknown).apply(target, args));
      }
      return typeof value === "function" ? value.bind(target) : value;
    },
  });

  const instance = drizzle(pool, { schema });
  globalForDb.__mychessPool = rawPool;
  globalForDb.__mychessDb = instance;
  return instance;
}

/**
 * Lazy, build-safe access to the Drizzle client. Pool creation (and the
 * localhost guard) only happens on first query, so `next build` never needs
 * a reachable database.
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, property) {
    const instance = database();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export function getPool(): PgPool {
  database();
  return globalForDb.__mychessPool!;
}
