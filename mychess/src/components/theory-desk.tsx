"use client";

import { Chess, type Move } from "chess.js";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Board } from "@/components/board";
import { getBrowserEngine } from "@/components/browser-engine";
import { Icon, PageHeading, Spinner, useToast } from "@/components/ui";
import { THEORY_MODULES, dayKey, moduleById, todayModule, type TheoryModule } from "@/lib/curriculum";
import { describeMove } from "@/lib/learning";
import { playUci, pvToSan, sanOfUci } from "@/lib/lines";
import { formatEval, winPercentFromCp } from "@/lib/math";
import type { BoardThemeName, TheoryProgressView } from "@/lib/types";

type Stage = "idea" | "board" | "done";
type EngineView = { bestUci: string; bestSan: string; cp: number | null; mate: number | null; line: string; win: number };

export function TheoryDesk({ today, progress, profileTheme, referenceCount }: { today: TheoryModule; progress: TheoryProgressView[]; profileTheme: BoardThemeName; referenceCount: number }) {
  const router = useRouter(); const params = useSearchParams(); const notify = useToast();
  const [moduleId, setModuleId] = useState(params.get("module") && THEORY_MODULES.some(m => m.id === params.get("module")) ? params.get("module")! : today.id);
  const module = useMemo(() => moduleById(moduleId), [moduleId]);
  const [stage, setStage] = useState<Stage>("idea");
  const [quiz, setQuiz] = useState<number | null>(null);
  const [engine, setEngine] = useState<EngineView | null>(null);
  const [engineBusy, setEngineBusy] = useState(false);
  const [engineError, setEngineError] = useState("");
  const [answer, setAnswer] = useState<{ uci: string; correct: boolean; san: string; revealed?: boolean } | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [saving, setSaving] = useState(false);
  const [feedbackByModule, setFeedbackByModule] = useState<Record<string, TheoryProgressView>>(() => Object.fromEntries(progress.map(item => [item.moduleId, item])));
  const completed = Object.keys(feedbackByModule).length;
  const progressForModule = feedbackByModule[module.id];
  const todayDone = Boolean(feedbackByModule[today.id] && new Date(feedbackByModule[today.id].completedAt).toISOString().slice(0, 10) === dayKey());
  const candidates = useMemo(() => {
    if (!engine) return [];
    const chess = new Chess(module.fen);
    const moves = chess.moves({ verbose: true }) as Move[];
    const san = engine.bestSan;
    const alternatives = moves.filter(move => move.san !== san && move.piece !== chess.get(engine.bestUci.slice(2, 4) as never)?.type).slice(0, 12);
    const picks = [san, alternatives[Math.floor(alternatives.length / 3)]?.san, alternatives[Math.floor(alternatives.length * .7)]?.san].filter((value): value is string => Boolean(value));
    return [...new Set(picks)].slice(0, 3).sort(() => Math.random() - .5);
  }, [engine, module.fen]);
  const askStockfish = useCallback(async (fen: string) => {
    setEngineBusy(true); setEngineError("");
    try {
      const lines = await getBrowserEngine().analyze(fen, 12);
      const best = lines[0];
      if (best) { const sign = fen.split(" ")[1] === "w" ? 1 : -1; const cp = best.cp == null ? null : best.cp * sign; setEngine({ bestUci: best.uci, bestSan: sanOfUci(fen, best.uci), cp, mate: best.mate, line: pvToSan(fen, best.pv, 6), win: best.mate ? (best.mate > 0 ? 100 : 0) : winPercentFromCp(cp ?? 0) }); return; }
      throw new Error("No line returned");
    } catch {
      try {
        const response = await fetch("/api/position", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fen, depth: 12 }) });
        const json = await response.json(); const line = json.lines?.[0];
        if (!line) throw new Error("The engine is busy");
        const sign = fen.split(" ")[1] === "w" ? 1 : -1;
        setEngine({ bestUci: line.uci, bestSan: line.san || sanOfUci(fen, line.uci), cp: line.cp == null ? null : line.cp * sign, mate: line.mate, line: line.pvSan || line.san, win: line.mate ? (line.mate > 0 ? 100 : 0) : winPercentFromCp((line.cp ?? 0) * sign) });
      } catch (error) { setEngineError(error instanceof Error ? error.message : "Stockfish is unavailable right now."); }
    } finally { setEngineBusy(false); }
  }, []);
  useEffect(() => { setStage("idea"); setQuiz(null); setAnswer(null); setAttempts(0); setEngine(null); setEngineError(""); }, [module.id]);
  useEffect(() => { if (stage === "board" && !engine && !engineBusy) void askStockfish(module.fen); }, [stage, engine, engineBusy, module.fen, askStockfish]);
  function choose(id: string) { setModuleId(id); const search = new URLSearchParams(params.toString()); search.set("module", id); router.replace(`/theory?${search.toString()}`, { scroll: false }); }
  function tryMove(uci: string) {
    const chess = new Chess(module.fen); let move: Move;
    try { move = playUci(chess, uci); } catch { return; }
    setAttempts(value => value + 1);
    const correct = Boolean(engine && (uci === engine.bestUci || (uci.length === 5 && uci.slice(0, 4) === engine.bestUci.slice(0, 4))));
    setAnswer({ uci, correct, san: move.san });
  }
  function trySan(san: string) { const chess = new Chess(module.fen); try { const move = chess.move(san); tryMove(`${move.from}${move.to}${move.promotion ?? ""}`); } catch { /* impossible candidate */ } }
  async function complete() {
    setSaving(true);
    const score = Math.round(((quiz === module.quiz.correct ? 1 : 0) + (answer?.correct ? 1 : 0)) / 2 * 100);
    try {
      const response = await fetch("/api/theory/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ moduleId: module.id, correct: (quiz === module.quiz.correct ? 1 : 0) + (answer?.correct ? 1 : 0), attempts: attempts + 1, score, notes: "" }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      setFeedbackByModule(current => ({ ...current, [module.id]: { ...json, completedAt: new Date().toISOString() } }));
      setStage("done"); notify("Study saved. Your progress follows your Google sign-in.");
    } catch (error) { notify(error instanceof Error ? error.message : "Couldn't save this study.", "error"); }
    finally { setSaving(false); }
  }
  const next = THEORY_MODULES[(THEORY_MODULES.findIndex(item => item.id === module.id) + 1) % THEORY_MODULES.length];
  const streak = (() => { const dates = new Set(Object.values(feedbackByModule).map(item => new Date(item.completedAt).toISOString().slice(0, 10))); let count = 0; const cursor = new Date(); for (let i = 0; i < 60; i += 1) { if (dates.has(cursor.toISOString().slice(0, 10))) { count += 1; cursor.setUTCDate(cursor.getUTCDate() - 1); } else if (i === 0) cursor.setUTCDate(cursor.getUTCDate() - 1); else break; } return count; })();
  return <div>
    <PageHeading eyebrow="DAILY THEORY STUDY" title="Learn how Stockfish thinks — in your language." description="Your games remain the main teacher. This second curriculum teaches the ideas behind strong moves: evaluation, planning, piece shapes, pawn maps, king safety, and endgames — with a position to practise every day." action={<div className="row"><span className="badge green">{completed} / {THEORY_MODULES.length} STUDIES</span><span className="badge">{streak} DAY STREAK</span></div>}/>
    <div className="theory-today"><div><p className="eyebrow"><span className="status-dot"/>TODAY · {dayKey()}</p><h2>{today.title}</h2><p>{today.promise}</p></div><div className="row wrap"><span className="badge green">{todayDone ? "COMPLETED TODAY" : "READY"}</span><Link href={`/theory/lesson/${today.id}`} className="button primary"><Icon name="bulb" size={15}/>{todayDone ? "Review today's study" : "Start today's study"}</Link></div></div>
    <div className="theory-layout">
      <aside className="card theory-side"><h2 className="card-title">The curriculum</h2><p className="help" style={{ marginBottom: 12 }}>Ten lessons that rotate daily. Work through any of them in any order.</p><div className="module-list" data-lenis-prevent>{THEORY_MODULES.map((item, index) => <div key={item.id} className={`module-row ${item.id === module.id ? "active" : ""}`}><button className="module-row-main" onClick={() => choose(item.id)}><span className="module-index">{String(index + 1).padStart(2, "0")}</span><span><strong>{item.title}</strong><small>{item.category} · {item.minutes} min · {item.level}</small></span>{feedbackByModule[item.id] ? <Icon name="check" size={14} className="lime"/> : null}</button><Link className="module-open" href={`/theory/lesson/${item.id}`} aria-label={`Open lesson: ${item.title}`} title="Open full lesson"><Icon name="arrow" size={13}/></Link></div>)}</div>
        <div className="divider"/><p className="help">Universal library: <strong className="lime">{referenceCount.toLocaleString()}</strong> public elite games. <Link href="/library" className="lime">Explore →</Link></p>
      </aside>
      <section className="card theory-card"><AnimatePresence mode="wait"><motion.div key={`${module.id}-${stage}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .18 }}>
        <div className="row spread wrap"><span className="badge green">{module.category.toUpperCase()} · {module.level.toUpperCase()}</span><Link href={`/theory/lesson/${module.id}`} className="button ghost small"><Icon name="expand" size={12}/>Open full lesson</Link><span className="meta">Lesson {THEORY_MODULES.findIndex(item => item.id === module.id) + 1} of {THEORY_MODULES.length} · {module.minutes} min</span></div>
        <h2 className="lesson-title" style={{ fontSize: 30, marginTop: 14 }}>{module.title}</h2>
        <p className="lesson-summary">{module.promise}</p>
        {stage === "idea" ? <>
          <div className="concept-list">{module.concept.map((paragraph, index) => <div className="lesson-step" key={index}><span className="step-number">0{index + 1}</span><p>{paragraph}</p></div>)}</div>
          <div className="habit-box"><Icon name="bulb" size={18}/><div><strong>YOUR CHECKLIST</strong><ul>{module.checklist.map(item => <li key={item}>{item}</li>)}</ul></div></div>
          <div className="quiz-card"><p className="eyebrow">CHECK YOUR UNDERSTANDING</p><h3>{module.quiz.question}</h3><div className="quiz-options">{module.quiz.options.map((option, index) => <button key={option} className={`quiz-option ${quiz === index ? (index === module.quiz.correct ? "correct" : "wrong") : ""}`} onClick={() => setQuiz(index)} disabled={quiz !== null}>{String.fromCharCode(65 + index)}. {option}</button>)}</div>{quiz !== null ? <p className={`quiz-feedback ${quiz === module.quiz.correct ? "lime" : "red"}`}>{quiz === module.quiz.correct ? "Exactly. " : "Not quite. "}{module.quiz.why}</p> : null}</div>
          <button className="button primary" onClick={() => setStage("board")} disabled={quiz === null}><Icon name="board" size={15}/>Go to the board</button>
        </> : null}
        {stage === "board" ? <>
          <div className="theory-board-wrap"><div className="theory-board"><Board fen={module.fen} orientation={module.fen.split(" ")[1] === "b" ? "black" : "white"} theme={profileTheme} interactive={!answer?.correct} onMove={tryMove} arrows={answer?.correct ? [{ from: engine?.bestUci.slice(0, 2) ?? "", to: engine?.bestUci.slice(2, 4) ?? "", color: "#72ff68" }] : []}/></div>
            <div className="theory-board-side"><p className="eyebrow">THE POSITION</p><h3>{module.prompt}</h3><div className="habit-box"><Icon name="target" size={17}/><div><strong>WHAT STOCKFISH SEES</strong>{engineBusy ? <p className="row"><Spinner size={11}/>Translating the engine's idea…</p> : engine ? <p>From the mover's point of view: {engine.cp == null ? "a forced line" : formatEval(engine.cp, engine.mate)}. That is roughly a {Math.round(engine.win)}% winning chance in the study curve. The main line begins {engine.line}.</p> : <p>{engineError || "Ask again for the engine's idea."}</p>}</div></div>
              {engine && !answer?.correct ? <div className="candidates"><p className="eyebrow">OR PICK ONE</p><div className="row wrap">{candidates.map(san => <button key={san} className="button secondary small" onClick={() => trySan(san)}>{san}</button>)}</div></div> : null}
              {answer ? <div className={`theory-feedback ${answer.correct ? "correct" : "wrong"}`}><strong><Icon name={answer.correct ? "check" : "info"} size={15}/>{answer.revealed ? `Here is the engine’s idea: ${answer.san}.` : answer.correct ? `${answer.san} — Stockfish agrees.` : `${answer.san} is playable, but not the engine’s first choice.`}</strong><p>{describeMove(module.fen, answer.correct ? answer.uci : engine?.bestUci ?? answer.uci).text} {engine ? `The engine's idea is ${engine.bestSan}, with the line ${engine.line}.` : ""}</p></div> : <p className="help">Drag a piece or tap it and its destination. There's no penalty for a wrong guess.</p>}
            </div>
          </div>
          <div className="lesson-actions" style={{ marginTop: 18 }}>{!answer?.correct ? <button className="button secondary" onClick={() => { if (engine) setAnswer({ uci: engine.bestUci, correct: false, san: engine.bestSan, revealed: true }); }} disabled={!engine}><Icon name="bulb" size={14}/>Show me the idea</button> : null}<button className="button primary" onClick={() => void complete()} disabled={!answer || saving}>{saving ? <Spinner/> : <Icon name="check" size={14}/>}Finish this study</button><Link className="button ghost" href={`/play?fen=${encodeURIComponent(module.fen)}`}>Play it out vs engine</Link></div>
        </> : null}
        {stage === "done" ? <>
          <div className="complete-mark"><motion.div initial={{ scale: .6 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 280, damping: 16 }}><Icon name="check" size={40}/></motion.div></div>
          <h2 className="lesson-title">Study complete. Now make it yours.</h2><div className="habit-box"><Icon name="shield" size={18}/><div><strong>THE HABIT TO TAKE INTO YOUR NEXT GAME</strong><p>{module.habit}</p></div></div>
          <p className="lesson-summary">You answered the concept question {quiz === module.quiz.correct ? "correctly" : "incorrectly"} and {answer?.correct ? "found" : answer?.revealed ? "studied" : "saw"} the engine's move. The next useful step is to find the same idea in one of your own games — that's where understanding becomes skill.</p>
          <div className="lesson-actions"><button className="button primary" onClick={() => choose(next.id)}>Next study: {next.title} <Icon name="arrow" size={14}/></button><Link className="button secondary" href="/practice">Look for it in my games</Link><Link className="button ghost" href="/library">Study an elite game</Link></div>
          <p className="note" style={{ marginTop: 16 }}>Study progress is saved to this workspace's database.</p>
        </> : null}
      </motion.div></AnimatePresence></section>
    </div>
  </div>;
}
