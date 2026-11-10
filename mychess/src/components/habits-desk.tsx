"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useState } from "react";
import { Icon, PageHeading, Reveal } from "@/components/ui";
import type { habitsReport } from "@/lib/coachplan";
import type { AccountView, ScoreRow } from "@/lib/types";

const SPEED_COLORS: Record<string, string> = { bullet: "#ff9191", blitz: "#ffc768", rapid: "#63f45b", classical: "#8cb7ff", daily: "#c1a3ff" };

function Bars({ rows, suffix = "%" }: { rows: ScoreRow[]; suffix?: string }) {
  const max = Math.max(1, ...rows.map(row => row.games));
  return <div className="bars">{rows.map(row => <div key={row.key} className="distribution-row"><div className="row spread"><span>{row.label}</span><span><strong className={row.score >= 52 ? "lime" : row.score < 46 ? "red" : ""}>{row.score}{suffix}</strong><small className="muted"> · {row.games} games</small></span></div><div className="bar"><motion.span initial={{ width: 0 }} whileInView={{ width: `${(row.games / max) * 100}%` }} viewport={{ once: true }} transition={{ duration: .6 }} style={{ background: row.score >= 52 ? "var(--lime)" : row.score < 46 ? "var(--red)" : "var(--amber)" }}/></div></div>)}</div>;
}

export function HabitsDesk({ report, scopeLabel, account }: { report: ReturnType<typeof habitsReport>; scopeLabel: string; account: AccountView | null }) {
  const speeds = Object.keys(report.ratingSeries);
  const [speed, setSpeed] = useState(speeds.includes("rapid") ? "rapid" : speeds[0] ?? "");
  const series = report.ratingSeries[speed] ?? [];
  const min = Math.min(...series.map(point => point.rating), 9999) - 20; const max = Math.max(...series.map(point => point.rating), 0) + 20;
  const points = series.map((point, index) => ({ x: 20 + (index / Math.max(1, series.length - 1)) * 560, y: 180 - ((point.rating - min) / Math.max(1, max - min)) * 160, ...point }));
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const timeouts = report.timeoutBySpeed.filter(row => row.losses >= 5);
  const worstTimeout = [...timeouts].sort((a, b) => b.share - a.share)[0];
  const tilt = report.afterWin.rate - report.afterLoss.rate;
  return <div>
    <PageHeading eyebrow={`HABITS · ${scopeLabel.toUpperCase()}`} title="The patterns behind the moves." description="No engine needed for this page: it reads how your games end, when you play, how long you keep going, and what your rating has been doing."/>
    {!report.games ? <div className="empty-state"><Icon name="chart" size={36}/><h2>Habits need games.</h2><p>Link a Chess.com or Lichess account and this page fills with your time habits, session patterns, and rating history.</p><Link href="/settings" className="button primary">Link an account</Link></div> : <>
      <div className="progress-stats">
        {[{ title: "Games with a result", value: report.games.toLocaleString(), help: scopeLabel }, { title: "Lost on time", value: worstTimeout ? `${worstTimeout.share}%` : "—", help: worstTimeout ? `of ${worstTimeout.label.toLowerCase()} losses` : "not enough losses yet" }, { title: "Win rate after a loss", value: `${report.afterLoss.rate}%`, help: `vs ${report.afterWin.rate}% after a win` }, { title: "Castled by move 10", value: `${report.castling.earlyShare}%`, help: `${report.castling.castledScore}% score when you do` }].map(stat => <Reveal key={stat.title} className="progress-stat"><span>{stat.title}</span><strong>{stat.value}</strong><p>{stat.help}</p></Reveal>)}
      </div>
      <div className="dash-grid two">
        <Reveal className="card"><div className="row spread wrap"><div><h2 className="card-title">Rating over time</h2><p className="help">From the rating recorded on each game{account ? ` on ${account.platform === "chesscom" ? "Chess.com" : "Lichess"}` : ""}.</p></div><div className="segmented">{speeds.map(item => <button key={item} className={speed === item ? "selected" : ""} onClick={() => setSpeed(item)}>{item}</button>)}</div></div>
          {points.length > 1 ? <div className="trend-chart"><svg viewBox="0 0 600 200" preserveAspectRatio="none" aria-label={`${speed} rating history`}><defs><linearGradient id="rating-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={SPEED_COLORS[speed] ?? "#63f45b"} stopOpacity=".25"/><stop offset="100%" stopColor={SPEED_COLORS[speed] ?? "#63f45b"} stopOpacity="0"/></linearGradient></defs>{[0, .25, .5, .75, 1].map(t => <g key={t}><line x1="20" x2="580" y1={180 - t * 160} y2={180 - t * 160} stroke="#2c3a30" strokeDasharray="3 5"/><text x="0" y={184 - t * 160} fill="#6f8576" fontSize="9">{Math.round(min + t * (max - min))}</text></g>)}<path d={`${path} L${points[points.length - 1].x},190 L20,190 Z`} fill="url(#rating-fill)"/><motion.path d={path} fill="none" stroke={SPEED_COLORS[speed] ?? "#63f45b"} strokeWidth="2.2" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }}/></svg><div className="chart-axis"><span>{series[0] ? new Date(series[0].t).toLocaleDateString() : ""}</span><span>Now · {series[series.length - 1]?.rating}</span></div></div> : <p className="empty">Not enough rated games in this time control.</p>}
        </Reveal>
        <Reveal className="card" delay={.05}><h2 className="card-title">How your losses happen</h2><p className="help" style={{ marginBottom: 12 }}>Time losses are the cheapest to fix: they need habits, not new knowledge.</p>
          <div className="bars">{report.lossReasons.slice(0, 5).map(row => <div key={row.key} className="distribution-row"><div className="row spread"><span>{row.label}</span><strong>{Math.round((row.games / Math.max(1, report.lossReasons.reduce((sum, item) => sum + item.games, 0))) * 100)}%<small className="muted"> · {row.games}</small></strong></div><div className="bar"><span style={{ width: `${(row.games / Math.max(1, report.lossReasons[0]?.games ?? 1)) * 100}%`, background: row.key === "timeout" ? "var(--red)" : "#5c7d64" }}/></div></div>)}</div>
          <div className="divider"/><h3 className="card-title" style={{ fontSize: 14 }}>Time losses by speed</h3>{timeouts.map(row => <div key={row.key} className="distribution-row"><div className="row spread"><span>{row.label}</span><strong className={row.share >= 25 ? "red" : ""}>{row.share}%<small className="muted"> · {row.timeouts} of {row.losses} losses</small></strong></div><div className="bar"><span style={{ width: `${row.share}%`, background: SPEED_COLORS[row.key] ?? "#5c7d64" }}/></div></div>)}
        </Reveal>
        <Reveal className="card"><h2 className="card-title">Results by time control & colour</h2><Bars rows={[...report.bySpeed, ...report.byColor]}/></Reveal>
        <Reveal className="card" delay={.05}><h2 className="card-title">Sessions and tilt</h2>
          <div className="habit-box" style={{ marginTop: 10 }}><Icon name={tilt >= 7 ? "info" : "check"} size={18}/><div><strong>{tilt >= 7 ? "LOSSES SNOWBALL" : "STEADY AFTER LOSSES"}</strong><p>{tilt >= 7 ? `After a loss you win ${report.afterLoss.rate}% of the next game; after a win, ${report.afterWin.rate}%. A two-minute pause after a loss is the cheapest rating gain available.` : `Your next-game win rate barely changes after a loss (${report.afterLoss.rate}% vs ${report.afterWin.rate}%). Good emotional control.`}</p></div></div>
          <p className="help">{report.sessions.count} sessions · {report.sessions.average} games per session on average, longest {report.sessions.longest}. Games 1–6 of a session: {report.sessions.earlyRate}% wins. Game 7 and later: {report.sessions.deepRate}% wins{report.sessions.deepGames ? ` (${report.sessions.deepGames} games)` : ""}.{report.sessions.deepGames >= 30 && report.sessions.earlyRate - report.sessions.deepRate >= 5 ? " Long sessions cost you points—set a stopping rule." : ""}</p>
          <div className="divider"/><h3 className="card-title" style={{ fontSize: 14 }}>When you play</h3><Bars rows={report.byDaypart}/>
        </Reveal>
        <Reveal className="card"><h2 className="card-title">King safety habit</h2><p className="help">You castle in {report.castling.castledShare}% of games and by move 10 in {report.castling.earlyShare}%. Score when castled early: <strong className="lime">{report.castling.castledScore}%</strong>. In {report.castling.neverGames} longer games you never castled: <strong className={report.castling.neverScore < report.castling.castledScore ? "red" : ""}>{report.castling.neverScore}%</strong>.</p><p className="help" style={{ marginTop: 10 }}>Average game length: {report.averageLength} moves.</p></Reveal>
        <Reveal className="card" delay={.05}><h2 className="card-title">What Stockfish sees</h2>{report.analyzed ? <><p className="help">{report.analyzed} analyzed games · {report.blundersPerGame} blunders per game.</p><div className="bars" style={{ marginTop: 12 }}>{report.phaseAccuracy.map(phase => <div key={phase.phase} className="distribution-row"><div className="row spread"><span style={{ textTransform: "capitalize" }}>{phase.phase} accuracy</span><strong>{phase.accuracy ?? "—"}{phase.accuracy != null ? "%" : ""}</strong></div><div className="bar"><span style={{ width: `${phase.accuracy ?? 0}%`, background: "var(--lime)" }}/></div></div>)}</div><div className="row wrap" style={{ marginTop: 12 }}>{report.themes.map(theme => <span key={theme.theme} className="badge amber">{theme.theme} · {theme.count}</span>)}</div></> : <p className="help">Queue games in the <Link href="/engine" className="lime">Engine lab</Link> to add blunder themes and phase accuracy here.</p>}</Reveal>
      </div>
    </>}
  </div>;
}
