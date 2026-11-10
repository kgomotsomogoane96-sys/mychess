"use client";

import { Chess } from "chess.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Board } from "@/components/board";
import { Icon, PageHeading } from "@/components/ui";
import { resultLabel } from "@/lib/pgn";
import type { ColorName, OpeningFamilyRow, OpeningNode } from "@/lib/types";

type Sample = { id: string; opening: string; result: string; youColor: ColorName | null; playedAt: string | null };
const pct = (node: OpeningNode) => (node.games ? Math.round(((node.wins + node.draws / 2) / node.games) * 100) : 0);

export function OpeningsDesk({ families, color, selected, tree, weak, sample, scopeLabel, total }: { families: OpeningFamilyRow[]; color: ColorName; selected: string | null; tree: OpeningNode; weak: { line: string[]; games: number; score: number; yours: boolean }[]; sample: Sample[]; scopeLabel: string; total: number }) {
  const router = useRouter();
  const [path, setPath] = useState<string[]>([]);
  const [explorer, setExplorer] = useState<{ san: string; games: number; white: number; draws: number; black: number }[]>([]); const [explorerDown, setExplorerDown] = useState(false);
  const [sort, setSort] = useState<"games" | "score">("games");
  useEffect(() => { setPath([]); }, [selected, color]);
  const node = useMemo(() => path.reduce<OpeningNode | undefined>((current, san) => current?.children.find(child => child.san === san), tree) ?? tree, [tree, path]);
  const fen = useMemo(() => { const chess = new Chess(); for (const san of path) { try { chess.move(san); } catch { break; } } return chess.fen(); }, [path]);
  useEffect(() => { const controller = new AbortController(); fetch(`/api/explorer?fen=${encodeURIComponent(fen)}`, { signal: controller.signal }).then(r => r.json()).then(json => { setExplorer(json.moves ?? []); setExplorerDown(Boolean(json.unavailable)); }).catch(() => setExplorerDown(true)); return () => controller.abort(); }, [fen]);
  const rows = families.filter(row => row.color === color).sort((a, b) => (sort === "score" ? a.score - b.score || b.games - a.games : b.games - a.games));
  const current = families.find(row => row.color === color && row.key === selected);
  const yourMove = (color === "white") === (path.length % 2 === 0);
  return <div>
    <PageHeading eyebrow={`OPENINGS · ${scopeLabel.toUpperCase()}`} title="Your repertoire, measured." description="Every opening you actually play, scored from your own results. Open one to walk the branches, find where the score drops, and compare with master games." action={<div className="segmented">{(["white", "black"] as ColorName[]).map(item => <button key={item} className={color === item ? "selected" : ""} onClick={() => router.push(`/openings?color=${item}`)}>As {item}</button>)}</div>}/>
    <div className="openings-layout">
      <section className="card openings-table">
        <div className="row spread" style={{ marginBottom: 10 }}><h2 className="card-title" style={{ margin: 0 }}>As {color}</h2><div className="segmented"><button className={sort === "games" ? "selected" : ""} onClick={() => setSort("games")}>Most played</button><button className={sort === "score" ? "selected" : ""} onClick={() => setSort("score")}>Weakest</button></div></div>
        <div className="family-list" data-lenis-prevent>{rows.map(row => <button key={row.key} className={`family-row ${row.key === selected ? "active" : ""}`} onClick={() => router.push(`/openings?color=${color}&family=${encodeURIComponent(row.key)}`)}><span className="family-name"><strong>{row.label}</strong><small>{row.eco ?? ""} · {row.games} games{row.accuracy != null ? ` · ${row.accuracy}% acc.` : ""}</small></span><span className="score-bar" aria-hidden="true"><i style={{ width: `${row.score}%`, background: row.score >= 52 ? "var(--lime)" : row.score < 46 ? "var(--red)" : "var(--amber)" }}/></span><strong className={row.score >= 52 ? "lime" : row.score < 46 ? "red" : ""}>{row.score}%</strong></button>)}{!rows.length ? <p className="empty">No games as {color} yet.</p> : null}</div>
      </section>
      <section className="openings-detail">
        {current ? <>
          <div className="card">
            <div className="row spread wrap"><div><p className="eyebrow">{current.eco ?? "OPENING"} · {total} GAMES</p><h2 className="card-title" style={{ fontSize: 24 }}>{current.label}</h2></div><div className="row"><span className="badge green">{current.wins}W</span><span className="badge amber">{current.draws}D</span><span className="badge red">{current.losses}L</span></div></div>
            <div className="line-explorer">
              <div className="line-board"><Board fen={fen} orientation={color} theme="neon"/><div className="row wrap" style={{ marginTop: 10 }}><Link href={`/play?fen=${encodeURIComponent(fen)}&label=${encodeURIComponent(current.label)}`} className="button primary small"><Icon name="play" size={13}/>Play from here</Link><Link href={`/games?color=${color}&opening=${encodeURIComponent(current.key)}`} className="button ghost small">Games in this line</Link></div></div>
              <div className="line-moves">
                <div className="breadcrumbs"><button className={path.length ? "" : "active"} onClick={() => setPath([])}>Start</button>{path.map((san, index) => <button key={`${san}${index}`} className={index === path.length - 1 ? "active" : ""} onClick={() => setPath(path.slice(0, index + 1))}>{index % 2 === 0 ? `${index / 2 + 1}.` : ""}{san}</button>)}</div>
                <p className="help">{yourMove ? "Your moves from here" : "What opponents play here"} · {node.games} games reached this position</p>
                <div className="branch-list">{node.children.map(child => <button key={child.san} className="branch-row" onClick={() => setPath([...path, child.san])}><strong>{child.san}</strong><span className="branch-bar"><i className="w" style={{ width: `${(child.wins / child.games) * 100}%` }}/><i className="d" style={{ width: `${(child.draws / child.games) * 100}%` }}/><i className="l" style={{ width: `${(child.losses / child.games) * 100}%` }}/></span><small>{child.games} games</small><strong className={pct(child) >= 52 ? "lime" : pct(child) < 46 ? "red" : ""}>{pct(child)}%</strong></button>)}{!node.children.length ? <p className="help">The line fans out from here. Open the games to see how they went.</p> : null}</div>
                <div className="divider"/>
                <p className="eyebrow">MASTERS PLAY</p>
                {explorer.length ? <div className="branch-list compact">{explorer.slice(0, 5).map(move => <div key={move.san} className="branch-row static"><strong>{move.san}</strong><span className="branch-bar"><i className="w" style={{ width: `${(move.white / move.games) * 100}%` }}/><i className="d" style={{ width: `${(move.draws / move.games) * 100}%` }}/><i className="l" style={{ width: `${(move.black / move.games) * 100}%` }}/></span><small>{move.games.toLocaleString()} games</small></div>)}</div> : <p className="help">{explorerDown ? "The Lichess master database is not reachable from here right now, so this section is empty. Your own branches above are still exact." : "No master games for this exact position."}</p>}
              </div>
            </div>
          </div>
          <div className="dash-grid two" style={{ marginTop: 14 }}>
            <div className="card"><h3 className="card-title">Where the score drops</h3><p className="help" style={{ marginBottom: 12 }}>Branches with at least six games, sorted by your worst results. The move in bold is where that line starts to go wrong.</p>{weak.length ? weak.map(branch => <button key={branch.line.join(" ")} className="weak-branch" onClick={() => setPath(branch.line)}><span className="mono">{branch.line.map((san, index) => `${index % 2 === 0 ? `${index / 2 + 1}.` : ""}${san}`).join(" ")}</span><span className={`badge ${branch.score < 40 ? "red" : "amber"}`}>{branch.score}% · {branch.games}</span></button>) : <p className="help">Not enough repeated lines yet to isolate a weak branch.</p>}</div>
            <div className="card"><h3 className="card-title">Recent games in this opening</h3><div className="recent-list">{sample.map(game => <Link key={game.id} href={`/review/${game.id}`} className="game-row"><span className="game-avatar"><Icon name="board" size={16}/></span><span className="game-row-info"><strong>{game.opening}</strong><p>{game.playedAt ? new Date(game.playedAt).toLocaleDateString() : ""}</p></span><span className={`badge ${resultLabel(game.result, game.youColor) === "Win" ? "green" : resultLabel(game.result, game.youColor) === "Loss" ? "red" : "amber"}`}>{resultLabel(game.result, game.youColor)}</span></Link>)}</div></div>
          </div>
        </> : <div className="empty-state"><Icon name="study" size={36}/><h2>Pick an opening on the left.</h2><p>You'll see your branches, your weak spots, and what masters play from the same position.</p></div>}
      </section>
    </div>
  </div>;
}
