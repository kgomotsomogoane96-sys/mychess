"use client";

import { useMemo } from "react";
import { CLASS_META, BAD_CLASSES } from "@/lib/labels";
import { formatEval, scoreToCp, winPercentFromCp } from "@/lib/math";
import type { AnalyzedMove, ClassName } from "@/lib/types";

/** Wintr/Chess.com-style ranking order, theory → brilliant. */
export const REPORT_ORDER: ClassName[] = ["book", "brilliant", "great", "best", "excellent", "good", "inaccuracy", "miss", "mistake", "blunder"];

const BADGE: Record<ClassName, { symbol: string; bg: string; fg: string; ring: string }> = {
  brilliant: { symbol: "!!", bg: "#14938f", fg: "#eafffd", ring: "#43d9d2" },
  great: { symbol: "!", bg: "#2f6fed", fg: "#f2f6ff", ring: "#7ea4ff" },
  best: { symbol: "★", bg: "#2f9e54", fg: "#f1fff6", ring: "#77d99b" },
  excellent: { symbol: "✓✓", bg: "#46b36c", fg: "#f0fff5", ring: "#89d9a5" },
  good: { symbol: "✓", bg: "#5c9d6c", fg: "#f2fff5", ring: "#8dc79b" },
  book: { symbol: "Bb", bg: "#a67c3d", fg: "#fff7e8", ring: "#d7b06a" },
  inaccuracy: { symbol: "?!", bg: "#d79c1c", fg: "#241900", ring: "#f0c25b" },
  mistake: { symbol: "?", bg: "#e07926", fg: "#fff6ef", ring: "#f2a468" },
  miss: { symbol: "✕", bg: "#d1544c", fg: "#fff2f1", ring: "#ef8c86" },
  blunder: { symbol: "??", bg: "#b9342c", fg: "#fff1f0", ring: "#e16b64" },
};

export function MoveBadge({ name, size = 22 }: { name: ClassName | string; size?: number }) {
  const key = (name in BADGE ? name : "good") as ClassName;
  const badge = BADGE[key];
  return <span
    className="move-badge"
    title={CLASS_META[key].label}
    style={{ "--badge-bg": badge.bg, "--badge-fg": badge.fg, "--badge-ring": badge.ring, width: size, height: size, fontSize: size * 0.42 } as React.CSSProperties}
    aria-label={CLASS_META[key].label}
  >{badge.symbol}</span>;
}

function EvalSpark({ moves }: { moves: AnalyzedMove[] }) {
  const points = moves.map(move => winPercentFromCp(scoreToCp(move.evalAfter, move.mateAfter)));
  const w = 280, h = 46;
  const d = points.map((p, i) => `${i ? "L" : "M"}${(i / Math.max(1, points.length - 1)) * w},${h - (p / 100) * h}`).join(" ");
  return <svg viewBox={`0 0 ${w} ${h}`} className="report-spark" role="img" aria-label="Evaluation sparkline"><path d={`${d} L${w},${h} L0,${h} Z`} fill="rgba(99,244,91,.12)"/><path d={d} fill="none" stroke="#63f45b" strokeWidth="2"/><line x1="0" x2={w} y1={h / 2} y2={h / 2} stroke="rgba(255,255,255,.12)" strokeDasharray="3 4"/></svg>;
}

export function MoveReport({ moves, accuracyWhite, accuracyBlack, currentPly, onJump, bestSingle }: {
  moves: AnalyzedMove[];
  accuracyWhite: number | null;
  accuracyBlack: number | null;
  currentPly: number;
  onJump: (ply: number) => void;
  bestSingle?: { ply: number; san: string; classification: ClassName } | null;
}) {
  const summary = useMemo(() => {
    const counts: Record<ClassName, { w: number; b: number }> = {
      brilliant: { w: 0, b: 0 }, great: { w: 0, b: 0 }, best: { w: 0, b: 0 }, excellent: { w: 0, b: 0 }, good: { w: 0, b: 0 },
      book: { w: 0, b: 0 }, inaccuracy: { w: 0, b: 0 }, mistake: { w: 0, b: 0 }, miss: { w: 0, b: 0 }, blunder: { w: 0, b: 0 },
    };
    for (const move of moves) counts[move.classification][move.color] += 1;
    return counts;
  }, [moves]);

  const worst = useMemo(() => [...moves].filter(m => BAD_CLASSES.has(m.classification)).sort((a, b) => b.cpLoss - a.cpLoss).slice(0, 3), [moves]);
  const brilliancy = useMemo(() => moves.find(m => m.classification === "brilliant") ?? bestSingle ?? null, [moves, bestSingle]);

  return <div className="report">
    <div className="report-head">
      <div>
        <p className="eyebrow" style={{ marginBottom: 6 }}>MOVE REPORT</p>
        <h2 className="report-title">Every move, ranked.</h2>
        <p className="help">Theory → brilliant. Tap any move to jump the board.</p>
      </div>
    </div>

    <div className="report-acc">
      <div className="report-acc-box"><strong>{accuracyWhite?.toFixed(1) ?? "—"}</strong><small>WHITE</small></div>
      <div className="report-acc-box black"><strong>{accuracyBlack?.toFixed(1) ?? "—"}</strong><small>BLACK</small></div>
    </div>

    <div className="report-spark-wrap"><EvalSpark moves={moves}/></div>

    <div className="report-table" role="table" aria-label="Move quality counts">
      <div className="report-row report-row-head" role="row"><span>Move quality</span><span>White</span><span/><span>Black</span></div>
      {REPORT_ORDER.map(name => {
        const meta = CLASS_META[name];
        const counts = summary[name];
        if (!counts.w && !counts.b) return null;
        return <div className="report-row" role="row" key={name}>
          <span className="report-label"><MoveBadge name={name} size={18}/>{meta.label}</span>
          <strong className="report-count">{counts.w}</strong>
          <MoveBadge name={name} size={20}/>
          <strong className="report-count">{counts.b}</strong>
        </div>;
      })}
    </div>

    {brilliancy ? <div className="report-callout good"><span className="report-callout-icon"><MoveBadge name={brilliancy.classification} size={22}/></span><div><strong>{brilliancy.ply % 2 ? `${Math.ceil(brilliancy.ply / 2)}.` : `${Math.ceil(brilliancy.ply / 2)}…`} {brilliancy.san}</strong><p>{CLASS_META[brilliancy.classification].blurb}</p></div></div> : null}
    {worst.length ? <div className="report-callout warn"><span className="report-callout-icon"><MoveBadge name={worst[0].classification} size={22}/></span><div><strong>The moment that mattered</strong><p>{CLASS_META[worst[0].classification].label} {worst[0].san} · {worst[0].cpLoss} centipawns. Your coach has the why.</p></div></div> : null}

    <div className="report-list" data-lenis-prevent>
      {Array.from({ length: Math.ceil(moves.length / 2) }, (_, i) => {
        const white = moves[i * 2], black = moves[i * 2 + 1];
        return <div className="report-pair" key={i}>
          <span className="report-num">{i + 1}.</span>
          {white ? <button type="button" className={`report-move ${currentPly === white.ply ? "active" : ""}`} onClick={() => onJump(white.ply)}><MoveBadge name={white.classification} size={18}/><span>{white.san}</span></button> : <span/>}
          {black ? <button type="button" className={`report-move ${currentPly === black.ply ? "active" : ""}`} onClick={() => onJump(black.ply)}><MoveBadge name={black.classification} size={18}/><span>{black.san}</span></button> : <span/>}
        </div>;
      })}
    </div>

    <details className="report-legend">
      <summary>How moves are ranked</summary>
      <p className="note">
        <strong>Theory</strong> matches known opening moves · <strong>Brilliant</strong> is a sound sacrifice · <strong>Great</strong> is the only move that holds ·
        <strong> Best</strong> is the engine's first choice · <strong>Excellent</strong> is within a whisker · <strong>Okay</strong> is solid ·
        <strong> Inaccuracy</strong> gives something small away · <strong>Miss</strong> passes a chance · <strong>Mistake</strong> hands over a real chance · <strong>Blunder</strong> swings the game.
        These are original heuristics on a public win-percent curve — they can disagree with other sites' private classifiers.
      </p>
    </details>
  </div>;
}

export { formatEval };
