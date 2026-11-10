"use client";

import { Chess } from "chess.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Board } from "@/components/board";
import { getBrowserEngine } from "@/components/browser-engine";
import { Icon, PageHeading, Spinner, useToast } from "@/components/ui";
import { describeMove } from "@/lib/learning";
import { playUci, pvToSan, sanOfUci } from "@/lib/lines";
import { formatEval, scoreToCp, winPercentFromCp } from "@/lib/math";
import { playMoveSound } from "@/lib/sound";
import type { ColorName, Profile } from "@/lib/types";

const LEVELS = [{ id: 0, label: "Beginner", elo: "~800", skill: 0, movetime: 250, depth: 2 }, { id: 1, label: "Casual", elo: "~1100", skill: 3, movetime: 350, depth: 4 }, { id: 2, label: "Club", elo: "~1400", skill: 7, movetime: 450, depth: 6 }, { id: 3, label: "Strong club", elo: "~1700", skill: 11, movetime: 600, depth: 8 }, { id: 4, label: "Expert", elo: "~2000", skill: 15, movetime: 800, depth: 11 }, { id: 5, label: "Full strength", elo: "2500+", skill: 20, movetime: 1200, depth: 14 }];
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
type Coach = { kind: "good" | "warn" | "info"; title: string; body: string; best?: string; bestUci?: string };

export function PlayDesk({ profile, startFen, label, sourceGameId, rating, youColor, onToggleFocus }: { profile: Profile; startFen: string | null; label: string | null; sourceGameId: string | null; rating: number; youColor: ColorName | null; onToggleFocus?: () => void }) {
  const router = useRouter(); const notify = useToast();
  const initialFen = useMemo(() => { if (!startFen) return START; try { new Chess(startFen); return startFen; } catch { return START; } }, [startFen]);
  const suggested = LEVELS.reduce((best, level) => (Math.abs(Number(level.elo.replace(/\D/g, "")) - rating) < Math.abs(Number(best.elo.replace(/\D/g, "")) - rating) ? level : best), LEVELS[2]);
  const [level, setLevel] = useState(suggested.id);
  const [color, setColor] = useState<ColorName>(youColor ?? (initialFen.split(" ")[1] === "b" ? "black" : "white"));
  const [started, setStarted] = useState(false);
  const [history, setHistory] = useState<{ san: string; uci: string; fen: string; cpLossYou?: number }[]>([]);
  const [thinking, setThinking] = useState(false);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [hintArrow, setHintArrow] = useState<{ from: string; to: string } | null>(null);
  const [evalWhite, setEvalWhite] = useState<number | null>(null);
  const [showEval, setShowEval] = useState(true);
  const [coaching, setCoaching] = useState(true);
  const [engineError, setEngineError] = useState("");
  const [annotateMode, setAnnotateMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyMove, setBusyMove] = useState(false); const busy = useRef(false);
  const chess = useMemo(() => { const game = new Chess(initialFen); for (const move of history) { try { playUci(game, move.uci); } catch { break; } } return game; }, [initialFen, history]);
  const fen = chess.fen(); const turn = chess.turn(); const yourTurn = (turn === "w") === (color === "white"); const over = chess.isGameOver();
  const config = LEVELS[level];
  const resultText = over ? chess.isCheckmate() ? (yourTurn ? "Checkmate. Stockfish wins this one." : "Checkmate — you won!") : chess.isStalemate() ? "Stalemate. A draw." : chess.isThreefoldRepetition() ? "Draw by repetition." : chess.isInsufficientMaterial() ? "Draw: not enough material to mate." : "Draw by the fifty-move rule." : null;
  const evaluate = useCallback(async (position: string, depth = 10) => { const lines = await getBrowserEngine().analyze(position, depth); const best = lines[0]; if (!best) return null; const side = position.split(" ")[1] === "w" ? 1 : -1; return { cpWhite: side * scoreToCp(best.cp, best.mate), uci: best.uci, mate: best.mate, pv: best.pv }; }, []);
  const engineMove = useCallback(async (position: string) => {
    setThinking(true);
    try {
      const uci = await getBrowserEngine().play(position, { skill: config.skill, movetime: config.movetime, depth: config.depth });
      if (!uci) return;
      const game = new Chess(position); const move = playUci(game, uci);
      setHistory(current => [...current, { san: move.san, uci, fen: game.fen() }]);
      if (profile.sound) playMoveSound(move.captured ? "capture" : "move");
      if (showEval) { const after = await evaluate(game.fen(), 8); if (after) setEvalWhite(after.cpWhite); }
    } catch (error) { setEngineError(error instanceof Error ? error.message : "The browser engine couldn't move."); }
    finally { setThinking(false); }
  }, [config, evaluate, profile.sound, showEval]);
  useEffect(() => { if (started && !over && !yourTurn && !thinking && !busyMove) void engineMove(fen); }, [started, over, yourTurn, fen, thinking, busyMove, engineMove]);
  async function onMove(uci: string) {
    if (!started || !yourTurn || over || busy.current) return;
    const before = fen; const game = new Chess(before); let move;
    try { move = playUci(game, uci); } catch { if (profile.sound) playMoveSound("error"); return; }
    busy.current = true; setBusyMove(true); setHintArrow(null);
    setHistory(current => [...current, { san: move.san, uci, fen: game.fen() }]);
    if (profile.sound) playMoveSound(move.captured ? "capture" : "move");
    try {
      if (coaching || showEval) {
        const [pre, post] = await Promise.all([evaluate(before, 10), evaluate(game.fen(), 10)]);
        if (post) setEvalWhite(post.cpWhite);
        if (coaching && pre && post) {
          const sign = color === "white" ? 1 : -1; const loss = Math.max(0, pre.cpWhite * sign - post.cpWhite * sign);
          const winLoss = Math.max(0, winPercentFromCp(pre.cpWhite * sign) - winPercentFromCp(post.cpWhite * sign));
          setHistory(current => current.map((item, index) => (index === current.length - 1 ? { ...item, cpLossYou: Math.round(loss) } : item)));
          if (pre.uci === uci) setCoach({ kind: "good", title: `${move.san} — the engine's choice.`, body: describeMove(before, uci).text });
          else if (winLoss >= 18 || loss >= 250) setCoach({ kind: "warn", title: `${move.san} gives a lot away.`, body: `${describeMove(before, pre.uci).text} That was the stronger idea (${sanOfUci(before, pre.uci)}). Line: ${pvToSan(before, pre.pv, 5)}. You can take the move back and try again.`, best: sanOfUci(before, pre.uci), bestUci: pre.uci });
          else if (winLoss >= 8 || loss >= 90) setCoach({ kind: "info", title: `${move.san} is playable, but ${sanOfUci(before, pre.uci)} was cleaner.`, body: `${describeMove(before, pre.uci).text} Small gaps like this add up over a game.`, best: sanOfUci(before, pre.uci), bestUci: pre.uci });
          else setCoach({ kind: "good", title: `${move.san}. Solid.`, body: "Nothing given away. Keep checking threats before each move." });
        }
      }
    } catch { /* coaching is optional */ } finally { busy.current = false; setBusyMove(false); }
  }
  async function hint() { try { const result = await evaluate(fen, 12); if (result) { setHintArrow({ from: result.uci.slice(0, 2), to: result.uci.slice(2, 4) }); setCoach({ kind: "info", title: `Hint: look at ${sanOfUci(fen, result.uci)}.`, body: describeMove(fen, result.uci).text }); } } catch { setEngineError("Hints need the browser engine, which couldn't start."); } }
  function takeBack() { if (!history.length || thinking) return; const count = yourTurn ? 2 : 1; setHistory(current => current.slice(0, Math.max(0, current.length - count))); setCoach(null); setHintArrow(null); }
  function restart(fresh = false) { setHistory([]); setCoach(null); setHintArrow(null); setEvalWhite(null); setEngineError(""); setStarted(!fresh); }
  async function save() {
    setSaving(true);
    try {
      const game = new Chess(initialFen); for (const move of history) playUci(game, move.uci);
      game.setHeader("Event", "Practice vs Stockfish"); game.setHeader("Site", "MYCHESS"); game.setHeader("White", color === "white" ? profile.displayName : `Stockfish (${config.label})`); game.setHeader("Black", color === "black" ? profile.displayName : `Stockfish (${config.label})`);
      game.setHeader("Result", over ? (chess.isCheckmate() ? (turn === "w" ? "0-1" : "1-0") : "1/2-1/2") : "*"); if (initialFen !== START) { game.setHeader("SetUp", "1"); game.setHeader("FEN", initialFen); }
      const response = await fetch("/api/games", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pgn: game.pgn(), source: "engine", youColor: color }) });
      const json = await response.json(); if (!response.ok) throw new Error(json.error);
      notify("Saved. Stockfish will review it in full."); router.push(`/review/${json.saved[0].id}?run=1`);
    } catch (error) { notify(error instanceof Error ? error.message : "Couldn't save the game.", "error"); } finally { setSaving(false); }
  }
  const whitePercent = evalWhite == null ? 50 : winPercentFromCp(evalWhite);
  const lastMove = history.length ? { from: history[history.length - 1].uci.slice(0, 2), to: history[history.length - 1].uci.slice(2, 4) } : null;
  return <div>
    <div className="play-page">
    <PageHeading eyebrow="SPARRING PARTNER" title={label ? `Play it out: ${label}` : "Play Stockfish at your level."} description={label ? "Start from this exact position and try to prove the idea. The coach comments on every move you make." : "Pick a strength near your rating. The coach flags the moves that give something away and shows the better idea—no judgement, just the lesson."} action={onToggleFocus ? <button type="button" className="button ghost small" onClick={onToggleFocus} title="Fullscreen play · board only, Esc to exit"><Icon name="expand" size={13}/>Fullscreen</button> : null}/>
    <div className="play-layout">
      <div className="board-panel">
        <div className="player-strip"><span className="game-avatar"><Icon name="knight" size={17}/></span><strong>Stockfish · {config.label}</strong><small>{config.elo}</small>{thinking ? <span className="turn-indicator"><Spinner size={10}/>Thinking</span> : !yourTurn && started && !over ? <span className="turn-indicator"><i className="status-dot"/>To move</span> : null}</div>
        <div className="board-with-eval">{showEval ? <div className={`evaluation-rail ${color === "black" ? "flipped" : ""}`}><motion.div className="white-fill" animate={{ height: `${whitePercent}%` }} transition={{ duration: .4 }}/><span>{evalWhite == null ? "" : formatEval(evalWhite)}</span></div> : null}<div className="board-frame"><Board annotateMode={annotateMode} pieceSet={profile.pieceSet} fen={fen} orientation={color} theme={profile.boardTheme} interactive={started && yourTurn && !over && !thinking} lastMove={lastMove} onMove={uci => void onMove(uci)} arrows={hintArrow ? [{ ...hintArrow, color: "#72ff68" }] : coach?.bestUci && coach.kind !== "good" ? [{ from: coach.bestUci.slice(0, 2), to: coach.bestUci.slice(2, 4), color: "#ffc768" }] : []}/></div></div>
        <div className="player-strip bottom"><span className="game-avatar"><Icon name="user" size={16}/></span><strong>{profile.displayName === "You" ? "You" : profile.displayName}</strong><small>{color}</small>{yourTurn && started && !over ? <span className="turn-indicator"><i className="status-dot"/>Your move</span> : null}</div>
        <div className="transport"><button className="icon-button" aria-label="Take back" title="Take back your last move" onClick={takeBack} disabled={!history.length || thinking}><Icon name="back" size={16}/></button><button className="icon-button" aria-label="Hint" title="Ask the coach for a hint" onClick={() => void hint()} disabled={!started || !yourTurn || over}><Icon name="bulb" size={16}/></button><button className="icon-button" aria-label="Flip board" onClick={() => setColor(current => (current === "white" ? "black" : "white"))} disabled={started}><Icon name="flip" size={16}/></button><span className="move-counter">{Math.ceil(history.length / 2)} moves</span><button type="button" className="annotate-toggle" aria-pressed={annotateMode} onClick={() => setAnnotateMode(value => !value)}><Icon name="target" size={13}/>{annotateMode ? "Annotating" : "Annotate"}</button><button className="button ghost small" onClick={() => restart(true)}>New game</button></div>
      </div>
      <section className="card play-panel">
        {!started ? <>
          <span className="badge green">SET UP YOUR GAME</span><h2 className="lesson-title">Who are you playing today?</h2>
          <p className="help">Suggested for a {rating} rating: <strong className="lime">{suggested.label}</strong>. Win comfortably? Move up a level.</p>
          <div className="level-grid">{LEVELS.map(item => <button key={item.id} className={`level-option ${level === item.id ? "selected" : ""}`} onClick={() => setLevel(item.id)}><strong>{item.label}</strong><span>{item.elo}</span></button>)}</div>
          <div className="row wrap" style={{ margin: "16px 0" }}><span className="label">You play</span><div className="segmented"><button className={color === "white" ? "selected" : ""} onClick={() => setColor("white")}>White</button><button className={color === "black" ? "selected" : ""} onClick={() => setColor("black")}>Black</button></div></div>
          <label className="checkbox-row"><input type="checkbox" checked={coaching} onChange={event => setCoaching(event.target.checked)}/><span>Coach comments on my moves (uses a quick depth-10 check after each move)</span></label>
          <label className="checkbox-row"><input type="checkbox" checked={showEval} onChange={event => setShowEval(event.target.checked)}/><span>Show the evaluation bar</span></label>
          {initialFen !== START ? <p className="note">Starting from a position out of your game. {sourceGameId ? <Link href={`/review/${sourceGameId}`} className="lime">See the original game.</Link> : null}</p> : null}
          <button className="button primary full" onClick={() => restart(false)}><Icon name="play" size={15}/>Start playing</button>
        </> : <>
          <div className="row spread"><span className="badge green">{over ? "GAME OVER" : yourTurn ? "YOUR MOVE" : "STOCKFISH IS THINKING"}</span><span className="meta">{config.label} · {config.elo}</span></div>
          <AnimatePresence mode="wait"><motion.div key={coach?.title ?? resultText ?? "start"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .18 }}>
            {resultText ? <><h2 className="lesson-title">{resultText}</h2><p className="lesson-summary">{history.filter(move => (move.cpLossYou ?? 0) >= 90).length} of your moves gave something away. Save the game and Stockfish will review every move in plain English.</p></> : coach ? <div className={`coach-note ${coach.kind}`}><strong><Icon name={coach.kind === "good" ? "check" : coach.kind === "warn" ? "info" : "bulb"} size={15}/>{coach.title}</strong><p>{coach.body}</p>{coach.kind === "warn" ? <button className="button secondary small" onClick={takeBack}>Take it back and try {coach.best}</button> : null}</div> : <><h2 className="lesson-title">{yourTurn ? "Your move." : "Stockfish is thinking…"}</h2><p className="lesson-summary">Look at checks, captures, and threats before you commit. Ask for a hint any time.</p></>}
          </motion.div></AnimatePresence>
          {engineError ? <div className="inline-error"><Icon name="info"/>{engineError}</div> : null}
          <div className="move-list play-moves">{Array.from({ length: Math.ceil(history.length / 2) }, (_, index) => <div className="move-pair" key={index}><span className="num">{Math.floor(index + 1 + (initialFen.split(" ")[5] ? Number(initialFen.split(" ")[5]) - 1 : 0))}.</span>{[0, 1].map(offset => { const move = history[index * 2 + offset]; return move ? <span key={offset} className={`play-move ${(move.cpLossYou ?? 0) >= 250 ? "bad" : (move.cpLossYou ?? 0) >= 90 ? "soft" : ""}`}>{move.san}</span> : <span key={offset}/>; })}</div>)}</div>
          <div className="lesson-actions">{over ? <button className="button primary" onClick={() => void save()} disabled={saving}>{saving ? <Spinner/> : <Icon name="spark" size={14}/>}Save & get the full review</button> : <button className="button secondary" onClick={() => void hint()} disabled={!yourTurn}><Icon name="bulb" size={14}/>Hint</button>}<button className="button ghost" onClick={() => restart(true)}>New game</button>{history.length >= 6 && !over ? <button className="button ghost" onClick={() => void save()} disabled={saving}>Save so far</button> : null}</div>
        </>}
      </section>
    </div>
    </div>
  </div>;
}
