"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [setup, setSetup] = useState<{ databaseConfigured: boolean; vercel: boolean; supportedEnvNames?: string[] } | null>(null);
  useEffect(() => { fetch("/api/setup").then(response => response.json()).then(setSetup).catch(() => undefined); }, []);
  const missingDatabase = setup?.databaseConfigured === false;
  return <div className="setup-screen"><div className="setup-card">
    <div className="setup-mark"><Icon name="info" size={26}/></div>
    <p className="eyebrow"><span className="status-dot"/>MYCHESS COULDN'T LOAD THIS PAGE</p>
    <h1>{missingDatabase ? "Database setup is still needed." : "Something went wrong."}</h1>
    <p className="lede">{missingDatabase ? "The deployment is reachable, but no supported PostgreSQL URL is set, or the schema hasn't been applied." : "The app hit an unexpected server error. Retry, or check the deployment's function logs."}</p>
    {missingDatabase ? <ol className="setup-steps">
      <li><strong>Set a database URL</strong><span>Use <span className="mono">DATABASE_URL</span> or a Vercel integration's <span className="mono">POSTGRES_URL</span> / <span className="mono">NEON_DATABASE_URL</span>. Apply it to Production and redeploy.</span></li>
      <li><strong>Open the app again</strong><span>After redeploying, the schema and bundled library restore automatically on first load.</span></li>
      <li><strong>Check the endpoints</strong><span><a className="lime" href="/api/setup">/api/setup</a> reports config, <a className="lime" href="/api/health">/api/health</a> tests the connection.</span></li>
    </ol> : <p className="help">Error digest: <span className="mono">{error.digest ?? "unavailable"}</span></p>}
    <button className="button primary" onClick={reset}>Try again <Icon name="refresh" size={14}/></button>
    <div className="setup-note">No Firebase or Google sign-in is used by this deployment.</div>
  </div></div>;
}
