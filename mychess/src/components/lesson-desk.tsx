"use client";

import { Chess, type Move } from "chess.js";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Board } from "@/components/board";
import { getBrowserEngine } from "@/components/browser-engine";
import { Icon, PageHeading, Spinner, useToast } from "@/components/ui";
import { THEORY_MODULES, type TheoryModule } from "@/lib/curriculum";
import { describeMove } from "@/lib/learning";
import { playUci, pvToSan, sanOfUci } from "@/lib/lines";
import { formatEval, winPercentFromCp } from "@/lib/math";
import type { BoardThemeName, PieceSetName, Profile } from "@/lib/types";

type Stage = "idea" | "quiz" | "board" | "done";
const STEPS: { id: Stage; label: string }[] = [
  { id: "idea", label: "The idea" },
  { id: "quiz", label: "Check yourself" },
  { id: "board", label: "Try it" },
  { id: "done", label: "Take it away" },
];

export function LessonDesk({ module, profile, progress }: { module: TheoryModule; profile: Profile; progress: { bestScore: number; correct: number; attempts: number } | null }) {
  const notify = useToast();
  const [stage, setStage] = useState<Stage>("idea");
  const [quiz, setQuiz] = useState<number | null>(null);
  const [engine, setEngine] = useState<{ uci: string; san: string; cp: number | null; mate: number | null; line: string; win: number } | null>(null);
  const [engineBusy, setEngineBusy] = useState(false);
  const [engineError, setEngineError] = useState("");
  const [answer, setAnswer] = useState<{ correct: boolean; san: string; revealed?: boolean } | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const index = THEORY_MODULES.findIndex(item => item.id === module.id);
  const next = THEORY_MODULES[(index + 1) % THEORY_MODULES.length];
  const theme = profile.boardTheme as BoardThemeName;
  const pieceSet = profile.pieceSet as PieceSetName;

  const askStockfish = useCallback(async () => {
    setEngineBusy(true); setEngineError("");
    const sign = module.fen.split(" ")[1] === "w" ? 1 : -1;
    try {
      const lines = await getBrowserEngine().analyze(module.fen, 12);
      const best = lines[0];
      if (!best) throw new Error("No line");
      const cp = best.cp == null ? null : best.cp * sign;
      setEngine({ uci: best.uci, san: sanOfUci(module.fen, best.uci), cp, mate: best.mate, line: pvToSan(module.fen, best.pv, 6), win: best.mate ? (best.mate > 0 ? 100 : 0) : winPercentFromCp(cp ?? 0) });
    } catch {
      try {
        const response = await fetch("/api/position", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fen: module.fen, depth: 12 }) });
        const json = await response.json();
        const line = json.lines?.[0];
        if (!line) throw new Error("Engine busy");
        const cp = line.cp == null ? null : line.cp * sign;
        setEngine({ uci: line.uci, san: line.san || sanOfUci(module.fen, line.uci), cp, mate: line.mate, line: line.pvSan || line.san, win: line.mate ? (line.mate > 0 ? 100 : 0) : winPercentFromCp(cp ?? 0) });
      } catch { setEngineError("Stockfish is warming up. You can still try moves, or reload this step."); }
    } finally { setEngineBusy(false); }
  }, [module.fen]);

  useEffect(() => { if (stage === "board" && !engine && !engineBusy) void askStockfish(); }, [stage, engine, engineBusy, askStockfish]);

  function tryMove(uci: string) {
    const chess = new Chess(module.fen);
    let move: Move;
    try { move = playUci(chess, uci); } catch { return; }
    setAttempts(value => value + 1);
    const correct = Boolean(engine && (uci === engine.uci || (uci.length === 5 && uci.slice(0, 4) === engine.uci.slice(0, 4))));
    setAnswer({ correct, san: move.san });
  }
  function reveal() { if (!engine) return; setAnswer({ correct: false, san: engine.san, revealed: true }); setAttempts(v => v + 1); }

  async function finish() {
    setSaving(true);
    const score = Math.round(((quiz === module.quiz.correct ? 1 : 0) + (answer?.correct ? 1 : 0)) / 2 * 100);
    try {
      const response = await fetch("/api/theory/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ moduleId: module.id, correct: (quiz === module.quiz.correct ? 1 : 0) + (answer?.correct ? 1 : 0), attempts: attempts + 1, score }) });
      if (!response.ok) throw new Error("Couldn't save progress");
      setSaved(true); setStage("done"); notify("Lesson complete. Saved to your workspace.");
    } catch (error) { notify(error instanceof Error ? error.message : "Couldn't save progress.", "error"); }
    finally { setSaving(false); }
  }

  const stageIndex = STEPS.findIndex(step => step.id === stage);
  const boardArrows = answer?.revealed && engine ? [{ from: engine.uci.slice(0, 2), to: engine.uci.slice(2, 4), color: "#72ff68" }] : [];
  const sideToMove = module.fen.split(" ")[1] === "w" ? "White" : "Black";

  return <div className="lesson-page">
    <PageHeading
      eyebrow={`DAILY THEORY · LESSON ${index + 1} OF ${THEORY_MODULES.length}`}
      title={module.title}
      description={module.promise}
      action={<div className="row wrap"><span className="badge green">{module.category.toUpperCase()}</span><span className="badge">{module.minutes} MIN</span><Link href="/theory" className="button ghost small"><Icon name="back" size={13}/>All lessons</Link></div>}
    />

    <div className="lesson-steps" role="list" aria-label="Lesson progress">
      {STEPS.map((step, i) => <button key={step.id} type="button" className={`lesson-step-chip ${i === stageIndex ? "active" : ""} ${i < stageIndex ? "done" : ""}`} onClick={() => { if (i <= stageIndex) setStage(step.id); }} disabled={i > stageIndex}><span className="lesson-step-num">{i < stageIndex ? <Icon name="check" size={12}/> : String(i + 1).padStart(2, "0")}</span>{step.label}</button>)}
    </div>

    <div className="lesson-layout">
      <div className="board-panel lesson-board-panel">
        <div className="player-strip"><span className="game-avatar"><Icon name="knight" size={17}/></span><strong>Study position</strong><small>{sideToMove} to move</small><span className="turn-indicator"><i className="status-dot"/>{module.level}</span></div>
        <div className="board-frame"><Board fen={module.fen} theme={theme} pieceSet={pieceSet} orientation={module.fen.split(" ")[1] === "b" ? "black" : "white"} interactive={stage === "board" && !answer} arrows={boardArrows} onMove={tryMove}/></div>
        <div className="player-strip bottom"><span className="game-avatar"><Icon name="bulb" size={16}/></span><strong>{module.category}</strong><small>{module.tags.join(" · ")}</small></div>
        <p className="board-instruction">{stage === "board" ? "Tap a piece then its destination, or drag. Right-drag draws an arrow." : "The position for this lesson. It becomes playable at step 3."}</p>
      </div>

      <section className="card lesson-panel">
        <AnimatePresence mode="wait">
          <motion.div key={stage} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .22, ease: [.22, 1, .36, 1] }}>
            {stage === "idea" ? <>
              <p className="eyebrow"><span className="status-dot"/>STEP 1 · THE IDEA</p>
              <h2 className="lesson-title">What Stockfish is looking at</h2>
              <div className="concept-list">{module.concept.map((paragraph, i) => <div className="lesson-step" key={i}><span className="step-number">0{i + 1}</span><p>{paragraph}</p></div>)}</div>
              <div className="habit-box"><Icon name="bulb" size={18}/><div><strong>YOUR CHECKLIST</strong><ul>{module.checklist.map(item => <li key={item}>{item}</li>)}</ul></div></div>
              <button className="button primary full" onClick={() => setStage("quiz")}>I've got the idea <Icon name="arrow" size={14}/></button>
            </> : null}

            {stage === "quiz" ? <>
              <p className="eyebrow"><span className="status-dot"/>STEP 2 · CHECK YOURSELF</p>
              <h2 className="lesson-title">One question</h2>
              <p className="lesson-summary">{module.quiz.question}</p>
              <div className="quiz-options">{module.quiz.options.map((option, i) => <button key={option} type="button" className={`quiz-option ${quiz === i ? (i === module.quiz.correct ? "correct" : "wrong") : ""}`} disabled={quiz !== null} onClick={() => setQuiz(i)}>{String.fromCharCode(65 + i)}. {option}</button>)}</div>
              {quiz !== null ? <div className={`coach-note ${quiz === module.quiz.correct ? "good" : "info"}`}><strong>{quiz === module.quiz.correct ? "Exactly." : "Not quite."}</strong><p>{module.quiz.why}</p></div> : null}
              <button className="button primary full" disabled={quiz === null} onClick={() => setStage("board")}>Try it on the board <Icon name="arrow" size={14}/></button>
            </> : null}

            {stage === "board" ? <>
              <p className="eyebrow"><span className="status-dot"/>STEP 3 · TRY IT</p>
              <h2 className="lesson-title">{module.prompt}</h2>
              <p className="lesson-summary">{module.habit}</p>
              {engineBusy ? <p className="help row"><Spinner size={12}/>Asking Stockfish to translate this position…</p> : null}
              {engineError ? <p className="inline-error"><Icon name="info"/>{engineError}</p> : null}
              {engine ? <div className="engine-line"><strong>Stockfish's idea: {engine.san}</strong><span className="badge green">{engine.cp == null ? "forced line" : formatEval(engine.cp, engine.mate)}</span><p>{engine.line}</p></div> : null}
              {answer ? <div className={`theory-feedback ${answer.correct ? "correct" : "wrong"}`}><strong>{answer.revealed ? `Here is the idea: ${answer.san}.` : answer.correct ? `${answer.san} — you found it.` : `${answer.san} is playable, but there is a cleaner idea.`}</strong><p>{engine ? describeMove(module.fen, engine.uci).text : "Compare the piece's new square with where it started."}</p></div> : <p className="help">No timer. No rating at stake. Take your time, then reveal if you want.</p>}
              <div className="lesson-actions">
                {!answer?.revealed && engine ? <button className="button secondary" onClick={reveal} disabled={!engine}><Icon name="bulb" size={14}/>Show me the idea</button> : null}
                <button className="button primary" onClick={() => void finish()} disabled={saving}>{saving ? <Spinner/> : <Icon name="check" size={14}/>}Finish lesson</button>
              </div>
            </> : null}

            {stage === "done" ? <>
              <div className="complete-mark"><motion.div initial={{ scale: .6 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 280, damping: 16 }}><Icon name="check" size={40}/></motion.div></div>
              <p className="eyebrow"><span className="status-dot"/>STEP 4 · TAKE IT AWAY</p>
              <h2 className="lesson-title">Lesson complete.</h2>
              <div className="habit-box"><Icon name="shield" size={18}/><div><strong>THE HABIT TO KEEP</strong><p>{module.habit}</p></div></div>
              <p className="lesson-summary">{saved ? "Saved to your workspace — this streak appears on the Dashboard and the theory hub." : "Your progress is kept in the workspace database."}{progress?.bestScore ? ` Previous best: ${progress.bestScore}%.` : ""}</p>
              <div className="lesson-actions"><Link href={`/theory/lesson/${next.id}`} className="button primary">Next: {next.title} <Icon name="arrow" size={14}/></Link><Link href="/practice" className="button secondary">Find it in my games</Link><Link href="/theory" className="button ghost">All lessons</Link></div>
            </> : null}
          </motion.div>
        </AnimatePresence>
      </section>
    </div>
  </div>;
}
