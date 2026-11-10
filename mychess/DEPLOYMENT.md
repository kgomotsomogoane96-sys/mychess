# MYCHESS — Vercel deployment

For a Neon-specific walkthrough, see **[NEON_SETUP.md](./NEON_SETUP.md)**.

## Current live diagnosis

`https://mychess-gold.vercel.app/` returns **200** with the setup screen.
`/api/setup` reports `databaseConfigured: false`; `/api/health` returns 503.
The app is deployed and running — Vercel simply has no PostgreSQL connection
string exposed to Production. Firebase is not involved.

## What the app does automatically

- Resolves the first non-empty pooled URL among `DATABASE_URL`, `POSTGRES_URL`,
  `POSTGRES_PRISMA_URL`, `NEON_DATABASE_URL`, `SUPABASE_DB_URL`, and direct
  fallbacks.
- Resolves a direct/unpooled URL among `DATABASE_URL_UNPOOLED`,
  `POSTGRES_URL_NON_POOLING`, `NEON_DATABASE_URL_UNPOOLED`,
  `DATABASE_DIRECT_URL`, `DIRECT_URL`.
- Creates every table/index on first query via `ensureDatabase()`.
- Uses the **direct** connection for DDL and `public/mc-seed.sql.gz` restore;
  uses the **pooled** connection for normal app queries.
- Restores 11,897 games, 8,494 elite games, 3,926 drills, accounts, profile,
  and theory progress into an empty database in ~3 seconds.
- Calls `POST /api/setup/bootstrap` once after hydration and refreshes.
- Provides Settings → **Restore bundled library** for a forced restore.
- Shows a 200 setup screen if no database URL exists; private APIs return a
  clear 503 instead of an opaque crash.

## Minimal deploy steps

1. Create a managed Postgres database (Neon, Supabase, Vercel Postgres).
2. Set `DATABASE_URL` to the **pooled** string for **Production**.
3. Set `DATABASE_URL_UNPOOLED` (or `POSTGRES_URL_NON_POOLING`) to the **direct**
   string. Neon's Vercel integration does both automatically.
4. Optional: `CRON_SECRET` for serverless analysis.
5. Redeploy. Vercel env changes don't affect an existing deployment.
6. Open `/` once; schema and data restore automatically. No `drizzle-kit push`
   and no account re-import needed.
7. Verify `/api/setup` → `databaseConfigured: true` and `/api/health` → `{"ok":true}`.

Local sandbox data does not transfer by magic; the bundled snapshot is what
restores it. The local `127.0.0.1:5432/app_db` string is not valid on Vercel.

## Security

There is no app login. Anyone with the URL can read and change the workspace,
and the seed is a public static asset. Use Vercel Deployment Protection, a
platform password, or an IP allowlist.

## Serverless engine work

`instrumentation.ts` does not start the persistent worker on Vercel. Archive
imports are resumable under the 60-second limit. Schedule:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR-DOMAIN/api/cron/analysis
```

## Validation

```bash
npx next typegen
npm exec tsc -- --noEmit --pretty false
npm run build
```

A build with no `.env` succeeds; the database URL is only needed at request time.
