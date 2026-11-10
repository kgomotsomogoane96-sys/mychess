"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Icon, PageHeading, Spinner, useToast } from "@/components/ui";
import { Board } from "@/components/board";
import { ERA_LABELS, TIER_LABELS, tierFromGame, type Era } from "@/lib/hall-of-fame";
import type { Profile, ReferenceGame } from "@/lib/types";

type GameWithFlags = ReferenceGame & { era?: string | null; tier?: string | null; story?: string | null };

const TIER_COLOR: Record<string, string> = { legendary: "#e2b56a", masterpiece: "#c1a3ff", elite: "#63f45b", club: "#8b938d" };

export function GreatGamesDesk({ items, total, page, pageSize, scopeLabel, profile }: {
  items: GameWithFlags[]; total: number; page: number; pageSize: number; scopeLabel: string; profile: Profile;
}) {
  const router = useRouter(); const pathname = usePathname(); const params = useSearchParams();
  const notify = useToast();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [studying, setStudying] = useState<string | null>(null);
  const [selected, setSelected] = useState<GameWithFlags | null>(null);
  const get = (key: string) => params.get(key) ?? "all";

  function update(next: Record<string, string | null>) {
    const search = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "all") search.delete(key); else search.set(key, value);
    }
    if (!("page" in next)) search.delete("page");
    router.push(`${pathname}?${search.toString()}`);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if ((params.get("q") ?? "") !== query) update({ q: query || null });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  /** Import the PGN into your library, then open the full coach report. */
  async function study(game: GameWithFlags) {
    setStudying(game.id);
    try {
      const response = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pgn: game.pgn, source: "master" }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Couldn't open this game.");
      const saved = json.saved?.[0];
      if (!saved?.id) throw new Error("No game was saved.");
      notify("Opening the full coach report — move ranking, engine, notes.");
      router.push(`/review/${saved.id}?run=1`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Couldn't study this game.", "error");
      setStudying(null);
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <div>
    <PageHeading
      eyebrow={`GREAT GAMES · ${scopeLabel.toUpperCase()}`}
      title="Chess history, ranked and playable."
      description="Legendary classics and elite master games, classified by era and quality. Open any game for the full coach report: move-by-move ranking, engine lines, notes — the same study experience as your own games."
      action={<div className="row wrap"><span className="badge green">{total.toLocaleString()} GAMES</span><Link href="/library" className="button ghost small"><Icon name="grid" size={13}/>Modern library</Link></div>}
    />

    <div className="hero-grid" style={{ gridTemplateColumns: "minmax(0,1.35fr) minmax(0,1fr)", marginBottom: 18 }}>
      <div className="card" style={{ padding: 22 }}>
        <p className="eyebrow"><span className="status-dot"/>HALL OF FAME</p>
        <h2 style={{ fontSize: 30, fontWeight: 500, lineHeight: 1.05, margin: "10px 0 12px" }}>The four games every serious player studies.</h2>
        <div className="hall-grid">
          {[
            { id: "hall-opera-1858", title: "The Opera Game", meta: "Morphy · 1858 · Legendary" },
            { id: "hall-immortal-1851", title: "The Immortal Game", meta: "Anderssen · 1851 · Legendary" },
            { id: "hall-evergreen-1852", title: "The Evergreen Game", meta: "Anderssen · 1852 · Masterpiece" },
            { id: "hall-century-1956", title: "Game of the Century", meta: "Fischer · 1956 · Masterpiece" },
          ].map(game => {
            const target = items.find(item => item.id === game.id) ?? items.find(item => item.whiteName.includes(game.meta.split(" ")[0]));
            return <button key={game.id} type="button" className="hall-card" onClick={() => { const found = items.find(item => item.id === game.id); if (found) setSelected(found); else update({ q: game.title.split(" ").slice(1).join(" ") }); }}>
              <span className="hall-badge"><Icon name="trophy" size={14}/></span>
              <strong>{game.title}</strong>
              <small>{game.meta}</small>
              <span className="hall-cta">Study with coach <Icon name="arrow" size={12}/></span>
            </button>;
          })}
        </div>
        <p className="note" style={{ marginTop: 14 }}>The classics are curated public-domain games with full move text. The rest of the library comes from public elite archives and is tagged by era and quality automatically.</p>
      </div>
      <div className="card" style={{ padding: 22 }}>
        <p className="eyebrow"><span className="status-dot"/>HOW TO USE THIS</p>
        <h3 style={{ fontSize: 22, fontWeight: 500, margin: "10px 0" }}>Study like a grandmaster.</h3>
        <div className="study-path">
          <div><span className="study-step">01</span><p><strong>Pick an era or quality tier.</strong> Start with legendary games — the patterns repeat at every level.</p></div>
          <div><span className="study-step">02</span><p><strong>Guess the move</strong> before stepping through. Your report will show you which decisions matter.</p></div>
          <div><span className="study-step">03</span><p><strong>Open the coach report</strong> for the full move ranking from theory to brilliant, with the why behind each decision.</p></div>
          <div><span className="study-step">04</span><p><strong>Practice the positions</strong> — every studied game feeds your personal practice queue.</p></div>
        </div>
      </div>
    </div>

    <div className="library-toolbar">
      <label className="search-field"><Icon name="search" size={16}/><input aria-label="Search great games" placeholder="Search by player, opening, or event…" value={query} onChange={e => setQuery(e.target.value)}/></label>
      <select className="select" aria-label="Era" value={get("era")} onChange={e => update({ era: e.target.value })}>
        <option value="all">All eras</option>
        {ERA_LABELS.map(era => <option key={era} value={era}>{era}</option>)}
      </select>
      <select className="select" aria-label="Quality" value={get("tier")} onChange={e => update({ tier: e.target.value })}>
        <option value="all">All quality</option>
        {Object.entries(TIER_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
    </div>
    <div className="filter-chips">
      {[["all", "All"] as const, ...ERA_LABELS.map(era => [era, era] as const)].map(([value, label]) => <button key={value} className={get("era") === value ? "active" : ""} onClick={() => update({ era: value })}>{label}</button>)}
    </div>

    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="reference-table-head"><span>Game</span><span>Era</span><span>Quality</span><span>Opening</span><span/></div>
      <AnimatePresence>
        {items.map(game => {
          const tier = game.tier ?? tierFromGame({ whiteElo: game.whiteElo, blackElo: game.blackElo, tags: game.tags ?? [] });
          return <motion.button layout key={game.id} className="reference-row" onClick={() => setSelected(game)}><span><strong>{game.whiteName}</strong> <span className="muted">vs</span> <strong>{game.blackName}</strong><small>{game.event ?? game.source}</small></span><span>{game.era ?? "unknown"}</span><span><span className="tier-pill" style={{ background: `${TIER_COLOR[tier]}22`, color: TIER_COLOR[tier] }}>{TIER_LABELS[tier] ?? tier}</span></span><span>{game.opening}</span><Icon name="chevron" size={14}/></motion.button>;
        })}
      </AnimatePresence>
      {!items.length ? <div className="empty">No games match those filters.</div> : null}
    </div>

    {pages > 1 ? <div className="pagination"><button className="button ghost small" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>Previous</button><span className="meta">Page {page} / {pages}</span><button className="button ghost small" disabled={page >= pages} onClick={() => update({ page: String(page + 1) })}>Next</button></div> : null}

    {selected ? <div className="report-callout good" style={{ marginTop: 18, alignItems: "center" }}>
      <div style={{ flex: 1 }}><strong>{selected.whiteName} vs {selected.blackName}</strong><p>{(selected as { story?: string }).story || `${selected.event ?? "Public archive"} · ${selected.opening} · ${selected.era ?? ""}`}</p></div>
      <button className="button primary" onClick={() => void study(selected)} disabled={studying === selected.id}>{studying === selected.id ? <Spinner/> : <Icon name="spark" size={14}/>}Study with coach</button>
      <button className="button ghost" onClick={() => setSelected(null)}><Icon name="close" size={14}/></button>
    </div> : null}
  </div>;
}
