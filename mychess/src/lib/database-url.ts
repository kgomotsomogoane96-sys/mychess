/** Pooled/direct URL resolution for managed Postgres providers. */
export const APP_DATABASE_ENV_NAMES = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "NEON_DATABASE_URL",
  "SUPABASE_DB_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
] as const;

export const DIRECT_DATABASE_ENV_NAMES = [
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "NEON_DATABASE_URL_UNPOOLED",
  "DATABASE_DIRECT_URL",
  "DIRECT_URL",
] as const;

export const DATABASE_ENV_NAMES: readonly string[] = [...APP_DATABASE_ENV_NAMES, ...DIRECT_DATABASE_ENV_NAMES];

export type DatabaseSource = { name: string; url: string };

function first(names: readonly string[]): DatabaseSource | null {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return { name, url: value };
  }
  return null;
}

/** Preferred connection for application queries: pooled when available. */
export function databaseSource(): DatabaseSource | null {
  return first(APP_DATABASE_ENV_NAMES);
}

/** Preferred connection for DDL and bulk restore: direct/unpooled. */
export function directDatabaseSource(): DatabaseSource | null {
  return first(DIRECT_DATABASE_ENV_NAMES) ?? databaseSource();
}

export function databaseUrl() { return databaseSource()?.url ?? null; }
export function directDatabaseUrl() { return directDatabaseSource()?.url ?? null; }

export function urlUsesSsl(url: string) {
  return /sslmode=require|neon\.tech|supabase|vercel|postgres\.vercel|ssl=true/i.test(url);
}

export function databaseUsesSsl() {
  const url = databaseUrl();
  return Boolean(url && urlUsesSsl(url));
}

export function databaseLooksLocal() {
  const url = databaseUrl();
  return Boolean(url && /localhost|127\.0\.0\.1|@postgres\b|@db\b/i.test(url));
}
