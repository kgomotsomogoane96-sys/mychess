"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Board } from "@/components/board";
import { Icon, PageHeading } from "@/components/ui";
import { OPENINGS, fenFromOpening, type OpeningLesson } from "@/lib/openings-curriculum";
import type { Profile } from "@/lib/types";

type Mode = "mainline" | string; // sidebar id

export function OpeningTrainer({ profile }: { profile: Profile }) {
  const [query, setQuery] = useState("");
  const [side, setSide] = useState<"all" | "white" | "black">("all");
  const [selectedId, setSelectedId] = useState(OPENINGS[0].id);
  const [ply, setPly] = useState(0);
  const [mode, setMode] = useState<Mode>("mainline");
  const [sidelinePly, setSidelinePly] = useState(0);

  const list = useMemo(() => {
    const needle = query.toLowerCase();
    return OPENINGS.filter(item => (side === "all" || item.side === side) && (!needle || item.name.toLowerCase().includes(needle) || item.eco.toLowerCase().includes(needle) || item.family.toLowerCase().includes(needle)));
  }, [query, side]);

  const lesson = useMemo(() => OPENINGS.find(item => item.id === selectedId) ?? OPENINGS[0], [selectedId]);
  const sideline = mode !== "mainline" ? lesson.sidelines.find(s => s.name === mode) : null;
  const lineMoves = sideline ? sideline.moves : lesson.mainline.map(m => m.san);
  const notes = sideline
    ? sideline.moves.map(san => ({ san, note: "" }))
    : lesson.mainline;
  const currentPly = sideline ? sidelinePly : ply;
  const setPlySafe = sideline ? setSidelinePly : setPly;
  const fen = fenFromOpening(lesson, currentPly, lineMoves);
  const currentNote = sideline ? (currentPly === sideline.moves.length ? sideline.note : sideline.moves[currentPly - 1] ? `Play ${sideline.moves[currentPly - 1]} — part of ${sideline.name}.` : `Starting position of the ${sideline.name}.`) : notes[currentPly - 1]?.note ?? "Starting position. Step through to see the idea move by move.";

  return <div>
    <PageHeading
      eyebrow="OPENING THEORY · MAINLINE & SIDELINES"
      title="Learn the ideas, not just the moves."
      description="Every major opening, taught by the coach: what the move is trying to do, the main line you'll face most, and the sidelines that decide club games. Pick an opening and walk through it move by move."
      action={<div className="row wrap"><span className="badge green">{OPENINGS.length} OPENINGS</span><span className="badge">MAINLINE + SIDELINES</span></div>}
    />
    <div className="opening-trainer">
      <aside className="card trainer-list" data-lenis-prevent>
        <label className="search-field"><Icon name="search" size={15}/><input aria-label="Search openings" placeholder="Search openings…" value={query} onChange={e => setQuery(e.target.value)}/></label>
        <div className="segmented" style={{ margin: "12px 0" }}>{(["all","white","black"] as const).map(s => <button key={s} className={side === s ? "selected" : ""} onClick={() => setSide(s)}>{s === "all" ? "All" : s === "white" ? "As White" : "As Black"}</button>)}</div>
        <div className="trainer-items">{list.map(item => <button key={item.id} type="button" className={`trainer-item ${item.id === selectedId ? "active" : ""}`} onClick={() => { setSelectedId(item.id); setMode("mainline"); setPly(0); setSidelinePly(0); }}>
          <span className="trainer-eco">{item.eco}</span>
          <span className="trainer-name">{item.name}<small>{item.side} · {item.level} · {item.family}</small></span>
          <Icon name="chevron" size={13}/>
        </button>)}</div>
      </aside>

      <section className="card trainer-stage">
        <AnimatePresence mode="wait">
          <motion.div key={`${lesson.id}-${mode}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .22 }}>
            <div className="row spread wrap">
              <div>
                <p className="eyebrow" style={{ marginBottom: 6 }}>{lesson.eco} · {lesson.side === "white" ? "WHITE REPERTOIRE" : "BLACK REPERTOIRE"} · {lesson.level.toUpperCase()}</p>
                <h2 className="lesson-title" style={{ marginTop: 0 }}>{lesson.name}</h2>
              </div>
              <Link className="button primary small" href={`/play?fen=${encodeURIComponent(fen)}&label=${encodeURIComponent(lesson.name)}`}><Icon name="play" size={13}/>Practice this position</Link>
            </div>
            <p className="lesson-summary">{lesson.blurb}</p>

            <div className="trainer-tabs">
              <button type="button" className={`trainer-tab ${mode === "mainline" ? "active" : ""}`} onClick={() => { setMode("mainline"); setPly(0); }}><Icon name="study" size={14}/>Mainline</button>
              {lesson.sidelines.map(s => <button key={s.name} type="button" className={`trainer-tab ${mode === s.name ? "active" : ""}`} onClick={() => { setMode(s.name); setSidelinePly(0); }}><Icon name="list" size={14}/>{s.name}</button>)}
            </div>

            <div className="trainer-board">
              <div className="trainer-board-frame">
                <Board fen={fen} theme={profile.boardTheme} pieceSet={profile.pieceSet} orientation={lesson.side === "black" ? "black" : "white"} />
              </div>
              <div className="trainer-coach">
                <div className="report-callout good"><span className="report-callout-icon"><Icon name="bulb" size={20}/></span><div><strong>{sideline ? sideline.name : currentPly === 0 ? "The plan" : `Move ${currentPly} of ${lineMoves.length}`}</strong><p>{currentNote}</p></div></div>
                <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                  <button type="button" className="button secondary small" onClick={() => setPlySafe(Math.max(0, currentPly - 1))}><Icon name="chevron" size={13} className="rotate-180"/>Back</button>
                  <button type="button" className="button primary small" onClick={() => setPlySafe(Math.min(lineMoves.length, currentPly + 1))}>Next move<Icon name="chevron" size={13}/></button>
                  <button type="button" className="button ghost small" onClick={() => setPlySafe(lineMoves.length)}>Show full line</button>
                </div>
                <div className="trainer-line" data-lenis-prevent>
                  {lineMoves.map((san, i) => <button key={`${san}-${i}`} type="button" className={`trainer-chip ${currentPly === i + 1 ? "active" : ""}`} onClick={() => setPlySafe(i + 1)}>
                    <span className="mono">{i % 2 === 0 ? `${i / 2 + 1}.` : "…"}</span>{san}
                  </button>)}
                </div>
                {!sideline ? <div className="report-callout warn"><span className="report-callout-icon"><Icon name="target" size={20}/></span><div><strong>Why this line works</strong><p>Step through the mainline slowly. The notes explain what each move is trying to achieve — that's what survives when your opponent plays something unexpected.</p></div></div> : <div className="report-callout warn"><span className="report-callout-icon"><Icon name="info" size={20}/></span><div><strong>Sideline focus</strong><p>{sideline.note}</p></div></div>}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </section>
    </div>
  </div>;
}
