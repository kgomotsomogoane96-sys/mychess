"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GameRow } from "@/components/game-row";
import { Icon, PageHeading, Spinner, useToast } from "@/components/ui";
import type { GameListItem, Profile, WorkerStatus } from "@/lib/types";

export function EngineDesk({ status: initial, recent, profile, scopeLabel }: { status: WorkerStatus; recent: GameListItem[]; profile: Profile; scopeLabel: string }) {
  const router = useRouter(); const notify = useToast();
  const [status, setStatus] = useState(initial);
  const [busy, setBusy] = useState("");
  const [limit, setLimit] = useState(100);
  const [running, setRunning] = useState(false);
  const [sessionProcessed, setSessionProcessed] = useState(0);
  const [lastBatch, setLastBatch] = useState<{ processed: number; failed: number; queued: number; analyzed: number; current: string } | null>(null);
  const stopRef = useRef(false);

  useEffect(() => { const timer = setInterval(() => { fetch("/api/analysis").then(r => r.json()).then(json => setStatus(json.status)).catch(() => undefined); }, 4000); return () => clearInterval(timer); }, []);

  async function refreshStatus() {
    try { const json = await fetch("/api/analysis").then(r => r.json()); setStatus(json.status); } catch { /* keep last known */ }
  }

  /** Serverless-safe loop: each request analyzes a batch, then we ask for more. */
  async function runLoop(auto = false) {
    if (running) return;
    stopRef.current = false;
    setRunning(true);
    if (auto) notify("Resuming analysis — your games are being read in batches.");
    try {
      for (let round = 0; round < 500; round += 1) {
        if (stopRef.current) break;
        const response = await fetch("/api/analysis/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 8, budgetMs: 38000 }),
        });
        const json = await response.json();
        if (!response.ok || !json.ok) throw new Error(json.error || "Analysis batch failed");
        setSessionProcessed(value => value + Number(json.processed ?? 0) + Number(json.failed ?? 0));
        setLastBatch({ processed: json.processed, failed: json.failed, queued: json.queued, analyzed: json.analyzed, current: json.current });
        await refreshStatus();
        router.refresh();
        if (!json.queued) {
          notify(`Analysis complete — ${json.analyzed.toLocaleString()} games read by Stockfish.`);
          break;
        }
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "The analysis loop stopped.", "error");
    } finally {
      setRunning(false);
    }
  }

  async function act(action: string, scope?: string, count?: number) {
    setBusy(action + (scope ?? ""));
    try {
      const response = await fetch("/api/analysis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, scope, limit: count }) });
      const json = await response.json(); if (!response.ok) throw new Error(json.error);
      if (action === "queue") {
        notify(json.queued ? `${json.queued.toLocaleString()} games queued.` : "Nothing new to queue in that selection.");
        if (json.queued) void runLoop();
      } else {
        await refreshStatus(); router.refresh();
      }
    } catch (error) { notify(error instanceof Error ? error.message : "That didn't work.", "error"); }
    finally { setBusy(""); }
  }

  const eta = status.averageSeconds && status.queued ? Math.round((status.averageSeconds * status.queued) / 60) : null;
  const total = status.analyzed + status.queued + status.imported;
  return <div>
    <PageHeading eyebrow={`ENGINE LAB · ${scopeLabel.toUpperCase()}`} title="Let Stockfish read every game." description={`Analysis runs game by game at depth ${profile.bulkDepth}. The queue is saved in your database, so it survives reloads and restarts — this page works in batches until every game has been read.`}/>
    <div className="dash-grid two">
      <section className="card">
        <div className="row spread"><h2 className="card-title">Queue</h2><span className={`badge ${running ? "green" : ""}`}>{running ? "ANALYZING" : status.queued ? "READY TO RESUME" : "COMPLETE"}</span></div>
        <div className="engine-numbers"><div><strong>{status.analyzed.toLocaleString()}</strong><small>analyzed</small></div><div><strong>{status.queued.toLocaleString()}</strong><small>queued</small></div><div><strong>{status.imported.toLocaleString()}</strong><small>waiting to queue</small></div><div><strong>{eta != null ? `${eta}m` : "—"}</strong><small>estimated time left</small></div></div>
        <div className="progress"><span style={{ width: `${total ? Math.round((status.analyzed / total) * 100) : 0}%` }}/></div>
        <p className="help" style={{ marginTop: 10 }}>
          {running ? <span className="row"><Spinner size={12}/>Reading: {lastBatch?.current ?? "your next game"} · {sessionProcessed} done this session · {status.queued.toLocaleString()} left</span>
            : status.queued ? `${status.queued.toLocaleString()} games are waiting. Resume any time — the queue is remembered between visits.`
            : "Every game in this scope has been read by Stockfish."}
        </p>
        <div className="row wrap" style={{ marginTop: 14 }}>
          {running ? <button className="button secondary" onClick={() => { stopRef.current = true; }}><Icon name="pause" size={14}/>Pause</button>
            : <button className="button primary" onClick={() => void runLoop()} disabled={!status.queued}><Icon name="play" size={14}/>{status.queued ? `Resume · ${status.queued.toLocaleString()} to go` : "Analysis up to date"}</button>}
          <button className="button ghost" onClick={() => void act("clear")} disabled={running || !status.queued}><Icon name="trash" size={14}/>Clear queue</button>
        </div>
        <p className="note" style={{ marginTop: 12 }}>Every few seconds the page takes the next batch from the queue. You can close the tab and come back — nothing is lost.</p>
      </section>
      <section className="card">
        <h2 className="card-title">Analyze every game</h2>
        <p className="help" style={{ marginBottom: 14 }}>Your imported games become lessons only after Stockfish reads them: move reports, tactics, practice positions, and accuracy all come from analysis.</p>
        <div className="segmented" style={{ marginBottom: 14 }}>{[25, 100, 500, 2500, 25000].map(value => <button key={value} className={limit === value ? "selected" : ""} onClick={() => setLimit(value)}>{value === 25000 ? "ALL" : value}</button>)}</div>
        <div className="queue-options">
          {[{ scope: "recent", title: "Most recent games", text: "The games you remember best — start here." }, { scope: "losses", title: "Recent losses", text: "Where the lessons are densest." }, { scope: "rapid", title: "Rapid & classical", text: "Longer games mean fewer clock-driven blunders and clearer patterns." }, { scope: "unanalyzed", title: "Everything not yet analyzed", text: "Complete backfill — the whole archive." }].map(option => <button key={option.scope} className="queue-option" disabled={!!busy || running} onClick={() => void act("queue", option.scope, limit)}><span><strong>{option.title}</strong><p>{option.text}</p></span>{busy === `queue${option.scope}` ? <Spinner size={14}/> : <Icon name="plus" size={15}/>}</button>)}
        </div>
        <div className="habit-box" style={{ marginTop: 14 }}><Icon name="shield" size={18}/><div><strong>WHAT ANALYSIS UNLOCKS</strong><p>Move reports with theory-to-brilliant rankings, per-game accuracy, tactic practice from your own positions, and the patterns pages. Openings, endgames, and habits already use every imported game.</p></div></div>
      </section>
    </div>
    <section className="card" style={{ marginTop: 14 }}><div className="section-heading" style={{ margin: "0 0 8px" }}><h2><Icon name="check" size={15}/>Recently analyzed</h2><Link href="/games?status=analyzed" className="text-button">Open the report view <Icon name="arrow" size={12}/></Link></div><div className="recent-list">{recent.length ? recent.map(game => <GameRow key={game.id} game={game}/>) : <p className="empty">Nothing analyzed in this scope yet.</p>}</div></section>
  </div>;
}
