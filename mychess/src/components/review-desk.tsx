"use client";

import { Chess } from "chess.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Board } from "@/components/board";
import { getBrowserEngine } from "@/components/browser-engine";
import { ClassPill, classColor } from "@/components/marks";
import { MoveReport } from "@/components/move-report";
import { FullReview } from "@/components/full-review";
import { Icon, Modal, Spinner, useToast } from "@/components/ui";
import { BAD_CLASSES, classMeta } from "@/lib/labels";
import { buildLesson, lineSteps, PIECE_NAMES } from "@/lib/learning";
import { playUci, pvToSan, sanOfUci } from "@/lib/lines";
import { formatAccuracy, formatEval, scoreToCp, winPercentFromCp } from "@/lib/math";
import { formatTimeControl, resultLabel } from "@/lib/pgn";
import { friendlyDate, moveNumber } from "@/lib/presentation";
import { playMoveSound } from "@/lib/sound";
import type { AnalyzedMove, ColorName, EngineLineView, GameView, Profile } from "@/lib/types";

function replay(pgn: string, fallback: string) {
  const chess = new Chess();
  try { chess.loadPgn(pgn); } catch { return { fens: [fallback], sans: [] as string[], ucis: [] as string[] }; }
  const moves = chess.history({ verbose: true });
  return { fens: moves.length ? [moves[0].before, ...moves.map(m => m.after)] : [fallback], sans: moves.map(m => m.san), ucis: moves.map(m => `${m.from}${m.to}${m.promotion ?? ""}`) };
}
function sanLineToUci(fen: string, line: string) {
  const chess = new Chess(fen); const ucis: string[] = [];
  for (const san of line.split(/\s+/).filter(Boolean).slice(0, 6)) { try { const move = chess.move(san); ucis.push(`${move.from}${move.to}${move.promotion ?? ""}`); } catch { break; } }
  return ucis;
}

type Branch = { rootPly: number; ucis: string[] };
type Tab = "review" | "report" | "coach" | "moves" | "engine" | "notes";

export function ReviewDesk({ game, profile, autoRun, onToggleFocus }: { game: GameView; profile: Profile; autoRun: boolean; onToggleFocus?: () => void }) {
  const router = useRouter();
  const notify = useToast();
  const base = useMemo(() => replay(game.pgn, game.initialFen), [game.pgn, game.initialFen]);
  const [ply, setPly] = useState(0);
  const [flipped, setFlipped] = useState(game.youColor === "black");
  const [tab, setTab] = useState<Tab>("review");
  const [simple, setSimple] = useState(profile.coachTone !== "sharp");
  const [branch, setBranch] = useState<Branch | null>(null);
  const [practice, setPractice] = useState<"solved" | "revealed" | null>(null);
  const [practicing, setPracticing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [hint, setHint] = useState(profile.showArrows);
  const [revealed, setRevealed] = useState(profile.showArrows);
  const [autoplay, setAutoplay] = useState(false);
  const [annotateMode, setAnnotateMode] = useState(false);
  const [touch, setTouch] = useState(false);
  useEffect(() => { try { setTouch(window.matchMedia("(pointer: coarse)").matches); } catch { /* assume mouse */ } }, []);
  const [lineQueue, setLineQueue] = useState<string[]>([]);
  const [linePlaying, setLinePlaying] = useState(false);
  const [live, setLive] = useState<{ fen: string; lines: EngineLineView[] } | null>(null);
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Warming up Stockfish…");
  const [error, setError] = useState("");
  const [notes, setNotes] = useState(game.notes);
  const [noteStatus, setNoteStatus] = useState("Saved to this game");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [explorer, setExplorer] = useState<{ san: string; games: number; white: number; draws: number; black: number }[]>([]);
  const [explorerName, setExplorerName] = useState("");
  const [explorerStatus, setExplorerStatus] = useState("idle");
  const sourceRef = useRef<AbortController | null>(null);
  const started = useRef(false);
  const jumped = useRef(false);
  const noteOriginal = useRef(game.notes);
  const rootPly = branch?.rootPly ?? ply;
  const orientation = flipped ? "black" : "white";
  const played = game.moves?.[ply - 1];
  const lesson = useMemo(() => played ? buildLesson(played, game.youColor) : null, [played, game.youColor]);
  const view = useMemo(() => {
    const chess = new Chess(base.fens[rootPly] ?? game.initialFen); const sans: string[] = [];
    for (const uci of branch?.ucis ?? []) { try { sans.push(playUci(chess, uci).san); } catch { break; } }
    return { fen: chess.fen(), sans, turn: chess.turn(), over: chess.isGameOver() };
  }, [base.fens, rootPly, branch, game.initialFen]);
  const mainPosition = !branch;
  const currentLines = branch ? (live?.fen === view.fen ? live.lines : []) : (game.moves?.[ply]?.lines ?? game.tail?.lines ?? []);
  const liveLine = live?.fen === view.fen ? live.lines[0] : undefined;
  const evalWhite = branch ? (liveLine ? (view.turn === "w" ? 1 : -1) * scoreToCp(liveLine.cp, liveLine.mate) : null) : ply === 0 ? game.moves?.[0]?.evalBefore ?? 0 : played?.evalAfter ?? game.tail?.evalWhite ?? 0;
  const mateWhite = branch ? (liveLine?.mate == null ? null : liveLine.mate * (view.turn === "w" ? 1 : -1)) : ply === 0 ? game.moves?.[0]?.mateBefore ?? null : played?.mateAfter ?? game.tail?.mate ?? null;
  const evalKnown = evalWhite != null && (mainPosition ? game.status === "analyzed" : !!liveLine);
  const whitePercent = evalKnown ? winPercentFromCp(evalWhite!) : 50;
  const bestUci = played?.bestUci;
  const arrowMove = hint && (branch ? currentLines[0]?.uci : bestUci);
  const arrows = arrowMove ? [{ from: arrowMove.slice(0, 2), to: arrowMove.slice(2, 4), color: "#72ff68" }] : [];
  const lastUci = branch?.ucis.length ? branch.ucis[branch.ucis.length - 1] : mainPosition && ply > 0 ? base.ucis[ply - 1] : null;
  const lastMove = lastUci ? { from: lastUci.slice(0, 2), to: lastUci.slice(2, 4) } : null;
  const yourSide = game.youColor === "white" ? "w" : game.youColor === "black" ? "b" : null;
  const moments = (game.moves ?? []).filter(m => ["blunder", "mistake", "miss", "brilliant", "great"].includes(m.classification) && (!yourSide || m.color === yourSide)).sort((a,b) => (b.cpLoss + (b.classification === "brilliant" ? 150 : 0)) - (a.cpLoss + (a.classification === "brilliant" ? 150 : 0))).slice(0, 6).sort((a,b) => a.ply-b.ply);

  const go = useCallback((next: number) => {
    setPly(Math.max(0, Math.min(base.fens.length - 1, next))); setBranch(null); setPracticing(false); setPractice(null); setFeedback(""); setAutoplay(false); setLinePlaying(false); setLineQueue([]); setHint(profile.showArrows); setRevealed(profile.showArrows);
  }, [base.fens.length, profile.showArrows]);

  const runAnalysis = useCallback(async () => {
    sourceRef.current?.abort();
    const controller = new AbortController(); sourceRef.current = controller;
    setRunning(true); setError(""); setProgress(1); setStatus("Warming up Stockfish…"); setAutoplay(false);
    try {
      let response: Response | null = null;
      for (let attempt = 0; attempt < 20; attempt++) {
        response = await fetch(`/api/analyze?gameId=${encodeURIComponent(game.id)}&depth=${profile.depth}`, { signal: controller.signal, cache: "no-store" });
        if (response.status !== 409) break;
        setStatus("Stockfish is finishing another review. Your place in line is saved…");
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      if (!response || !response.ok || !response.body) {
        let message = "Analysis couldn't start. Please try again.";
        try { const json = await response?.json(); if (json?.error) message = json.error; } catch { /* keep friendly fallback */ }
        throw new Error(message);
      }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const events = buffer.split("\n\n"); buffer = events.pop() ?? "";
        for (const event of events) {
          const line = event.split("\n").find(item => item.startsWith("data: "));
          if (!line) continue;
          const data = JSON.parse(line.slice(6)) as { type: string; index?: number; total?: number; message?: string; san?: string };
          if (data.type === "waiting") setStatus(data.message || "Waiting for the engine…");
          if ((data.type === "ply" || data.type === "start") && data.total) { setProgress(Math.max(2, Math.round((data.index ?? 0) / data.total * 100))); setStatus(data.san ? `Looking at ${data.san}…` : "Understanding the position…"); }
          if (data.type === "error") throw new Error(data.message || "Analysis couldn't finish. Please try again.");
          if (data.type === "done") { setProgress(100); setStatus("Your game is decoded."); await reader.cancel(); notify("Your game is decoded. Let's find the useful ideas."); router.refresh(); return; }
        }
      }
      throw new Error("The connection ended before the review was saved. Your game is safe—try again.");
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "The analysis connection dropped. Your game is safe—try again.");
    } finally {
      if (sourceRef.current === controller) setRunning(false);
    }
  }, [game.id, profile.depth, router, notify]);

  useEffect(() => { if (autoRun && !started.current && game.status !== "analyzed") { started.current = true; void runAnalysis(); } }, [autoRun, game.status, runAnalysis]);
  useEffect(() => () => sourceRef.current?.abort(), []);
  useEffect(() => {
    if (jumped.current || game.status !== "analyzed" || !game.moves?.length) return;
    jumped.current = true;
    const first = game.moves.find(m => BAD_CLASSES.has(m.classification) && (!yourSide || m.color === yourSide));
    if (first) setPly(first.ply);
  }, [game.status, game.moves, yourSide]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName) || target.closest("dialog") || event.metaKey || event.ctrlKey) return;
      if (event.key === "ArrowRight") { event.preventDefault(); go(ply + 1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); go(ply - 1); }
      if (event.key === "Home") { event.preventDefault(); go(0); }
      if (event.key === "End") { event.preventDefault(); go(base.fens.length - 1); }
      if (event.key.toLowerCase() === "f") setFlipped(v => !v);
      if (event.code === "Space") { event.preventDefault(); setAutoplay(v => !v); }
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [go, ply, base.fens.length]);
  useEffect(() => {
    if (!autoplay || branch || running) return;
    if (ply >= base.fens.length - 1) { setAutoplay(false); return; }
    const timer = setTimeout(() => { setPly(p => p + 1); if (profile.sound) playMoveSound(); }, 950);
    return () => clearTimeout(timer);
  }, [autoplay, branch, ply, base.fens.length, profile.sound, running]);
  useEffect(() => {
    if (!linePlaying || !lineQueue.length) { if (linePlaying) setLinePlaying(false); return; }
    const timer = setTimeout(() => { setBranch(current => current ? { ...current, ucis: [...current.ucis, lineQueue[0]] } : current); setLineQueue(queue => queue.slice(1)); if (profile.sound) playMoveSound(); }, 850);
    return () => clearTimeout(timer);
  }, [linePlaying, lineQueue, profile.sound]);
  useEffect(() => {
    if (!branch || view.over) { setLiveBusy(false); return; }
    let cancelled = false; setLiveBusy(true); setLiveError("");
    const fen = view.fen;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await getBrowserEngine().analyze(fen, Math.min(12, profile.depth));
          if (cancelled) return;
          setLive({ fen, lines: result.map(line => ({ ...line, san: sanOfUci(fen, line.uci), pvSan: pvToSan(fen, line.pv, 8) })) });
        } catch {
          try {
            const response = await fetch("/api/position", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fen, depth: profile.depth }) });
            const json = await response.json();
            if (!cancelled && response.ok) setLive({ fen, lines: json.lines ?? [] });
            else if (!cancelled) setLiveError(json.error || "The engine is busy. Try again in a moment.");
          } catch { if (!cancelled) setLiveError("Couldn't reach the engine. Your variation is still playable."); }
        } finally { if (!cancelled) setLiveBusy(false); }
      })();
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [branch, view.fen, view.over, profile.depth]);
  useEffect(() => {
    if (tab !== "engine") return;
    const controller = new AbortController(); setExplorerStatus("loading");
    const timer = setTimeout(() => {
      fetch(`/api/explorer?fen=${encodeURIComponent(view.fen)}`, { signal: controller.signal }).then(r => r.json()).then(json => { setExplorer(json.moves ?? []); setExplorerName(json.opening?.name ?? ""); setExplorerStatus(json.unavailable ? "error" : "ready"); }).catch(e => { if (e.name !== "AbortError") setExplorerStatus("error"); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [tab, view.fen]);
  useEffect(() => {
    if (notes === noteOriginal.current) return;
    setNoteStatus("Saving…");
    const timer = setTimeout(async () => {
      try { const response = await fetch(`/api/games/${game.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes }) }); if (!response.ok) throw new Error(); noteOriginal.current = notes; setNoteStatus("Saved to this game"); }
      catch { setNoteStatus("Not saved — try again"); notify("Your note couldn't be saved. Please try again.", "error"); }
    }, 650);
    return () => clearTimeout(timer);
  }, [notes, game.id, notify]);

  function startPractice() {
    if (!played) return;
    setBranch({ rootPly: ply - 1, ucis: [] }); setPracticing(true); setPractice(null); setFeedback(""); setHint(false); setRevealed(false); setAutoplay(false); setLinePlaying(false); setLineQueue([]); setTab("coach");
  }
  function followLine(line: EngineLineView, beforePlayed = false) {
    const start = beforePlayed && played ? ply - 1 : rootPly;
    const ucis = sanLineToUci(base.fens[start], line.pvSan);
    if (!ucis.length) return;
    setBranch({ rootPly: start, ucis: [] }); setPracticing(false); setPractice(null); setRevealed(true); setHint(true); setAutoplay(false); setLineQueue(ucis); setLinePlaying(true);
  }
  function onMove(uci: string) {
    if (practicing && played) {
      if (practice) return;
      if (uci === played.bestUci) { setPractice("solved"); setRevealed(true); setBranch({ rootPly: ply - 1, ucis: [uci] }); setFeedback("That's it. Now let's understand why it works."); if (profile.sound) playMoveSound("success"); }
      else { setFeedback("Not quite—and that's okay. Look at checks, captures, and what your opponent is threatening. Try again, or ask for a hint."); if (profile.sound) playMoveSound("error"); }
      return;
    }
    try {
      const chess = new Chess(view.fen); const move = playUci(chess, uci);
      setLinePlaying(false); setLineQueue([]); setAutoplay(false);
      setBranch(current => current ? { ...current, ucis: [...current.ucis, uci] } : { rootPly: ply, ucis: [uci] });
      if (profile.sound) playMoveSound(move.captured ? "capture" : "move");
    } catch { if (profile.sound) playMoveSound("error"); }
  }
  function reveal() {
    if (!played) return;
    setPractice("revealed"); setRevealed(true); setHint(true); setBranch({ rootPly: ply - 1, ucis: [played.bestUci] }); setFeedback("Here's the engine's idea. Follow the reply to see why it helps.");
  }
  async function claim(color: ColorName | null) {
    try { const response = await fetch(`/api/games/${game.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ youColor: color }) }); if (!response.ok) throw new Error(); setFlipped(color === "black"); router.refresh(); notify(color ? `This game is now linked to your ${color} pieces.` : "Personal side cleared."); } catch { notify("Couldn't update your side. Try again.", "error"); }
  }
  async function remove() {
    try { const response = await fetch(`/api/games/${game.id}`, { method: "DELETE" }); if (!response.ok) throw new Error(); setDeleteOpen(false); notify("Game removed from your library."); router.push("/archive"); router.refresh(); } catch { notify("Couldn't remove this game.", "error"); }
  }
  function download() { const url = URL.createObjectURL(new Blob([game.pgn], { type: "application/x-chess-pgn" })); const a = document.createElement("a"); a.href = url; a.download = `${game.whiteName}-vs-${game.blackName}.pgn`.replace(/[^\w.-]/g, "_"); a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  const topColor = flipped ? "w" : "b", bottomColor = flipped ? "b" : "w";
  const player = (color: "w" | "b") => <><span className={`player-piece ${color === "b" ? "black" : ""}`}><img src={`/pieces/${color}K.svg`} alt=""/></span><strong>{color === "w" ? game.whiteName : game.blackName}</strong><small>{(color === "w" ? game.whiteRating : game.blackRating) ?? ""}</small>{view.turn === color && !view.over ? <span className="turn-indicator"><i className="status-dot"/>To move</span> : null}</>;

  return <div className="review-page"><div className="review-heading"><div><p className="eyebrow"><span className="status-dot"/>{game.source === "sample" ? "EXAMPLE GAME" : "YOUR GAME REVIEW"} · {game.eco ?? game.opening}</p><h1>{game.whiteName} <span className="muted">vs</span> {game.blackName}</h1><p className="meta">{game.opening} · {formatTimeControl(game.timeControl)} · {friendlyDate(game.playedAt)} · {resultLabel(game.result, game.youColor)}</p></div><div className="row">{onToggleFocus ? <button type="button" className="button ghost small" onClick={onToggleFocus} title="Fullscreen review · board only, Esc to exit"><Icon name="expand" size={13}/>Fullscreen</button> : null}<div className="accuracy-pair"><div className="accuracy-box"><strong>{formatAccuracy(game.accuracyWhite)}</strong><small>WHITE ACCURACY</small></div><div className="accuracy-box"><strong>{formatAccuracy(game.accuracyBlack)}</strong><small>BLACK ACCURACY</small></div></div></div></div>{!game.youColor ? <div className="claim-banner"><p>Whose moves are yours? Pick a side for personal lessons and practice.</p><div className="segmented"><button onClick={() => void claim("white")}>White</button><button onClick={() => void claim("black")}>Black</button><button onClick={() => void claim(null)}>Just exploring</button></div></div> : null}<div className="review-layout"><div className="review-board-column"><div className="board-panel"><div className="player-strip">{player(topColor)}</div><div className="board-with-eval"><div className={`evaluation-rail ${flipped ? "flipped" : ""}`} title="Engine evaluation: more white means an advantage for White"><motion.div className="white-fill" animate={{ height: `${whitePercent}%` }} transition={{ duration: .45 }}/><span>{evalKnown ? formatEval(evalWhite!, mateWhite) : "…"}</span></div><div className="board-frame"><Board pieceSet={profile.pieceSet} fen={view.fen} orientation={orientation} theme={profile.boardTheme} interactive={!running && !practice && !view.over} lastMove={lastMove} arrows={arrows} badge={mainPosition && played ? { square: played.uci.slice(2, 4), classification: played.classification } : null} onMove={onMove}/></div></div><div className="player-strip bottom">{player(bottomColor)}</div><div className="transport"><button className="icon-button" aria-label="First position" title="First position (Home)" onClick={() => go(0)}><Icon name="back" size={16}/></button><button className="icon-button" aria-label="Previous move" title="Previous move (←)" onClick={() => go(ply - 1)}><Icon name="chevron" size={16} className="rotate-180"/></button><button className="icon-button play-button" aria-label={autoplay ? "Pause replay" : "Play game"} title="Play / pause (Space)" onClick={() => { if (branch) go(ply); setAutoplay(v => !v); }}><Icon name={autoplay ? "pause" : "play"} size={15}/></button><button className="icon-button" aria-label="Next move" title="Next move (→)" onClick={() => go(ply + 1)}><Icon name="chevron" size={16}/></button><button className="icon-button" aria-label="Last position" title="Last position (End)" onClick={() => go(base.fens.length - 1)}><Icon name="next" size={16}/></button><span className="move-counter">{ply} / {base.sans.length}</span><button className="icon-button" aria-label="Flip board" title="Flip board (F)" onClick={() => setFlipped(v => !v)}><Icon name="flip" size={16}/></button><button className="icon-button" aria-label="Download PGN" title="Download PGN" onClick={download}><Icon name="download" size={15}/></button>
            <button type="button" className="annotate-toggle" aria-pressed={annotateMode} onClick={() => setAnnotateMode(value => !value)} title="Tap two squares to draw an arrow; tap one to mark it"><Icon name="target" size={13}/>{annotateMode ? "Annotating" : "Annotate"}</button></div><p className="board-instruction">{practicing && !practice ? "Your turn. Drag a piece or tap a piece and its destination." : branch ? "You're exploring a variation. The original game is unchanged." : touch ? "Tap a piece, then its destination. Use Annotate to draw arrows by tapping two squares." : "Drag to explore. ← → step through the game. Right-drag to draw an arrow, right-click to mark a square."}</p></div><Graph moves={game.moves} ply={ply} onPick={go}/>{running ? <div className="analysis-progress"><div className="row"><Spinner/><span className="grow">{status}</span><span className="mono lime">{progress}%</span></div><div className="progress"><span style={{ width: `${progress}%` }}/></div><p className="meta">Stockfish is examining each position. Deeper analysis takes a little longer.</p></div> : null}{error ? <div className="inline-error"><Icon name="info"/>{error}</div> : null}{!running ? <button className={`button ${game.status === "analyzed" ? "ghost" : "primary"} full`} style={{ marginTop: 13 }} onClick={() => void runAnalysis()}><Icon name={game.status === "analyzed" ? "refresh" : "spark"} size={15}/>{game.status === "analyzed" ? "Run a fresh analysis" : `Understand this game · Stockfish depth ${profile.depth}`}</button> : null}{moments.length ? <div className="key-moments"><div className="row spread"><h3>The moments that matter</h3><span className="meta">Tap to explore</span></div><div className="moment-chips">{moments.map(moment => <button key={moment.ply} className={`moment-chip ${ply === moment.ply ? "active" : ""}`} onClick={() => { go(moment.ply); setTab("coach"); }}><i style={{ background: classColor(moment.classification) }}/><span>{moveNumber(moment.ply)} {moment.san}</span><small>{classMeta(moment.classification).label}</small></button>)}</div></div> : null}</div><section className="coach-panel"><div className="coach-tabs" role="tablist">{([{ id: "review", label: "Full review" }, { id: "report", label: "Report" }, { id: "coach", label: "Your coach" }, { id: "moves", label: "Moves" }, { id: "engine", label: "Engine" }, { id: "notes", label: "My notes" }] as const).map(item => <button key={item.id} role="tab" aria-selected={tab === item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>{item.label}</button>)}</div><div className="coach-body"><AnimatePresence mode="wait"><motion.div key={`${tab}-${branch ? "branch" : ply}-${practicing ? practice ?? "practice" : "game"}`} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .16 }}>{tab === "review" ? (
              <FullReview
                game={game}
                profile={profile}
                onJump={go}
                onAnalyze={() => void runAnalysis()}
                running={running}
                progress={progress}
                status={game.status}
              />
            ) : null}
            {tab === "report" ? (game.moves?.length ? (
              <MoveReport moves={game.moves} accuracyWhite={game.accuracyWhite} accuracyBlack={game.accuracyBlack} currentPly={ply} onJump={target => { go(target); setTab("coach"); }}/>
            ) : (
              <div className="game-summary-card"><span className="badge green">MOVE REPORT</span><h2>The report needs one analysis pass.</h2><p>Stockfish has to read the moves before every move can be ranked from theory to brilliant.</p>{!running ? <button className="button primary" onClick={() => void runAnalysis()}><Icon name="spark" size={14}/>Understand this game</button> : <div className="progress"><span style={{ width: `${progress}%` }}/></div>}</div>
            )) : null}
            {tab === "coach" ? <><div className="coach-mode"><div className="segmented"><button className={simple ? "selected" : ""} onClick={() => setSimple(true)}>Plain English</button><button className={!simple ? "selected" : ""} onClick={() => setSimple(false)}>Engine view</button></div><span><Icon name="shield" size={12}/>No chess jargon required</span></div>{branch ? <><div className="variation-banner"><span>{practicing ? practice === "solved" ? "You found it." : practice === "revealed" ? "The better idea" : "Your turn to find the idea" : `Your variation: ${view.sans.join(" ") || "choose a move"}`}</span><button onClick={() => go(ply)}>Back to game</button></div>{practicing && !practice && lesson ? <><span className="badge green">PRACTICE · MOVE {moveNumber(played!.ply)}</span><h2 className="lesson-title">What would you play?</h2><p className="lesson-summary">{lesson.question}</p><div className="habit-box"><Icon name="bulb"/><div><strong>A THINKING ROUTINE</strong><p>{lesson.habit}</p></div></div>{feedback ? <div className="inline-error" style={{ color: "var(--amber)", borderColor: "#ffc76830", background: "#ffc76808" }}><Icon name="info"/>{feedback}</div> : null}{hint ? <p className="hint-text">Look at the {PIECE_NAMES[new Chess(played!.fenBefore).get(played!.bestUci.slice(0, 2) as never)?.type ?? "p"]} on {played!.bestUci.slice(0, 2)}. Where could it be more useful?</p> : null}<div className="lesson-actions"><button className="button secondary" onClick={() => hint ? reveal() : setHint(true)}><Icon name="bulb" size={14}/>{hint ? "Show the move" : "Give me a hint"}</button>{hint ? <button className="button primary" onClick={reveal}>Show the idea <Icon name="arrow" size={14}/></button> : <button className="button ghost" onClick={reveal}>I'd rather learn this one</button>}</div></> : <>{played ? <><ClassPill name={practice === "solved" ? "best" : played.classification}/><h2 className="lesson-title">{practice === "solved" ? "Good find. Here's why it works." : lesson?.title}</h2><div className="lesson-step"><span className="step-number">01</span><div><h3>What the move does</h3><p>{describeBest(played)}</p></div></div><div className="lesson-step"><span className="step-number">02</span><div><h3>Why it matters</h3><p>{lesson?.idea}</p></div></div></> : <p className="lesson-summary">Explore a move on the board. The engine will examine your idea without changing the original game.</p>}{liveBusy ? <p className="help row"><Spinner size={12}/>Checking your idea with Stockfish…</p> : liveError ? <p className="help">{liveError}</p> : currentLines[0] ? <div className="engine-line"><div className="row spread"><strong>Engine's next idea: {currentLines[0].san}</strong><button className="text-button" onClick={() => setLinePlaying(v => !v)}><Icon name={linePlaying ? "pause" : "play"} size={12}/>{linePlaying ? "Pause" : lineQueue.length ? "Continue" : "Replay idea"}</button></div><p>{currentLines[0].pvSan}</p><span className="meta">{view.over ? "This position ends the game." : "A possible continuation, not a move you have to memorize."}</span></div> : <p className="help">{view.over ? "This position ends the game." : "Play a legal move to explore an alternative."}</p>}<div className="lesson-actions"><button className="button secondary" onClick={() => go(ply)}>Back to the game</button><Link className="button ghost" href="/practice">More practice <Icon name="arrow" size={13}/></Link></div></>}</> : played && lesson ? <><div className="row spread"><ClassPill name={played.classification}/><span className="meta">MOVE {moveNumber(played.ply)} · {played.san}</span></div><h2 className="lesson-title">{lesson.title}</h2><p className="lesson-summary">{profile.coachTone === "direct" ? `${played.san} was played. The engine's choice is ${played.bestSan}. Here's the useful difference.` : lesson.summary}</p>{simple ? <><div className="lesson-step"><span className="step-number">01</span><div><h3>What happened</h3><p>{lesson.what}</p></div></div><div className="lesson-step"><span className="step-number">02</span><div><h3>Why it matters</h3><p>{lesson.why}</p></div></div>{revealed ? <div className="lesson-step"><span className="step-number">03</span><div><h3>{played.bestUci === played.uci ? "The idea to take with you" : "A better idea"}</h3><p>{lesson.idea}</p></div></div> : <div className="lesson-actions"><button className="button primary" onClick={() => { setRevealed(true); setHint(true); }}><Icon name="bulb" size={14}/>Show me the idea</button>{played.bestUci !== played.uci ? <button className="button secondary" onClick={startPractice}>Let me try it</button> : null}</div>}{revealed && lesson.observation ? <p className="note" style={{ marginTop: 12 }}>{lesson.observation}</p> : null}</> : <><div className="engine-detail-grid"><div><strong>{formatEval(played.evalBefore, played.mateBefore)}</strong><small>BEST CONTINUATION</small></div><div><strong>{formatEval(played.evalAfter, played.mateAfter)}</strong><small>AFTER YOUR MOVE</small></div><div><strong>{played.cpLoss}</strong><small>CENTIPAWN LOSS</small></div></div><div className="engine-line" style={{ marginTop: 15 }}><strong>Best: {played.bestSan} · depth {game.depth}</strong><p>{played.lines[0]?.pvSan || "No continuation stored."}</p><span className="meta">{classMeta(played.classification).blurb} Accuracy for this move: {played.accuracy.toFixed(1)}%.</span></div><p className="help">{lesson.what} {lesson.why}</p></>}<div className="habit-box"><Icon name="bulb" size={18}/><div><strong>TAKE THIS INTO YOUR NEXT GAME</strong><p>{lesson.habit}</p></div></div><div className="lesson-actions">{played.bestUci !== played.uci ? <button className="button secondary" onClick={startPractice}><Icon name="target" size={14}/>Practice this position</button> : null}{played.lines[0] ? <button className="button ghost" onClick={() => followLine(played.lines[0], true)}><Icon name="play" size={13}/>See the idea played out</button> : null}<Link className="button ghost" href={`/play?fen=${encodeURIComponent(played.fenBefore)}&game=${game.id}`}>Play it out vs engine</Link></div>{revealed && played.lines[0] ? <div className="engine-details"><details><summary><Icon name="chevron" size={12}/>Follow the line, one move at a time</summary>{lineSteps(played.fenBefore, played.lines[0].pvSan).map((step, i) => <div className="lesson-step" key={i}><span className="step-number">{i + 1}</span><div><h3>{step.san}</h3><p>{step.comment}</p></div></div>)}</details></div> : null}<details className="engine-details"><summary><Icon name="info" size={12}/>How sure is this explanation?</summary><p className="note">Move evaluations and the suggested line come from Stockfish at depth {game.depth ?? profile.depth}. Piece movements are read from the board. Labels and exchange observations are learning heuristics, not a verdict on your playing strength. “Accuracy” is a study score and can differ between platforms.</p></details></> : <div className="game-summary-card"><span className="badge green">THE BIG PICTURE</span><h2>{game.status === "analyzed" ? "A game is a collection of decisions." : "Let's find the story in your game."}</h2><p>{game.status === "analyzed" ? "Choose a key moment below the board, or step through the moves. Your coach will explain what changed and what to try next time." : "Stockfish will examine the positions. Your coach will turn those findings into practical explanations and positions you can practice."}</p>{game.summary?.lessons.map((text, i) => <div className="lesson-step" key={i}><span className="step-number">0{i + 1}</span><div><p>{text}</p></div></div>)}{moments[0] ? <button className="button primary" onClick={() => go(moments[0].ply)}>Explore the first key moment <Icon name="arrow" size={14}/></button> : null}</div>}</> : null}{tab === "moves" ? <><div className="row spread" style={{ marginBottom: 17 }}><h2 className="card-title">The game, move by move</h2><span className="badge">{base.sans.length} half-moves</span></div><p className="help" style={{ marginBottom: 17 }}>Tap any move to jump to that position. Symbols point out moments worth a closer look.</p><div className="move-list" data-lenis-prevent><div className="move-list-head"><span>#</span><span>White</span><span>Black</span></div>{Array.from({ length: Math.ceil(base.sans.length / 2) }, (_, i) => <div className="move-pair" key={i}><span className="num">{i + 1}.</span>{[0, 1].map(offset => { const index = i * 2 + offset; const move = game.moves?.[index]; return base.sans[index] ? <button key={offset} className={ply === index + 1 && !branch ? "on" : ""} onClick={() => { go(index + 1); }}><span>{base.sans[index]}</span>{move ? <small style={{ color: classColor(move.classification) }}>{classMeta(move.classification).glyph}</small> : null}</button> : <span key={offset}/>; })}</div>)}</div></> : null}{tab === "engine" ? <><div className="row spread" style={{ marginBottom: 15 }}><h2 className="card-title">Under the hood</h2><span className="badge green">STOCKFISH 19</span></div><p className="help" style={{ marginBottom: 17 }}>The engine's possible continuations from this position. Scores are always from White's point of view: positive favors White.</p>{liveBusy ? <p className="help row"><Spinner size={13}/>Calculating your variation…</p> : currentLines.length ? currentLines.map((line, i) => <div className="engine-line" key={`${line.uci}-${i}`}><div className="row spread"><strong>{i + 1}. {line.san}</strong><span className="badge green">{line.mate != null ? `Mate in ${Math.abs(line.mate)}` : line.cp != null ? formatEval(line.cp * (view.turn === "w" ? 1 : -1)) : "—"}</span></div><p>{line.pvSan}</p><button className="text-button" onClick={() => followLine(line)}><Icon name="play" size={12}/>Play this line</button></div>) : <p className="help">{view.over ? "The game ends in this position." : "Run an analysis or play a variation to see engine lines."}</p>}<div className="divider"/><h3 className="card-title">What do masters play?</h3><p className="help">{explorerName || "Opening explorer · Lichess masters database"}</p>{explorerStatus === "loading" ? <p className="help row" style={{ marginTop: 13 }}><Spinner size={12}/>Looking up this position…</p> : explorer.length ? <table className="explorer-table"><thead><tr><th>Move</th><th>Games</th><th>White wins</th><th>Draws</th></tr></thead><tbody>{explorer.map(move => <tr key={move.san}><td><button className="lime" onClick={() => { const c = new Chess(view.fen); try { const m = c.move(move.san); onMove(`${m.from}${m.to}${m.promotion ?? ""}`); } catch { /* explorer move outside current rules */ } }}>{move.san}</button></td><td>{move.games.toLocaleString()}</td><td>{Math.round(move.white / Math.max(1, move.games) * 100)}%</td><td>{Math.round(move.draws / Math.max(1, move.games) * 100)}%</td></tr>)}</tbody></table> : <p className="help" style={{ marginTop: 12 }}>{explorerStatus === "error" ? "The explorer is unavailable right now. Engine analysis still works." : "No master games found for this exact position."}</p>}<div className="divider"/><div className="row spread"><span className="help">This game belongs to</span><div className="segmented"><button aria-pressed={game.youColor === "white"} onClick={() => void claim("white")}>Me: White</button><button aria-pressed={game.youColor === "black"} onClick={() => void claim("black")}>Me: Black</button></div></div>{game.externalUrl ? <a className="text-button" href={game.externalUrl} target="_blank" rel="noreferrer" style={{ marginTop: 15 }}>View the original game <Icon name="link" size={12}/></a> : null}</> : null}{tab === "notes" ? <><h2 className="card-title">Make the lesson stick.</h2><p className="help" style={{ margin: "9px 0 18px" }}>Write the idea in your own words. What will you look for in your next game?</p><textarea className="textarea notes-area" aria-label="Your game notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Instead of memorizing the engine move, I want to remember…"/><p className="save-status" style={{ marginTop: 10 }}><Icon name={noteStatus.startsWith("Saved") ? "check" : "clock"} size={12}/>{noteStatus}</p><div className="divider"/><button className="button secondary full" onClick={download}><Icon name="download" size={15}/>Download this game's PGN</button><button className="button danger full" style={{ marginTop: 10 }} onClick={() => setDeleteOpen(true)}><Icon name="trash" size={14}/>Remove from my library</button></> : null}</motion.div></AnimatePresence></div></section></div><Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Remove this game?"><p className="modal-intro">This removes the game, its analysis, notes, and practice positions from this workspace. You can import the PGN again later.</p><div className="row"><button className="button ghost grow" onClick={() => setDeleteOpen(false)}>Keep it</button><button className="button danger grow" onClick={() => void remove()}>Remove game</button></div></Modal></div>;
}

function describeBest(move: AnalyzedMove) {
  const chess = new Chess(move.fenBefore);
  try { const played = playUci(chess, move.bestUci); return `${played.san} moves the ${{ p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" }[played.piece]} from ${played.from} to ${played.to}${played.captured ? `, capturing a ${{ p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" }[played.captured]}` : ""}${chess.isCheck() ? " and gives check" : ""}.`; } catch { return `The engine recommends ${move.bestSan}.`; }
}

function Graph({ moves, ply, onPick }: { moves: AnalyzedMove[] | null; ply: number; onPick: (ply: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const points = [{ ply: 0, value: 50, san: "Start" }, ...(moves ?? []).map(move => ({ ply: move.ply, value: winPercentFromCp(scoreToCp(move.evalAfter, move.mateAfter)), san: move.san }))];
  const width = 600, height = 76;
  const x = (index: number) => index / Math.max(1, points.length - 1) * width;
  const y = (value: number) => height - value / 100 * (height - 8) - 4;
  const path = points.map((point, i) => `${i ? "L" : "M"}${x(i)},${y(point.value)}`).join(" ");
  const selected = hover ?? ply;
  const point = points[Math.min(selected, points.length - 1)];
  function pick(clientX: number, target: SVGSVGElement) { const rect = target.getBoundingClientRect(); return Math.max(0, Math.min(points.length - 1, Math.round((clientX - rect.left) / rect.width * (points.length - 1)))); }
  return <div className="evaluation-graph"><div className="graph-heading"><span><Icon name="chart" size={12}/>The story of the game</span><span>White above · Black below</span></div><div className="graph"><svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Game evaluation timeline. Use the move buttons to navigate." onClick={e => onPick(pick(e.clientX, e.currentTarget))} onMouseMove={e => setHover(pick(e.clientX, e.currentTarget))} onMouseLeave={() => setHover(null)}><defs><linearGradient id="eval-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#63f45b" stopOpacity=".23"/><stop offset="100%" stopColor="#63f45b" stopOpacity=".01"/></linearGradient></defs><line x1="0" x2={width} y1={height/2} y2={height/2} stroke="#405044" strokeDasharray="3 4"/><path d={`${path} L${width},${height} L0,${height} Z`} fill="url(#eval-fill)"/><motion.path key={moves?.length ?? 0} d={path} fill="none" stroke="#63f45b" strokeWidth="1.8" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }}/>{points.map((p, i) => BAD_CLASSES.has(moves?.[i - 1]?.classification ?? "best") ? <circle key={i} cx={x(i)} cy={y(p.value)} r="2.5" fill={classColor(moves![i - 1].classification)}/> : null)}<line x1={x(Math.min(ply, points.length - 1))} x2={x(Math.min(ply, points.length - 1))} y1="0" y2={height} stroke="#e8f5e9" strokeWidth="1" strokeDasharray="2 3"/><circle cx={x(Math.min(ply, points.length - 1))} cy={y(points[Math.min(ply, points.length - 1)].value)} r="3.5" fill="#f4fff5" stroke="#63f45b" strokeWidth="2"/></svg></div><div className="graph-tooltip">{point ? `${moveNumber(point.ply)} ${point.san} · ${moves?.[point.ply - 1] ? formatEval(moves[point.ply - 1].evalAfter, moves[point.ply - 1].mateAfter) : "Starting position"}` : "Analyze the game to see its turning points"}</div></div>;
}
