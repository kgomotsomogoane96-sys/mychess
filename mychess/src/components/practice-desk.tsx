"use client";

import { Chess } from "chess.js";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Board } from "@/components/board";
import { ClassPill } from "@/components/marks";
import { Icon, PageHeading, useToast } from "@/components/ui";
import { drillFeedback, PIECE_NAMES } from "@/lib/learning";
import { DRILL_KINDS } from "@/lib/learning-drills";
import { playUci } from "@/lib/lines";
import { moveNumber } from "@/lib/presentation";
import { playMoveSound } from "@/lib/sound";
import type { DrillKind, DrillView, Profile } from "@/lib/types";

const HABITS: Record<string, string> = { "Piece safety": "Before moving a piece, look at its landing square. Can it be captured? Count attackers and defenders.", "Finish the attack": "Look at checks first. Does the king have an escape square? Forcing moves are easier to calculate.", "Spot the slip": "Your opponent just moved. Ask what their move stopped defending—and what it left hanging.", "Defensive resources": "When worse, look for counterplay: checks, trades that reduce the attack, and activity for your pieces.", "Opening principles": "Control the center, develop your pieces, get your king safe. Which job needs doing here?", "Endgame awareness": "With fewer pieces on the board, your king can help. Count pawns and activate it safely.", "Better plans": "Try checks, captures, and threats—in that order. Then compare the position after your two favourite moves." };

export function PracticeDesk({ drills, stats, profile, initialKind, scopeLabel, onToggleFocus }: { drills: DrillView[]; stats: { total: number; mastered: number; due: number; byKind: Record<string, number> }; profile: Profile; initialKind: string; scopeLabel: string; onToggleFocus?: () => void }) {
  const notify = useToast();
  const [kind, setKind] = useState<DrillKind | "all">((Object.keys(DRILL_KINDS) as DrillKind[]).includes(initialKind as DrillKind) ? (initialKind as DrillKind) : "all");
  const [scope, setScope] = useState<"todo" | "all">("todo");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stage, setStage] = useState<"solving" | "solved" | "revealed">("solving");
  const [answerFen, setAnswerFen] = useState<string | null>(null);
  const [hint, setHint] = useState(0); const [wrong, setWrong] = useState(0); const [feedback, setFeedback] = useState("");
  const [sessionSolved, setSessionSolved] = useState<Set<string>>(new Set()); const [attempts, setAttempts] = useState(0);
  const counts = useMemo(() => Object.fromEntries((Object.keys(DRILL_KINDS) as DrillKind[]).map(key => [key, stats.byKind[key] ?? 0])) as Record<DrillKind, number>, [stats.byKind]);
  const queue = useMemo(() => drills.filter(drill => (kind === "all" || drill.kind === kind) && (scope === "all" || drill.id === selectedId || (drill.lastResult !== "solved" && !sessionSolved.has(drill.id)))), [drills, kind, scope, sessionSolved, selectedId]);
  const drill = queue.find(item => item.id === selectedId) ?? queue[0];
  const mastered = stats.mastered + [...sessionSolved].filter(id => drills.find(item => item.id === id && item.lastResult !== "solved")).length;
  useEffect(() => { setStage("solving"); setAnswerFen(null); setHint(0); setWrong(0); setFeedback(""); }, [drill?.id]);
  async function record(outcome: "solved" | "revealed" | "missed") { if (!drill) return; setAttempts(value => value + 1); try { const response = await fetch(`/api/drills/${drill.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome }) }); if (!response.ok) throw new Error(); } catch { notify("Progress couldn't sync. Keep practicing—try again later.", "error"); } }
  function reveal(outcome: "solved" | "revealed") { if (!drill || stage !== "solving") return; try { const chess = new Chess(drill.fen); playUci(chess, drill.solution); setAnswerFen(chess.fen()); } catch { setAnswerFen(drill.fen); } setSelectedId(drill.id); setStage(outcome); void record(outcome); if (outcome === "solved") { setSessionSolved(current => new Set([...current, drill.id])); if (profile.sound) playMoveSound("success"); } }
  function attempt(uci: string) { if (!drill || stage !== "solving") return; if (uci === drill.solution || (uci.length === 5 && uci.slice(0, 4) === drill.solution.slice(0, 4))) reveal("solved"); else { setWrong(value => value + 1); setFeedback(wrong ? "Still not the engine's idea. Try a forcing move, or ask for a hint." : "Not quite. Check what your opponent threatens, then look for checks and captures."); void record("missed"); if (profile.sound) playMoveSound("error"); } }
  function next() { if (!queue.length) return; const index = queue.findIndex(item => item.id === drill?.id); setSelectedId(queue[(index + 1) % queue.length]?.id ?? null); }
  const toMove = drill?.fen.split(" ")[1] === "b" ? "black" : "white";
  const pieceName = drill ? PIECE_NAMES[new Chess(drill.fen).get(drill.solution.slice(0, 2) as never)?.type ?? "p"] : "piece";
  return <div>
    <PageHeading eyebrow={`PRACTICE · ${scopeLabel.toUpperCase()}`} title="Positions you actually faced." description={`Only playable positions — openings, middlegames, endgames and tactics from your own games. Dead-lost positions are filtered out. Library: ${stats.total.toLocaleString()} positions · ${stats.due.toLocaleString()} still to master.`} action={<div className="row">{onToggleFocus ? <button type="button" className="button ghost small" onClick={onToggleFocus} title="Fullscreen practice · board only, Esc to exit"><Icon name="expand" size={13}/>Fullscreen</button> : null}<div className="segmented"><button className={scope === "todo" ? "selected" : ""} onClick={() => { setScope("todo"); setSelectedId(null); }}>To practice</button><button className={scope === "all" ? "selected" : ""} onClick={() => { setScope("all"); setSelectedId(null); }}>All positions</button></div></div>}/>
    <div className="filter-chips">{[["all", `All · ${stats.total.toLocaleString()}`] as const, ...(Object.keys(DRILL_KINDS) as DrillKind[]).map(key => [key, `${DRILL_KINDS[key].label} · ${counts[key]}`] as const)].map(([key, label]) => <button key={key} className={kind === key ? "active" : ""} onClick={() => { setKind(key as DrillKind | "all"); setSelectedId(null); }}>{label}</button>)}</div>
    {!drill ? <div className="empty-state"><Icon name={drills.length ? "trophy" : "target"} size={40} style={{ color: "var(--lime)" }}/><h2>{drills.length ? "Nothing left in this queue." : "Your puzzles come from your games."}</h2><p>{drills.length ? "Switch to all positions to repeat ideas, or analyze more games to generate new ones." : "Queue recent games in the Engine lab. Each analyzed game can produce up to a dozen positions worth replaying."}</p><div className="row wrap" style={{ justifyContent: "center" }}>{drills.length ? <button className="button primary" onClick={() => { setScope("all"); setKind("all"); }}>Show all positions</button> : <Link href="/engine" className="button primary">Open the Engine lab <Icon name="arrow" size={14}/></Link>}</div></div> : <div className="practice-layout">
      <motion.div className="board-panel" key={`${drill.id}-${wrong}`} animate={wrong && stage === "solving" ? { x: [0, -3, 3, -2, 0] } : { x: 0 }} transition={{ duration: .25 }}>
        <div className="player-strip"><span className="game-avatar"><Icon name="knight" size={17}/></span><strong>{toMove === "white" ? "White" : "Black"} to move · you</strong><span className="turn-indicator"><i className="status-dot"/>{stage === "solving" ? "Your turn" : "Idea revealed"}</span></div>
        <Board pieceSet={profile.pieceSet} fen={answerFen ?? drill.fen} orientation={toMove} theme={profile.boardTheme} interactive={stage === "solving"} onMove={attempt} lastMove={answerFen ? { from: drill.solution.slice(0, 2), to: drill.solution.slice(2, 4) } : null} arrows={hint >= 2 && stage === "solving" ? [{ from: drill.solution.slice(0, 2), to: drill.solution.slice(2, 4), color: "#72ff68" }] : []} highlight={hint === 1 && stage === "solving" ? [drill.solution.slice(0, 2)] : []}/>
        <div className="practice-progress">{queue.slice(0, 40).map(item => <span key={item.id} className={item.id === drill.id || item.lastResult === "solved" || sessionSolved.has(item.id) ? "done" : ""}/>)}</div>
        <div className="practice-stats"><div><strong>{mastered.toLocaleString()}</strong><small>Mastered of {stats.total.toLocaleString()}</small></div><div><strong>{attempts}</strong><small>Attempts this session</small></div><div><strong>{queue.length.toLocaleString()}</strong><small>In this queue · {stats.due.toLocaleString()} due overall</small></div></div>
      </motion.div>
      <section className="card practice-card"><AnimatePresence mode="wait"><motion.div key={`${drill.id}-${stage}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .2 }}>
        {stage === "solving" ? <>
          <div className="row wrap"><span className="badge green">{DRILL_KINDS[drill.kind].label.toUpperCase()}</span><span className="badge">{drill.theme}</span>{drill.found ? <span className="badge blue">YOU FOUND THIS IN THE GAME</span> : null}</div>
          <h2>{DRILL_KINDS[drill.kind].description}</h2>
          <p>Move {moveNumber(drill.ply)} of {drill.whiteName} vs {drill.blackName} · {drill.opening}. {drill.found ? "You found the right idea under pressure. Can you repeat it cold?" : `In the game you played ${drill.playedSan}.`}</p>
          <div className="habit-box"><Icon name="bulb" size={19}/><div><strong>THINKING CHECKLIST</strong><p>{HABITS[drill.theme] ?? HABITS["Better plans"]}</p></div></div>
          <div className={`practice-feedback ${feedback ? "wrong" : ""}`} aria-live="polite"><strong><Icon name={feedback ? "info" : "target"} size={16}/>{feedback ? "Useful try. Go again." : "No timer. No rating at stake."}</strong><p>{feedback || "Drag a piece or tap it and its destination. Right-drag to draw an arrow; right-click to mark a square."}</p></div>
          {hint ? <p className="hint-text">{hint === 1 ? `Look at the ${pieceName} on ${drill.solution.slice(0, 2)}. Where could it do more?` : `Follow the arrow: ${drill.solution.slice(0, 2)} → ${drill.solution.slice(2, 4)}.`}</p> : null}
          <div className="lesson-actions"><button className="button secondary" onClick={() => setHint(value => Math.min(2, value + 1))}><Icon name="bulb" size={14}/>{hint ? "More help" : "Hint"}</button><button className="button ghost" onClick={() => reveal("revealed")}>Show me the idea</button><button className="button ghost" onClick={next}>Skip</button></div>
        </> : <>
          <motion.div initial={{ scale: .6 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}><Icon name={stage === "solved" ? "check" : "bulb"} size={34} className="success-burst"/></motion.div>
          <h2>{stage === "solved" ? "You found it." : "Here's the idea."}<br/><span className="lime">{drill.solutionSan}</span></h2>
          <p>{drillFeedback(drill.fen, drill.solution)}</p>
          <div className="habit-box"><Icon name="shield" size={18}/><div><strong>THE HABIT TO KEEP</strong><p>{HABITS[drill.theme] ?? HABITS["Better plans"]}</p></div></div>
          <div className="row wrap" style={{ marginBottom: 16 }}><ClassPill name={drill.classification}/><span className="meta">The game continued {drill.playedSan}.</span></div>
          <button className="button primary full" onClick={next}>Next position <Icon name="arrow" size={15}/></button>
          <div className="lesson-actions" style={{ marginTop: 10 }}><button className="button ghost" onClick={() => { setStage("solving"); setAnswerFen(null); setHint(0); setFeedback(""); setWrong(0); }}>Try again</button><Link className="button ghost" href={`/review/${drill.gameId}`}>Whole game <Icon name="arrow" size={13}/></Link><Link className="button ghost" href={`/play?fen=${encodeURIComponent(drill.fen)}&game=${drill.gameId}`}>Play it out vs engine</Link></div>
        </>}
      </motion.div></AnimatePresence></section>
    </div>}
    {queue.length > 1 ? <div className="practice-queue"><div className="section-heading"><h2><Icon name="list" size={16}/>Up next</h2><span className="meta">{queue.length} positions</span></div><div className="queue-grid">{queue.slice(0, 8).map((item, index) => <button key={item.id} className={`queue-item ${item.id === drill?.id ? "active" : ""}`} onClick={() => setSelectedId(item.id)}><span className="game-avatar"><Icon name={item.lastResult === "solved" || sessionSolved.has(item.id) ? "check" : "target"} size={15}/></span><span><strong>{String(index + 1).padStart(2, "0")} · {DRILL_KINDS[item.kind].short}</strong><p>{item.opening} · move {moveNumber(item.ply)}</p></span></button>)}</div></div> : null}
  </div>;
}
