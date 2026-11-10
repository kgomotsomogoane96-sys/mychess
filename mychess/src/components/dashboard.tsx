"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Board } from "@/components/board";
import { GameRow } from "@/components/game-row";
import { FocusButton } from "@/components/focus-button";
import { useAccountSync, useImport } from "@/components/import-dialog";
import { CountUp, Icon, Reveal, Spinner } from "@/components/ui";
import type { AccountView, DrillView, GameListItem, OpeningFamilyRow, PlanItem, WorkerStatus } from "@/lib/types";

export type TheoryCard = { id: string; title: string; promise: string; completed: number; total: number; todayDone: boolean; streak: number };

const AREA_ICON: Record<PlanItem["area"], string> = { openings: "study", endgames: "trophy", tactics: "target", time: "clock", habits: "shield", engine: "knight" };

export function Dashboard({ account, accounts, scopeLabel, plan, stats, recent, nextDrill, worker, openings, displayName, theory, referenceCount }: {
  account: AccountView | null; accounts: AccountView[]; scopeLabel: string; plan: PlanItem[]; stats: { games: number; score: number; analyzed: number; drills: number; solved: number; due: number; wins: number; losses: number; draws: number };
  recent: GameListItem[]; nextDrill: DrillView | null; worker: WorkerStatus; openings: OpeningFamilyRow[]; displayName: string; theory: TheoryCard; referenceCount: number;
}) {
  const openImport = useImport(); const sync = useAccountSync();
  const [syncing, setSyncing] = useState<string>(""); const [status, setStatus] = useState(worker);
  useEffect(() => { if (!status.running) return; const timer = setInterval(() => { fetch("/api/analysis").then(r => r.json()).then(json => setStatus(json.status)).catch(() => undefined); }, 5000); return () => clearInterval(timer); }, [status.running]);
  const name = account?.displayName ?? (displayName !== "You" ? displayName : "");
  const ratings = account?.ratings ?? {};
  const headlineRating = ratings.rapid?.rating ?? ratings.blitz?.rating ?? ratings.bullet?.rating ?? null;
  async function syncNow(target: AccountView) { setSyncing("Checking for new games…"); try { await sync(target, message => setSyncing(message)); window.location.reload(); } catch (e) { setSyncing(e instanceof Error ? e.message : "Sync failed"); } }
  return <div className="dashboard">
    <Reveal><section className="hero-grid">
      <div className="feature-main">
        <motion.img src="/images/chess-knight-hero.webp" alt="" initial={false} animate={{ scale: [1.02, 1.045, 1.02] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}/>
        <div className="feature-copy">
          <div className="feature-kicker"><span>{headlineRating ?? "#1"}</span>{headlineRating ? `${ratings.rapid ? "RAPID" : ratings.blitz ? "BLITZ" : "BULLET"} RATING · ${account?.platform === "chesscom" ? "CHESS.COM" : "LICHESS"}` : "MOVE AT A TIME"}</div>
          <h2>{name ? <>{name.toUpperCase()},<br/><em>THIS IS YOUR CHESS.</em></> : <>BIG ENGINE.<br/><em>SIMPLE LESSONS.</em></>}</h2>
          <p>{stats.games ? `${stats.games.toLocaleString()} games from ${scopeLabel}. Score ${stats.score}%. The plan below is built from them.` : "Link your Chess.com or Lichess account and the coaching plan builds itself from your games."}</p>
          <div className="row wrap"><FocusButton/>{stats.games ? <Link href="/practice" className="button dark">Start today's practice <Icon name="arrow" size={15}/></Link> : <button className="button dark" onClick={openImport}>Link my account <Icon name="arrow" size={15}/></button>}{account ? <button className="text-button" style={{ color: "#3d4740" }} onClick={() => void syncNow(account)} disabled={!!syncing}>{syncing ? <><Spinner size={11}/> {syncing}</> : <><Icon name="refresh" size={12}/> Check for new games</>}</button> : null}</div>
        </div>
      </div>
      <div className="feature-side">
        <Link href="/practice" className="feature-small"><img src="/images/chess-king-green.webp" alt=""/><div><p className="eyebrow">PRACTICE FROM YOUR GAMES</p><h3>{stats.drills ? `${stats.due} POSITIONS WAITING.` : "YOUR MISTAKES. YOUR NEXT SKILL."}</h3></div><span className="mini-cta">Practice <Icon name="arrow"/></span></Link>
        <Link href="/play" className="feature-small purple"><img src="/images/chess-queen-purple.webp" alt=""/><div><p className="eyebrow">SPARRING PARTNER</p><h3>PLAY STOCKFISH<br/>AT YOUR LEVEL.</h3></div><span className="mini-cta">Play now <Icon name="arrow"/></span></Link>
      </div>
    </section></Reveal>
    <Reveal delay={.06}><div className="stats-strip">
      {[{ icon: "archive", value: stats.games, label: "Games in your library", decimals: 0 }, { icon: "trophy", value: stats.games ? stats.score : null, label: `Score · ${stats.wins}W ${stats.draws}D ${stats.losses}L`, decimals: 1 }, { icon: "knight", value: stats.analyzed, label: status.queued ? `Analyzed · ${status.queued} in queue` : "Games analyzed by Stockfish", decimals: 0 }, { icon: "target", value: stats.due, label: `Positions waiting · ${stats.solved.toLocaleString()} mastered of ${stats.drills.toLocaleString()}`, decimals: 0 }].map(stat => <div className="stat-tile" key={stat.label}><span className="stat-icon"><Icon name={stat.icon} size={17}/></span><div><strong>{stat.value == null ? "—" : <CountUp value={stat.value} decimals={stat.decimals}/>}{stat.decimals === 1 && stat.value != null ? "%" : ""}</strong><small>{stat.label}</small></div></div>)}
    </div></Reveal>
    <div className="dash-grid">
      <Reveal className="card plan-card"><div className="section-heading" style={{ margin: "0 0 14px" }}><h2><Icon name="bulb" size={16}/>Your coaching plan</h2><span className="meta">Built from {scopeLabel}</span></div>
        <div className="plan-list">{plan.map((item, index) => <Link key={item.id} href={item.action.href} className="plan-item"><span className="plan-index">0{index + 1}</span><span className="plan-icon"><Icon name={AREA_ICON[item.area]} size={16}/></span><span className="plan-body"><strong>{item.title}</strong><p>{item.why}</p><span className="plan-metric">{item.metric}</span></span><span className="plan-action">{item.action.label} <Icon name="arrow" size={12}/></span></Link>)}</div>
      </Reveal>
      <div className="stack">
        <Reveal className="card next-lesson" delay={.05}><p className="eyebrow"><Icon name="target" size={13}/>NEXT POSITION</p><div className="lesson-mini-board"><Board fen={nextDrill?.fen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"} theme="neon" orientation={nextDrill?.fen.split(" ")[1] === "b" ? "black" : "white"}/></div><h3>{nextDrill ? nextDrill.theme : "Puzzles from your own games"}<br/><span className="lime">{nextDrill ? `vs ${nextDrill.fen.split(" ")[1] === "w" ? nextDrill.blackName : nextDrill.whiteName}` : "appear after analysis."}</span></h3><p>{nextDrill ? `${nextDrill.opening}. You played ${nextDrill.playedSan}; there was something better.` : "Run Stockfish over your recent games in the Engine lab and the practice queue fills with positions you actually faced."}</p><Link href={nextDrill ? "/practice" : "/engine"} className="button primary small">{nextDrill ? "Solve it" : "Open Engine lab"}<Icon name="arrow" size={14}/></Link></Reveal>
        <Reveal className="card theory-widget" delay={.1}><div className="row spread"><strong className="row"><Icon name="bulb" size={15}/>Today's theory study</strong><span className={`badge ${theory.todayDone ? "green" : "amber"}`}>{theory.todayDone ? "DONE" : "READY"}</span></div><h3>{theory.title}</h3><p>{theory.promise}</p><div className="row wrap" style={{ marginTop: 12 }}><Link href={`/theory?module=${theory.id}`} className="button primary small">{theory.todayDone ? "Review today's idea" : "Start today's study"} <Icon name="arrow" size={13}/></Link><Link href="/library" className="button ghost small">{referenceCount.toLocaleString()} elite games</Link></div><p className="meta" style={{ marginTop: 10 }}>{theory.completed} of {theory.total} studies · {theory.streak}-day streak · a new idea every day</p></Reveal>
        <Reveal className="card engine-widget" delay={.08}><div className="row spread"><strong className="row"><span className={`status-dot ${status.running ? "pulse" : ""}`}/>Engine lab</strong><Link href="/engine" className="text-button">Manage <Icon name="arrow" size={12}/></Link></div>
          <p className="help" style={{ margin: "10px 0" }}>{status.running ? `Analyzing ${status.currentLabel ?? "a game"}… ${status.queued} left${status.averageSeconds ? ` · ~${status.averageSeconds}s per game` : ""}.` : status.queued ? `${status.queued} games queued. Resume from the Engine lab.` : stats.analyzed ? `${stats.analyzed} games analyzed. Queue more to sharpen the tactics plan.` : "No engine analysis yet. Queue your recent games to unlock tactics lessons and puzzles."}</p>
          <div className="progress"><span style={{ width: `${stats.analyzed + status.queued ? Math.round((stats.analyzed / (stats.analyzed + status.queued)) * 100) : 0}%` }}/></div>
        </Reveal>
      </div>
    </div>
    <div className="dash-grid two">
      <Reveal className="card"><div className="section-heading" style={{ margin: "0 0 10px" }}><h2><span className="status-dot"/>Recent games</h2><Link href="/games" className="text-button">All games <Icon name="arrow" size={12}/></Link></div><div className="recent-list">{recent.length ? recent.map(game => <GameRow key={game.id} game={game}/>) : <p className="empty">No games yet. Link an account or import a PGN.</p>}</div></Reveal>
      <Reveal className="card" delay={.05}><div className="section-heading" style={{ margin: "0 0 10px" }}><h2><Icon name="study" size={15}/>Your openings</h2><Link href="/openings" className="text-button">Repertoire <Icon name="arrow" size={12}/></Link></div>
        {openings.length ? <table className="opening-table"><thead><tr><th>Opening</th><th>Games</th><th>Score</th></tr></thead><tbody>{openings.map(row => <tr key={`${row.color}-${row.key}`}><td><Link href={`/openings?color=${row.color}&family=${encodeURIComponent(row.key)}`}>{row.label}<small className="muted"> · {row.color}</small></Link></td><td>{row.games}</td><td className={row.score >= 52 ? "lime" : row.score < 46 ? "red" : ""}>{row.score}%</td></tr>)}</tbody></table> : <p className="empty">Opening stats appear once games are imported.</p>}
      </Reveal>
    </div>
    {accounts.length ? <Reveal><div className="habit-strip"><Icon name="shield" size={22}/><div><strong>{accounts.length > 1 ? `${accounts.length} accounts linked.` : "1 account linked."} Switch between them from the top-right menu.</strong><p>Stats on this page use {scopeLabel}. Nothing here is a verified rating; it is a study profile built from public games.</p></div></div></Reveal> : null}
  </div>;
}
