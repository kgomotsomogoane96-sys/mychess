"use client";

import { Chess, type Square } from "chess.js";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { BOARD_THEMES, classMeta } from "@/lib/labels";
import { PIECE_NAMES } from "@/lib/learning";
import type { BoardThemeName, ClassName, PieceSetName } from "@/lib/types";

type Arrow = { from: string; to: string; color: string };
type PieceView = { id: string; color: string; type: string; square: string };
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const cell = (square: string, orientation: "white" | "black") => {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return { x: orientation === "white" ? file : 7 - file, y: orientation === "white" ? 7 - rank : rank };
};

export function Board({
  fen, orientation = "white", theme = "neon", pieceSet = "chessnut", interactive = false,
  lastMove, arrows = [], badge, onMove, highlight = [], annotate = true, annotateMode = false,
}: {
  fen: string; orientation?: "white" | "black"; theme?: BoardThemeName; pieceSet?: PieceSetName; interactive?: boolean;
  lastMove?: { from: string; to: string } | null; arrows?: Arrow[]; badge?: { square: string; classification: ClassName } | null;
  onMove?: (uci: string) => void; highlight?: string[]; annotate?: boolean; annotateMode?: boolean;
}) {
  const colors = BOARD_THEMES[theme] ?? BOARD_THEMES.neon;
  const chess = useMemo(() => new Chess(fen), [fen]);
  const turn = chess.turn();
  const reduce = useReducedMotion();
  const scope = useId().replace(/:/g, "");
  const boardRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const identities = useRef(new Map<string, PieceView>());
  const serial = useRef(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; square: string; piece: PieceView } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const [instant, setInstant] = useState<string | null>(null);
  const [userArrows, setUserArrows] = useState<Arrow[]>([]);
  const [userMarks, setUserMarks] = useState<string[]>([]);
  const [annotateFrom, setAnnotateFrom] = useState<string | null>(null);

  const pieces = useMemo<PieceView[]>(() => {
    const previous = identities.current; const next = new Map<string, PieceView>();
    if (lastMove) {
      const moved = previous.get(lastMove.from); const target = chess.get(lastMove.to as Square);
      if (moved && target && moved.color === target.color) next.set(lastMove.to, { ...moved, type: target.type, square: lastMove.to });
      if (moved?.type === "k" && Math.abs(lastMove.from.charCodeAt(0) - lastMove.to.charCodeAt(0)) === 2) {
        const rank = lastMove.from[1]; const kingSide = lastMove.to[0] === "g";
        const rook = previous.get(`${kingSide ? "h" : "a"}${rank}`); const rookSquare = `${kingSide ? "f" : "d"}${rank}`;
        if (rook && chess.get(rookSquare as Square)?.type === "r") next.set(rookSquare, { ...rook, square: rookSquare });
      }
    }
    for (const piece of chess.board().flat()) {
      if (!piece || next.has(piece.square)) continue;
      const old = previous.get(piece.square);
      next.set(piece.square, old && old.color === piece.color && old.type === piece.type ? { ...old, square: piece.square } : { id: `${scope}-${serial.current++}`, color: piece.color, type: piece.type, square: piece.square });
    }
    identities.current = next;
    return [...next.values()];
  }, [chess, lastMove?.from, lastMove?.to, scope]);

  const activeSquare = drag?.square ?? selected;
  const legal = useMemo(() => (activeSquare ? chess.moves({ square: activeSquare as Square, verbose: true }) : []), [chess, activeSquare]);
  const squares = useMemo(() => Array.from({ length: 64 }, (_, i) => `${FILES[orientation === "white" ? i % 8 : 7 - (i % 8)]}${orientation === "white" ? 8 - Math.floor(i / 8) : Math.floor(i / 8) + 1}`), [orientation]);
  const checkedKing = chess.isCheck() ? pieces.find(piece => piece.type === "k" && piece.color === turn)?.square : null;
  const pieceSrc = (color: string, type: string) => `/pieces/${pieceSet}/${color}${type.toUpperCase()}.svg`;

  const squareAt = useCallback((clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect(); if (!rect) return null;
    const x = Math.floor(((clientX - rect.left) / rect.width) * 8); const y = Math.floor(((clientY - rect.top) / rect.height) * 8);
    if (x < 0 || x > 7 || y < 0 || y > 7) return null;
    return `${FILES[orientation === "white" ? x : 7 - x]}${orientation === "white" ? 8 - y : y + 1}`;
  }, [orientation]);

  const attempt = useCallback((from: string, to: string, viaDrag = false) => {
    if (!onMove || from === to) { setSelected(null); return false; }
    const move = chess.moves({ square: from as Square, verbose: true }).find(item => item.to === to);
    if (!move) { setSelected(chess.get(to as Square)?.color === turn ? to : null); return false; }
    if (move.promotion) { setPromo({ from, to }); setSelected(null); return true; }
    if (viaDrag) { const piece = identities.current.get(from); if (piece) { setInstant(piece.id); setTimeout(() => setInstant(null), 60); } }
    setSelected(null); setUserArrows([]); setUserMarks([]); onMove(`${from}${to}`);
    return true;
  }, [chess, onMove, turn]);

  function clickSquare(square: string) {
    if (annotateMode) {
      if (!annotateFrom) { setAnnotateFrom(square); return; }
      if (annotateFrom === square) { setUserMarks(current => (current.includes(square) ? current.filter(item => item !== square) : [...current, square])); setAnnotateFrom(null); return; }
      setUserArrows(current => [...current.filter(arrow => !(arrow.from === annotateFrom && arrow.to === square)), { from: annotateFrom, to: square, color: "#63f45b" }]);
      setAnnotateFrom(null);
      return;
    }
    if (!interactive) return;
    if (selected && legal.some(move => move.to === square)) { attempt(selected, square); return; }
    setSelected(chess.get(square as Square)?.color === turn && selected !== square ? square : null);
  }

  function startDrag(event: React.PointerEvent, piece: PieceView) {
    if (!interactive || piece.color !== turn || event.button !== 0) return;
    // No preventDefault(): it would suppress the native click used for click-to-move.
    if (event.pointerType === "mouse") event.currentTarget.setPointerCapture?.(event.pointerId);
    const rect = boardRef.current?.getBoundingClientRect(); if (!rect) return;
    setDrag({ id: piece.id, square: piece.square, piece }); setHover(piece.square);
    const moveGhost = (x: number, y: number) => {
      if (ghostRef.current) ghostRef.current.style.transform = `translate3d(${x - rect.left - rect.width / 16}px, ${y - rect.top - rect.height / 16}px, 0)`;
    };
    moveGhost(event.clientX, event.clientY);
    const onPointerMove = (e: PointerEvent) => { moveGhost(e.clientX, e.clientY); const over = squareAt(e.clientX, e.clientY); setHover(current => (current === over ? current : over)); };
    const finish = (e: PointerEvent) => {
      window.removeEventListener("pointermove", onPointerMove); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", finish);
      const target = squareAt(e.clientX, e.clientY); setDrag(null); setHover(null);
      if (target && target !== piece.square) { if (!attempt(piece.square, target, true)) setSelected(null); }
      // A tap/click without movement is handled by the piece onClick (select/deselect).
    };
    window.addEventListener("pointermove", onPointerMove); window.addEventListener("pointerup", finish); window.addEventListener("pointercancel", finish);
  }

  /** chess.com-style annotations: right-drag = arrow, right-click = square mark. */
  function startAnnotate(event: React.PointerEvent) {
    if (!annotate || event.button !== 2) return;
    event.preventDefault();
    const from = squareAt(event.clientX, event.clientY); if (!from) return;
    const color = event.shiftKey ? "#ff7979" : event.altKey ? "#ffc768" : "#63f45b";
    let moved = false;
    const finish = (e: PointerEvent) => {
      window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", finish);
      const to = squareAt(e.clientX, e.clientY);
      if (!moved || !to || to === from) {
        setUserMarks(current => (current.includes(from) ? current.filter(square => square !== from) : [...current, from]));
        return;
      }
      setUserArrows(current => {
        const exists = current.some(arrow => arrow.from === from && arrow.to === to && arrow.color === color);
        return exists ? current.filter(arrow => !(arrow.from === from && arrow.to === to && arrow.color === color)) : [...current.filter(arrow => !(arrow.from === from && arrow.to === to)), { from, to, color }];
      });
    };
    const onMoveEvent = (e: PointerEvent) => { const to = squareAt(e.clientX, e.clientY); if (to && to !== from) moved = true; };
    window.addEventListener("pointermove", onMoveEvent);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  }

  useEffect(() => { if (!interactive) { setSelected(null); setDrag(null); } }, [interactive]);
  useEffect(() => { setSelected(null); setPromo(null); setUserArrows([]); setUserMarks([]); }, [fen]);

  const allArrows = [...arrows, ...userArrows];

  return <div
    ref={boardRef}
    className={`board ${drag ? "dragging" : ""} ${annotateMode ? "annotating" : ""}`}
    style={{ background: colors.frame }}
    role="group"
    aria-label={`Chessboard, ${turn === "w" ? "White" : "Black"} to move`}
    onPointerDown={startAnnotate}
    onContextMenu={event => event.preventDefault()}
  >
    <div className={`squares pieces-${pieceSet}`}>{squares.map(square => {
      const file = square.charCodeAt(0) - 97, rank = Number(square[1]) - 1; const dark = (file + rank) % 2 === 0;
      const piece = chess.get(square as Square); const canLand = legal.some(move => move.to === square);
      const tone = checkedKing === square ? "#c25a52" : dark ? colors.dark : colors.light;
      return <button key={square} type="button" className={`square ${hover === square && drag ? "hovered" : ""}`} data-square={square} disabled={!interactive} tabIndex={interactive ? 0 : -1} style={{ background: tone }} onClick={() => clickSquare(square)} aria-label={`${square}${piece ? `, ${piece.color === "w" ? "white" : "black"} ${PIECE_NAMES[piece.type]}` : ""}`} onKeyDown={event => { const delta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 }; if (delta[event.key] == null) return; event.preventDefault(); event.stopPropagation(); const index = squares.indexOf(square) + delta[event.key]; if (index >= 0 && index < 64) boardRef.current?.querySelector<HTMLButtonElement>(`[data-square="${squares[index]}"]`)?.focus(); }}>
        {lastMove && (lastMove.from === square || lastMove.to === square) ? <span className="square-tint" style={{ background: colors.last }} /> : null}
        {highlight.includes(square) ? <span className="square-tint" style={{ background: "rgba(140, 183, 255, .45)" }} /> : null}
        {userMarks.includes(square) ? <span className="square-mark" /> : null}
        {annotateFrom === square ? <span className="square-tint" style={{ background: "rgba(99,244,91,.45)" }} /> : null}
        {activeSquare === square ? <span className="square-tint" style={{ background: colors.select }} /> : null}
        {square[1] === (orientation === "white" ? "1" : "8") ? <span aria-hidden="true" className="coord file" style={{ color: dark ? colors.coord : colors.frame }}>{square[0]}</span> : null}
        {square[0] === (orientation === "white" ? "a" : "h") ? <span aria-hidden="true" className="coord rank" style={{ color: dark ? colors.coord : colors.frame }}>{square[1]}</span> : null}
        {canLand ? <i className={piece ? "ring" : "dot"} /> : null}
      </button>;
    })}</div>
    <div className="piece-layer"><AnimatePresence initial={false}>{pieces.map(piece => {
      const { x, y } = cell(piece.square, orientation); const grabbable = interactive && piece.color === turn;
      return <motion.div key={piece.id} layout={!reduce && instant !== piece.id ? "position" : false} initial={{ opacity: 0, scale: .6 }} animate={{ opacity: drag?.id === piece.id ? 0 : 1, scale: 1 }} exit={{ opacity: 0, scale: .4, transition: { duration: .18 } }} transition={reduce || instant === piece.id ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34, mass: .8 }} className={`board-piece ${grabbable ? "grabbable" : ""}`} data-square={piece.square} style={{ left: `${x * 12.5}%`, top: `${y * 12.5}%`, zIndex: lastMove?.to === piece.square ? 3 : 2 }} onPointerDown={event => startDrag(event, piece)} onClick={event => { event.stopPropagation(); clickSquare(piece.square); }}>
        <img src={pieceSrc(piece.color, piece.type)} alt="" draggable={false} />
      </motion.div>;
    })}</AnimatePresence></div>
    {drag ? <div ref={ghostRef} className="board-ghost" aria-hidden="true"><img src={pieceSrc(drag.piece.color, drag.piece.type)} alt="" /></div> : null}
    <svg className="arrows" viewBox="0 0 8 8" aria-hidden="true">
      <defs><marker id={`arrow-${scope}`} markerWidth="3.5" markerHeight="3.5" refX="2.4" refY="1.75" orient="auto"><path d="M0 0 3.5 1.75 0 3.5z" fill="context-stroke" /></marker></defs>
      {allArrows.map((arrow, index) => {
        const from = cell(arrow.from, orientation), to = cell(arrow.to, orientation);
        const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy) || 1;
        return <motion.line key={`${arrow.from}${arrow.to}${arrow.color}${index}`} initial={{ opacity: 0 }} animate={{ opacity: .92 }} x1={from.x + .5 + (dx / length) * .18} y1={from.y + .5 + (dy / length) * .18} x2={to.x + .5 - (dx / length) * .3} y2={to.y + .5 - (dy / length) * .3} stroke={arrow.color} strokeWidth=".17" strokeLinecap="round" markerEnd={`url(#arrow-${scope})`} />;
      })}
    </svg>
    {badge ? (() => { const { x, y } = cell(badge.square, orientation); const meta = classMeta(badge.classification); return <motion.span key={`${badge.square}-${badge.classification}`} initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} className="class-dot" style={{ left: `${x * 12.5 + 8.6}%`, top: `${y * 12.5 + .7}%`, background: meta.color, color: meta.ink }}>{meta.glyph}</motion.span>; })() : null}
    {promo ? <div className="promo" role="dialog" aria-label="Choose a promotion piece"><div>{["q", "r", "b", "n"].map(piece => <button key={piece} type="button" aria-label={`Promote to ${PIECE_NAMES[piece]}`} onClick={() => { const move = `${promo.from}${promo.to}${piece}`; setPromo(null); onMove?.(move); }}><img src={pieceSrc(turn, piece)} alt={PIECE_NAMES[piece]} /></button>)}<button type="button" className="promo-cancel" aria-label="Cancel promotion" onClick={() => setPromo(null)}>×</button></div></div> : null}
  </div>;
}
