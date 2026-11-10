"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MoveBadge } from "@/components/move-report";
import { Icon, Spinner } from "@/components/ui";
import { formatEval } from "@/lib/math";
import { buildNarrative, type BookMap } from "@/lib/game-narrative";
import type { GameView, Profile } from "@/lib/types";

type Filter = "all" | "mine" | "good" | "mistakes" | "key";

export function FullReview({ game, profile, onJump, onAnalyze, running, progress, status }: {
  game: GameView;
  profile: Profile;
  onJump: (ply: number) => void;
  onAnalyze: () => void;
  running: boolean;
  progress: number;
  status: string;
}) {
  const [book, setBook] = useState<BookMap>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [visible, setVisible] = useState(20);
  const [openPly, setOpenPly] = useState<number | null>(null);
  const started = useRef(false);

  useEffect(() => {
    let active = true;
    fetch("/api/opening-book")
      .then(response => response.json())
      .then(json => { if (active && json.book) setBook(json.book as BookMap); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  // Hit "review" and the engine starts automatically if needed.
  useEffect(() => {
    if (started.current) return;
    if (game.moves?.length || running || !["imported", "queued", "failed"].includes(status)) return;
    started.current = true;
    onAnalyze();
  }, [game.moves?.length, running, status, onAnalyze]);

  const narrative = useMemo(
    () => game.moves?.length ? buildNarrative(game.moves, book, profile) : [],
    [game.moves, book, profile],
  );

  const filtered = useMemo(() => narrative.filter(item => {
    if (filter === "mine") return !game.youColor || (game.youColor === "white" ? item.color === "w" : item.color === "b");
    if (filter === "good") return ["brilliant", "great", "best", "excellent"].includes(item.classification);
    if (filter === "mistakes") return ["inaccuracy", "miss", "mistake", "blunder"].includes(item.classification);
    if (filter === "key") return item.cpLoss >= 90 || ["brilliant", "great", "blunder"].includes(item.classification);
    return true;
  }), [narrative, filter, game.youColor]);

  const shown = filtered.slice(0, visible);
  const counts = useMemo(() => ({
    brilliant: narrative.filter(n => n.classification === "brilliant").length,
    best: narrative.filter(n => ["best", "great", "excellent"].includes(n.classification)).length,
    mistakes: narrative.filter(n => ["inaccuracy", "miss", "mistake", "blunder"].includes(n.classification)).length,
  }), [narrative]);

  return <div className="full-review">
    <div className="review-intro">
      <p className="eyebrow"><span className="status-dot"/>FULL GAME REVIEW · MOVE BY MOVE</p>
      <h2 className="report-title">Your coach reads the whole game.</h2>
      <p className="help">For every move: what it did on the board, what Stockfish thought, what you could have done instead, what to think about next time, and the replies most often played from that exact position.</p>
    </div>

    {!game.moves?.length ? <div className="game-summary-card">
      <span className="badge green">{running ? "ANALYZING" : "READY"}</span>
      <h2>{running ? "Stockfish is reading the game." : "Start the engine review."}</h2>
      <p>One analysis pass gives the coach every evaluation and best move it needs to explain the whole game.</p>
      {running ? <><div className="progress"><span style={{ width: `${progress}%` }}/></div><p className="meta">{progress}% · depth {profile.bulkDepth}</p></> : <button className="button primary" onClick={onAnalyze}><Icon name="spark" size={14}/>Review with Stockfish</button>}
    </div> : <>
      <div className="review-stat-row">
        <div><strong>{narrative.length}</strong><small>MOVES EXPLAINED</small></div>
        <div><strong>{counts.best}</strong><small>STRONG CHOICES</small></div>
        <div><strong>{counts.mistakes}</strong><small>TO LEARN FROM</small></div>
        <div><strong>{counts.brilliant}</strong><small>BRILLIANT</small></div>
      </div>

      <div className="segmented review-filters">
        {([["all", "All moves"], ["mine", "My moves"], ["good", "What I did right"], ["mistakes", "Mistakes"], ["key", "Key moments"]] as const).map(([id, label]) =>
          <button key={id} className={filter === id ? "selected" : ""} onClick={() => { setFilter(id as Filter); setVisible(20); }}>{label}</button>
        )}
      </div>

      <div className="review-entries">
        <AnimatePresence initial={false}>
          {shown.map(item => {
            const expanded = openPly === item.ply;
            return <motion.article
              layout
              key={item.ply}
              className={`review-entry ${expanded ? "expanded" : ""}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: .28, ease: [.22, 1, .36, 1] }}
            >
              <button type="button" className="review-entry-head" onClick={() => setOpenPly(expanded ? null : item.ply)} aria-expanded={expanded}>
                <span className="review-entry-num">{item.moveNumber}</span>
                <MoveBadge name={item.classification} size={22}/>
                <strong>{item.san}</strong>
                <span className="review-entry-label">{item.label}</span>
                <span className="review-entry-eval">{formatEval(item.evalAfter)}</span>
                <Icon name={expanded ? "down" : "chevron"} size={14}/>
              </button>
              {expanded ? <motion.div className="review-entry-body" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ duration: .25 }}>
                <div className="coach-block"><span className="coach-block-num">01</span><div><h4>What the move did</h4><p>{item.what}</p></div></div>
                <div className="coach-block"><span className="coach-block-num">02</span><div><h4>What Stockfish saw</h4><p>{item.engine}</p></div></div>
                <div className="coach-block"><span className="coach-block-num">03</span><div><h4>{["best", "great", "brilliant", "book"].includes(item.classification) ? "Why it works" : "What you could have done"}</h4><p>{item.alternative}</p></div></div>
                <div className="coach-block"><span className="coach-block-num">04</span><div><h4>What to think about next time</h4><ul>{item.think.map(thought => <li key={thought}>{thought}</li>)}</ul></div></div>
                {item.replies.length ? <div className="coach-block"><span className="coach-block-num">05</span><div><h4>When they answer from this position</h4><p className="book-intro">Most played replies in the game database:</p>{item.replies.map(reply => <p className="book-reply" key={reply.san}><span className="book-san">{reply.san}</span><span className="book-count">{reply.count.toLocaleString()}×</span><span>{reply.plan}</span></p>)}</div></div> : null}
                <div className="review-verdict"><Icon name="bulb" size={16}/><p>{item.verdict}</p></div>
                <div className="review-entry-actions">
                  <button className="button secondary small" onClick={() => onJump(item.ply)}><Icon name="board" size={13}/>Show on board</button>
                  <Link className="button ghost small" href={`/play?fen=${encodeURIComponent(item.fen)}&game=${game.id}`}><Icon name="play" size={12}/>Play it out</Link>
                  <Link className="button ghost small" href="/practice"><Icon name="target" size={12}/>Practice the idea</Link>
                </div>
              </motion.div> : null}
            </motion.article>;
          })}
        </AnimatePresence>
        {!shown.length ? <p className="empty">No moves in that filter yet.</p> : null}
      </div>
      {visible < filtered.length ? <button className="button ghost full" style={{ marginTop: 12 }} onClick={() => setVisible(v => v + 20)}>Show next 20 moves <Icon name="down" size={14}/></button> : null}
      <details className="report-legend"><summary>How this review is written</summary><p className="note">Board facts come from chess.js, evaluations from Stockfish at depth {game.depth ?? profile.bulkDepth}, and the most-played replies from your imported games plus the public masters explorer when reachable. The explanations are original heuristics and can disagree with a proprietary site's classifier. Accuracy is a study score, not a rating.</p></details>
    </>}
  </div>;
}
