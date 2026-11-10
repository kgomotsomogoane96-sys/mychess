"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, Spinner, useToast } from "@/components/ui";

type Setup = {
  storage: string; authentication: string; databaseConfigured: boolean; databaseEnv: string | null; directDatabaseEnv: string | null;
  databaseLooksLocal: boolean; databaseSsl: boolean; cronSecretConfigured: boolean; vercel: boolean; schemaCommand: string;
  supportedEnvNames: string[];
};

export function DeploymentStatus() {
  const router = useRouter(); const notify = useToast();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildResult, setRebuildResult] = useState("");
  const [restoreMessage, setRestoreMessage] = useState("");
  useEffect(() => { fetch("/api/setup").then(response => response.json()).then(setSetup).catch(() => undefined); }, []);
  async function restore() {
    setRestoring(true); setRestoreMessage("Restoring the bundled library…");
    try {
      const response = await fetch("/api/setup/bootstrap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "force" }) });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "Restore failed.");
      setRestoreMessage(`Restored ${Number(json.games).toLocaleString()} games.`);
      notify("Your chess library has been restored from the bundled snapshot.");
      router.refresh();
    } catch (error) {
      setRestoreMessage("");
      notify(error instanceof Error ? error.message : "Restore failed.", "error");
    } finally { setRestoring(false); }
  }
  async function rebuildDrills() {
    setRebuilding(true); setRebuildResult("Rebuilding in batches…");
    try {
      let offset = 0, processed = 0, total = 0;
      for (let batch = 0; batch < 20; batch += 1) {
        const response = await fetch(`/api/drills/rebuild?offset=${offset}&limit=40`, { method: "POST" });
        const json = await response.json();
        if (!response.ok || !json.ok) throw new Error(json.error || "Rebuild failed.");
        processed += Number(json.processed ?? 0);
        total = Number(json.totalDrills ?? 0);
        setRebuildResult(`Rebuilt ${processed.toLocaleString()} analyzed games · ${total.toLocaleString()} useful positions kept.`);
        if (json.nextOffset == null) break;
        offset = Number(json.nextOffset);
      }
      notify(`Practice library rebuilt · ${total.toLocaleString()} playable positions.`);
      router.refresh();
    } catch (error) {
      setRebuildResult("");
      notify(error instanceof Error ? error.message : "Rebuild failed.", "error");
    } finally { setRebuilding(false); }
  }
  const rows = setup ? [
    ["Chess data", setup.storage, setup.databaseConfigured],
    ["Database", setup.databaseConfigured ? `configured · ${setup.databaseEnv}${setup.databaseSsl ? " · TLS" : ""}` : "no supported URL found", setup.databaseConfigured && !setup.databaseLooksLocal],
    ["Accepted names", setup.supportedEnvNames.join(", "), setup.databaseConfigured],
    ["Bootstrap connection", setup.directDatabaseEnv ? `direct · ${setup.directDatabaseEnv}` : "direct URL not set", Boolean(setup.directDatabaseEnv)],
    ["Schema & library", "created automatically on first load", setup.databaseConfigured],
    ["Multi-device sync", "automatic — every device reads the same database", setup.databaseConfigured],
    ["Access control", "No app login · use Vercel Deployment Protection", false],
    ["Serverless analysis", setup.cronSecretConfigured ? "CRON_SECRET configured" : "CRON_SECRET not set", setup.cronSecretConfigured],
  ] as const : [];
  return <section className="card settings-section"><h2>Data & deployment</h2>
    <p className="about-copy">Your games, PGNs, Stockfish evaluations, notes, drills, linked accounts, board preferences, and theory progress are stored in <strong>PostgreSQL</strong> through Drizzle ORM — never in this browser. Open the same URL on your phone, laptop, or tablet and you get the identical workspace; changes made on one device appear on the others on the next page load. Firebase and Google sign-in have been removed. A fresh database creates its own schema and restores the bundled 20,000-game library automatically.</p>
    <div className="deployment-rows">{rows.map(([label, value, ok]) => <div key={String(label)} className="deployment-row"><span>{label}</span><strong className={ok ? "lime" : ""}>{value}</strong>{ok ? <Icon name="check" size={14} className="lime"/> : <Icon name="info" size={14} className="muted"/>}</div>)}</div>
    <div className="row wrap" style={{ marginTop: 14 }}>
      <a className="button secondary small" href="/api/export" download><Icon name="download" size={13}/>Export my data (JSON)</a>
      <a className="button ghost small" href="/api/export?reference=1" download><Icon name="download" size={13}/>Export with universal library</a>
      <button className="button secondary small" disabled={restoring || !setup?.databaseConfigured} onClick={() => void restore()}>{restoring ? <Spinner size={13}/> : <Icon name="refresh" size={13}/>}Restore bundled library</button>
      <button className="button secondary small" disabled={rebuilding || !setup?.databaseConfigured} onClick={() => void rebuildDrills()}><Icon name="target" size={13}/>{rebuilding ? "Rebuilding…" : "Rebuild practice library"}</button>
    </div>
    <p className="note" style={{ marginTop: 8 }}>Rebuild drops puzzles from dead-lost positions and regenerates practical openings, middlegames, endgames and tactics. {rebuildResult}</p>
    <p className="note" style={{ marginTop: 8 }}>The export includes your games and PGNs, practice positions and attempt history, accounts, theory progress, and settings. Keep a copy outside Vercel — the database is the only store.</p>
    {restoreMessage ? <p className="help">{restoreMessage}</p> : null}

    {setup?.vercel ? <p className="note" style={{ marginTop: 12 }}>Running on Vercel: the persistent background worker is disabled. Schedule <span className="mono">/api/cron/analysis</span> with a <span className="mono">Bearer CRON_SECRET</span> header to keep the queue moving.</p> : null}
    {setup?.databaseLooksLocal ? <p className="inline-error"><Icon name="info"/>This URL points at localhost, which Vercel cannot reach. Replace it with a managed PostgreSQL connection string.</p> : null}
    <details style={{ marginTop: 12 }}><summary className="help" style={{ cursor: "pointer" }}>Deployment checklist</summary><ol className="about-copy"><li>Create managed Postgres and set <span className="mono">DATABASE_URL</span> (or keep a Vercel integration's <span className="mono">POSTGRES_URL</span>).</li><li>Apply that variable to <strong>Production</strong> and redeploy.</li><li>Open the app once: schema and the bundled library restore automatically.</li><li>Check <span className="mono">/api/setup</span> and <span className="mono">/api/health</span>.</li><li>Enable Vercel Deployment Protection if the workspace should be private.</li></ol></details>
  </section>;
}
