# Neon setup for MYCHESS on Vercel

> **Security first:** a database password was pasted into chat. Rotate that role
> password in the Neon Console once the deployment is confirmed working, then
> update the Vercel environment variables with the new strings and redeploy.
> Do not paste secrets into chat or commit them. The values used here live only
> in the gitignored `.env` and are never printed by the app.

> **Already done from this workspace:** the pooled and direct Neon URLs were
> tested, the schema was created through the direct URL, and the bundled
> 11,897-game library was restored. The database is ready. Vercel still needs
> the two environment variables and a redeploy; that is the only remaining step.

## Can I hook it up for you?

Yes — with one of these two routes. If you add `VERCEL_TOKEN` as a sandbox
secret, I can run `scripts/vercel-env.mjs` to set the variables and trigger a
redeploy using a Vercel Deploy Hook. Without a token, use the UI steps below.

### Route A — no secrets to share (recommended)

Use Neon's **Neon-Managed Integration** in Vercel. It injects
`DATABASE_URL` and `DATABASE_URL_UNPOOLED` into the Vercel project for you.
I can't click through the OAuth/install dialog from this sandbox, but you don't
need to give me a password. After you connect it and redeploy, the app creates
its own schema and restores the bundled library automatically.

### Route B — full automation from this sandbox

If you add these as **environment-variable secrets in this workspace** (not in
chat, not in the repo), I can call the Neon and Vercel APIs myself:

| Secret | Where to get it | What I do with it |
|---|---|---|
| `NEON_API_KEY` | Neon Console → Account Settings → API Keys | Create/find a Neon project and fetch pooled + direct connection URIs |
| `NEON_ORG_ID` | Neon account/org settings, optional for personal keys | Select the org for project creation |
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens | Set Vercel project env vars via REST API |
| `VERCEL_PROJECT_ID_OR_NAME` | `mychess-gold` (or its project ID) | Target the correct project |
| `VERCEL_TEAM_ID` | Only if the project is in a team | Add `teamId` to API calls |
| `VERCEL_DEPLOY_HOOK_URL` | Vercel → Settings → Git → Deploy Hooks, optional | Trigger a Production redeploy |
| `CRON_SECRET` | optional; I can generate one | Protect `/api/cron/analysis` |

With those, I can: create a Neon project, set `DATABASE_URL` (pooled) and
`DATABASE_URL_UNPOOLED` (direct) on Vercel with
`POST /v10/projects/{project}/env?upsert=true`, trigger a redeploy, then verify
`/api/setup` and `/api/health`. I still cannot create the Neon account itself or
approve an OAuth connection.

## Route A, step by step (existing Neon account)

1. **Create a Neon account** at <https://neon.tech>.
2. **Create a project** in the Neon Console. Pick a region close to your Vercel
   deployment region; keep the default branch (`main`), database (`neondb`), and
   role. Postgres 17 or 18 is fine.
3. In Neon Console → **Integrations**, click **Add** under **Vercel**, then
   **Install from Vercel Marketplace**.
4. On Vercel, click **Install**. Choose **Link Existing Neon Account** →
   **Continue**.
5. Choose which Vercel account/projects may use the integration.
6. In **Integrate Neon**:
   - Vercel project: `mychess-gold`
   - Neon account/project: the one you created
   - Production branch: `main` (or your chosen production branch)
   - Database: `neondb`, Role: the default role
   - Enable **Automatically delete obsolete Neon branches** (recommended)
   - Optionally enable a `vercel-dev` branch
7. Click **Connect**, then **Done**.
8. In Vercel → `mychess-gold` → Settings → Environment Variables, confirm:
   - `DATABASE_URL` — pooled connection for app queries
   - `DATABASE_URL_UNPOOLED` — direct connection for schema/restore
   - legacy `POSTGRES_*` variables may also appear; the app accepts them too.
   If setup reports "Failed to set environment variables", remove conflicting
   `DATABASE_URL`/`PG*` variables first and retry.
9. **Redeploy Production** (Deployments → latest → Redeploy, or push a commit).
   Environment variables are not applied to an existing deployment.
10. Open `https://mychess-gold.vercel.app/` once. The app will:
    - create the schema through the direct/unpooled URL
    - restore 11,897 games, 8,494 elite games, and practice positions
    - refresh to your dashboard
11. Verify:
    - `/api/setup` → `databaseConfigured: true`, `directDatabaseEnv` set
    - `/api/health` → `{"ok":true}`
    - Settings → **Restore bundled library** is available if you ever need to
      force a fresh restore.

## Route A alternative: Vercel-Managed Integration

If you did **not** already have a Neon account, Vercel Marketplace → Native
Integrations → **Neon Postgres** creates one and bills through Vercel. It also
injects `DATABASE_URL` and `DATABASE_URL_UNPOOLED`. Use the Neon-Managed path
above instead when you already have a Neon account.

## Manual connection (no Marketplace integration)

1. Neon Console → **Connect** on your project.
2. Select branch/role/database, choose the **pooled** connection string, copy it.
   It should contain `-pooler` in the host and `?sslmode=require`.
3. Also copy the **direct / non-pooled** connection string.
4. Vercel → `mychess-gold` → Settings → Environment Variables, add:
   - `DATABASE_URL` = pooled string
   - `DATABASE_URL_UNPOOLED` = direct string
   - `CRON_SECRET` = optional random string
   Select **Production** and save.
5. Redeploy, then open `/` once.

Do **not** use `POSTGRES_URL_NON_POOLING` / `DATABASE_URL_UNPOOLED` as the
normal app connection — serverless functions need pooling. The app only uses
the direct URL for DDL and the one-time bulk restore.

## Why two URLs?

Neon's pooler (PgBouncer) is ideal for many short serverless queries, but DDL
and large multi-statement restores should use the direct endpoint. The app now
keeps those paths separate: `src/db/index.ts` uses the pooled URL;
`src/lib/bootstrap.ts` and `drizzle.config.ts` use the direct URL.

## Security

- Never paste connection strings or API keys into chat or commit them.
- Don't share your Neon/Vercel account passwords.
- The app has no login; enable Vercel Deployment Protection.
- The bundled seed is a public static asset; protect the deployment if you don't
  want the PGN dataset downloadable.
- Restrict the integration's env vars to **Production** if you don't want every
  preview branch to auto-restore the bundled dataset.

Official references:
- <https://neon.com/docs/guides/vercel-overview>
- <https://neon.com/docs/guides/vercel-previews-integration>
- <https://neon.com/docs/guides/vercel-manual>
