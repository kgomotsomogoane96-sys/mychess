/**
 * Sets MYCHESS database variables on Vercel and optionally redeploys.
 * Reads secrets from process.env only — nothing is hardcoded or printed.
 *
 * Required: VERCEL_TOKEN
 * Optional: VERCEL_PROJECT_ID_OR_NAME (default mychess-gold), VERCEL_TEAM_ID,
 *           VERCEL_DEPLOY_HOOK_URL, CRON_SECRET
 * Uses DATABASE_URL / DATABASE_URL_UNPOOLED from the current environment.
 */

const token = process.env.VERCEL_TOKEN;
const project = process.env.VERCEL_PROJECT_ID_OR_NAME || "mychess-gold";
const teamId = process.env.VERCEL_TEAM_ID;
const deployHook = process.env.VERCEL_DEPLOY_HOOK_URL;

if (!token) {
  console.error("VERCEL_TOKEN is required. Add it as a sandbox secret, then rerun this script.");
  process.exit(1);
}

const vars = [
  ["DATABASE_URL", process.env.DATABASE_URL],
  ["DATABASE_URL_UNPOOLED", process.env.DATABASE_URL_UNPOOLED],
  ["CRON_SECRET", process.env.CRON_SECRET],
].filter(([, value]) => Boolean(value));

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required in the environment.");
  process.exit(1);
}

async function setVar(key, value) {
  const url = new URL(`https://api.vercel.com/v10/projects/${encodeURIComponent(project)}/env`);
  url.searchParams.set("upsert", "true");
  if (teamId) url.searchParams.set("teamId", teamId);
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ key, value, type: "sensitive", target: ["production"], comment: "MYCHESS Neon database" }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${key}: Vercel returned ${response.status} ${text.slice(0, 180)}`);
  }
  console.log(`${key}: set for Production`);
}

for (const [key, value] of vars) {
  try { await setVar(key, value); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}

if (process.exitCode) process.exit(process.exitCode);

if (deployHook) {
  const response = await fetch(deployHook, { method: "POST" });
  if (!response.ok) {
    console.error(`Deploy hook returned ${response.status}. Redeploy manually in Vercel.`);
    process.exitCode = 1;
  } else console.log("Production redeploy triggered.");
} else {
  console.log("Variables saved. Redeploy the latest Production deployment in Vercel, or set VERCEL_DEPLOY_HOOK_URL to automate that step.");
}

console.log("Then verify /api/setup and /api/health on the deployment.");
