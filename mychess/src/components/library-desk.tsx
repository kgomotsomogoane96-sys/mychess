"use client";

import { Chess } from "chess.js";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Board } from "@/components/board";
import { getBrowserEngine } from "@/components/browser-engine";
import { Icon, Modal, PageHeading, Spinner, useToast } from "@/components/ui";
import { formatEval } from "@/lib/math";
import { pvToSan, sanOfUci } from "@/lib/lines";
import { resultLabel } from "@/lib/pgn";
import { readEventStream } from "@/lib/sse-client";
import type { BoardThemeName, ReferenceGame } from "@/lib/types";

export function LibraryDesk({ items, total, page, pageSize, families, theme }: { items: ReferenceGame[]; total: number; page: number; pageSize: number; families: { name: string; count: number }[]; theme: BoardThemeName }) {
  const router = useRouter(); const pathname = usePathname(); const params = useSearchParams(); const notify = useToast();
  const [query, setQuery] = useState(params.get("q") ?? ""); const [selected, setSelected] = useState<ReferenceGame | null>(null);
  const [importing, setImporting] = useState("");
  function update(next: Record<string, string | null>) { const search = new URLSearchParams(params.toString()); for (const [key, value] of Object.entries(next)) { if (!value || value === "all") search.delete(key); else search.set(key, value); } if (!("page" in next)) search.delete("page"); router.push(`${pathname}?${search.toString()}`); }
  useEffect(() => { const timer = setTimeout(() => { if ((params.get("q") ?? "") !== query) update({ q: query || null }); }, 350); return () => clearTimeout(timer); }, [query]); // eslint-disable-line react-hooks/exhaustive-deps
  async function importMore(full = false) {
    setImporting("Checking public archives…");
    let imported = 0;
    try {
      for (let batch = 0; batch < 20; batch += 1) {
        let complete = false;
        let retry = 0;
        while (retry < 3) {
          const response = await fetch(`/api/reference/sync?full=${full ? 1 : 0}&reset=${batch === 0 ? 1 : 0}`, { cache: "no-store" });
          if (response.status === 409) { retry += 1; await new Promise(resolve => setTimeout(resolve, 1200)); continue; }
          await readEventStream(response, event => {
            if (event.message) setImporting(event.message);
            if (event.type === "error") throw new Error(event.message || "Import failed");
            if (event.type === "done") { imported += Number(event.imported ?? 0); complete = event.complete !== false; }
          });
          break;
        }
        if (retry >= 3) throw new Error("Another import is still running. Try again in a moment.");
        if (complete) break;
      }
      notify(`Reference library updated · ${imported.toLocaleString()} new games.`);
      router.refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Import failed.", "error");
    } finally { setImporting(""); }
  }
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <div>
    <PageHeading eyebrow="UNIVERSAL LIBRARY · PUBLIC GAMES" title="Chess beyond your own games." description={`${total.toLocaleString()} games from public elite-player archives, kept separate from your personal library. Replay the moments where strong players had to solve the same kinds of positions you face.`} action={<div className="row"><span className="badge green">{total.toLocaleString()} GAMES</span><button className="button primary" disabled={!!importing} onClick={() => void importMore()}><Icon name="refresh" size={14}/>Refresh library</button><button className="button ghost" disabled={!!importing} onClick={() => void importMore(true)}>Full import</button></div>}/>
    {importing ? <p className="sync-progress"><Spinner size={12}/>{importing}</p> : null}
    <div className="library-toolbar"><label className="search-field"><Icon name="search" size={16}/><input aria-label="Search elite games" placeholder="Player, opening, or event…" value={query} onChange={event => setQuery(event.target.value)}/>{query ? <button aria-label="Clear search" onClick={() => setQuery("")}><Icon name="close" size={14}/></button> : null}</label><select className="select" aria-label="Opening" value={params.get("opening") ?? "all"} onChange={event => update({ opening: event.target.value })}><option value="all">All openings</option>{families.map(family => <option key={family.name} value={family.name}>{family.name} ({family.count})</option>)}</select></div>
    <div className="card" style={{ padding: 0, overflow: "hidden" }}><div className="reference-table-head"><span>Players</span><span>Opening</span><span>Result</span><span>Date</span><span/></div><AnimatePresence>{items.map(game => <motion.button layout key={game.id} className="reference-row" onClick={() => setSelected(game)}><span><strong>{game.whiteName}</strong> <span className="muted">vs</span> <strong>{game.blackName}</strong><small>{game.whiteElo ?? ""} · {game.blackElo ?? ""}{game.tags[0] ? ` · ${game.tags[0]}` : ""}</small></span><span>{game.opening}<small>{game.eco ?? ""}</small></span><span>{resultLabel(game.result)}<small>{game.speed ?? ""}</small></span><span>{game.playedAt ? new Date(game.playedAt).toLocaleDateString() : "—"}</span><Icon name="chevron" size={15}/></motion.button>)}{!items.length ? <div className="empty">No games match. Try another search or refresh the library.</div> : null}</AnimatePresence></div>
    {pages > 1 ? <div className="pagination"><button className="button ghost small" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>Previous</button><span className="meta">Page {page} / {pages}</span><button className="button ghost small" disabled={page >= pages} onClick={() => update({ page: String(page + 1) })}>Next</button></div> : null}
    <p className="note" style={{ marginTop: 16 }}>These are public games from Chess.com's published player archives. This is a study reference library, not a complete database of every game ever played; it does not copy Lichess's or Chess.com's proprietary databases.</p>
    <ReferenceViewer game={selected} onClose={() => setSelected(null)} theme={theme}/>
  </div>;
}

function ReferenceViewer({ game, onClose, theme }: { game: ReferenceGame | null; onClose: () => void; theme: BoardThemeName }) {
  const replay = useMemo(() => { if (!game) return null; const chess = new Chess(); try { chess.loadPgn(game.pgn); } catch { return null; } const history = chess.history({ verbose: true }); return { fens: [game.initialFen, ...history.map(move => move.after)], sans: history.map(move => move.san), ucis: history.map(move => `${move.from}${move.to}${move.promotion ?? ""}`) }; }, [game]);
  const [ply, setPly] = useState(0); const [lines, setLines] = useState<{ san: string; eval: string; line: string }[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { setPly(game?.midgamePly ?? 0); setLines([]); setError(""); }, [game?.id]);
  const fen = replay?.fens[Math.min(ply, replay.fens.length - 1)] ?? game?.initialFen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  async function ask() {
    setBusy(true); setError("");
    try {
      const result = await getBrowserEngine().analyze(fen, 12);
      const sign = fen.split(" ")[1] === "w" ? 1 : -1;
      setLines(result.slice(0, 2).map(line => ({ san: sanOfUci(fen, line.uci), eval: line.mate != null ? formatEval(0, line.mate * sign) : line.cp != null ? formatEval(line.cp * sign) : "—", line: pvToSan(fen, line.pv, 7) })));
    } catch { setError("The browser engine isn't available right now. You can still replay the game."); }
    finally { setBusy(false); }
  }
  const last = ply > 0 ? replay?.ucis[ply - 1] : null;
  return <Modal open={Boolean(game)} onClose={onClose} title={game ? `${game.whiteName} vs ${game.blackName}` : ""} className="reference-modal"><div className="viewer-body"><div className="viewer-board"><Board fen={fen} theme={theme} orientation="white" lastMove={last ? { from: last.slice(0, 2), to: last.slice(2, 4) } : null}/><div className="transport"><button className="icon-button" aria-label="Start" onClick={() => setPly(0)}><Icon name="back" size={15}/></button><button className="icon-button" aria-label="Previous" onClick={() => setPly(v => Math.max(0, v - 1))}><Icon name="chevron" size={15} className="rotate-180"/></button><button className="icon-button" aria-label="Next" onClick={() => setPly(v => Math.min((replay?.sans.length ?? 0), v + 1))}><Icon name="chevron" size={15}/></button><button className="icon-button" aria-label="End" onClick={() => setPly(replay?.sans.length ?? 0)}><Icon name="next" size={15}/></button><span className="move-counter">{ply} / {replay?.sans.length ?? 0}</span></div><p className="board-instruction">{ply === 0 ? "Starting position" : `${Math.ceil(ply / 2)}${ply % 2 ? "." : "…"} ${replay?.sans[ply - 1] ?? ""}`} · {game?.opening ?? ""}</p></div>
      <div className="viewer-side"><p className="eyebrow">STUDY THIS POSITION</p><h3>What would a strong player do here?</h3><p className="help">Replay the game, then ask Stockfish to translate the position into a plan. The number is from the side to move.</p><button className="button primary full" onClick={() => void ask()} disabled={busy}>{busy ? <Spinner/> : <Icon name="knight" size={15}/>}{busy ? " Asking Stockfish…" : "Ask Stockfish"}</button>{error ? <p className="inline-error" style={{ marginTop: 10 }}><Icon name="info"/>{error}</p> : null}{lines.map((line, index) => <div className="engine-line" key={index}><div className="row spread"><strong>{index + 1}. {line.san}</strong><span className="badge green">{line.eval}</span></div><p>{line.line}</p></div>)}
        <div className="divider"/><div className="row wrap"><a className="button secondary small" href={`/play?fen=${encodeURIComponent(fen)}&label=${encodeURIComponent(game ? `${game.whiteName} vs ${game.blackName}` : "Elite game")}`}><Icon name="play" size={13}/>Play it out</a><a className="button ghost small" href={game?.externalUrl ?? "#"} target="_blank" rel="noreferrer"><Icon name="link" size={13}/>Original game</a></div></div></div></Modal>;
}
