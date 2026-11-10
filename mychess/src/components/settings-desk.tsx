"use client";

import { Chess } from "chess.js";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Board } from "@/components/board";
import { DeploymentStatus } from "@/components/deployment-status";
import { useAccountSync, useImport } from "@/components/import-dialog";
import { Icon, Modal, PageHeading, Spinner, Toggle, useToast } from "@/components/ui";
import { playUci } from "@/lib/lines";
import type { AccountView, BoardThemeName, Profile } from "@/lib/types";

const THEMES: { id: BoardThemeName; name: string; color: string }[] = [{ id: "neon", name: "Match green", color: "#4b6855" }, { id: "sage", name: "Sage", color: "#7d9a76" }, { id: "ice", name: "Ice blue", color: "#7f97b0" }, { id: "walnut", name: "Walnut", color: "#b58863" }, { id: "ink", name: "Ink", color: "#667564" }];

export function SettingsDesk({ profile, accounts }: { profile: Profile; accounts: AccountView[] }) {
  const router = useRouter(); const notify = useToast(); const openImport = useImport(); const sync = useAccountSync();
  const [form, setForm] = useState(profile); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const [preview, setPreview] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [progress, setProgress] = useState<Record<string, string>>({}); const [removing, setRemoving] = useState<AccountView | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(profile);
  function set<K extends keyof Profile>(key: K, value: Profile[K]) { setForm(current => ({ ...current, [key]: value })); setError(""); }
  async function save() {
    if (!form.displayName.trim()) { setError("Give yourself a name first."); return; }
    setSaving(true); setError("");
    try { const response = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); if (!response.ok) throw new Error("Settings couldn't be saved."); const saved = await response.json(); setForm({ ...saved, accounts: undefined }); router.refresh(); notify("Settings saved."); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save."); } finally { setSaving(false); }
  }
  async function syncNow(account: AccountView, full = false) { setProgress(current => ({ ...current, [account.id]: "Starting…" })); try { await sync(account, message => setProgress(current => ({ ...current, [account.id]: message })), full); router.refresh(); } catch (e) { setProgress(current => ({ ...current, [account.id]: e instanceof Error ? e.message : "Sync failed" })); } }
  async function remove() { if (!removing) return; await fetch(`/api/accounts/${removing.id}`, { method: "DELETE" }); setRemoving(null); notify("Account unlinked. Its imported games were removed."); router.refresh(); }
  return <div>
    <PageHeading eyebrow="SETTINGS" title="Your accounts, your coach, your board." description="Linked accounts drive everything: which games count as yours, which openings get measured, and which positions become practice."/>
    <div className="settings-layout">
      <div>
        <section className="card settings-section">
          <div className="row spread"><h2>Linked accounts</h2><button className="button primary small" onClick={openImport}><Icon name="plus" size={14}/>Link account</button></div>
          <p className="help">Public profiles only—no passwords. Switch the active account from the top-right menu.</p>
          <div className="account-list">{accounts.map(account => <div key={account.id} className={`account-card ${profile.activeAccountId === account.id ? "active" : ""}`}>
            {account.avatarUrl ? <img src={account.avatarUrl} alt="" className="avatar-image" width={44} height={44}/> : <span className="avatar" style={{ width: 44, height: 44 }}>{account.displayName.slice(0, 2).toUpperCase()}</span>}
            <div className="account-body"><strong>{account.displayName} <span className="badge">{account.platform === "chesscom" ? "Chess.com" : "Lichess"}</span>{profile.activeAccountId === account.id ? <span className="badge green">ACTIVE</span> : null}</strong><p className="help">{account.importedGames.toLocaleString()} games imported{account.totalGames ? ` of ~${account.totalGames.toLocaleString()} on record` : ""} · {Object.entries(account.ratings).filter(([key]) => key !== "puzzles").map(([key, value]) => `${key} ${value?.rating}`).join(" · ") || "no ratings"}</p><p className="meta">{progress[account.id] ?? (account.lastSyncedAt ? `Last synced ${new Date(account.lastSyncedAt).toLocaleString()}` : "Never synced")}{account.syncStatus === "error" ? ` · ${account.syncMessage}` : ""}</p></div>
            <div className="row wrap">{profile.activeAccountId !== account.id ? <button className="button ghost small" onClick={async () => { await fetch(`/api/accounts/${account.id}`, { method: "PATCH" }); router.refresh(); }}>Make active</button> : null}<button className="button secondary small" onClick={() => void syncNow(account)} disabled={progress[account.id] !== undefined && !/new games|failed|already/i.test(progress[account.id])}><Icon name="refresh" size={13}/>Sync new games</button><button className="button ghost small" onClick={() => void syncNow(account, true)} title="Re-check every month, not just recent ones">Full re-sync</button><button className="icon-button" aria-label={`Unlink ${account.displayName}`} onClick={() => setRemoving(account)}><Icon name="trash" size={15}/></button></div>
          </div>)}{!accounts.length ? <p className="empty">No accounts linked yet.</p> : null}</div>
        </section>
        <section className="card settings-section"><h2>Your player profile</h2><p className="help">Used for the coach's tone and the suggested engine level.</p><div className="form-grid"><label className="field-label">Name<input className="field" value={form.displayName} maxLength={40} onChange={event => set("displayName", event.target.value)}/></label><label className="field-label">Rating if no account is linked<input className="field" type="number" min={100} max={3200} value={form.rating || ""} onChange={event => set("rating", Number(event.target.value))}/></label></div></section>
        <section className="card settings-section"><h2>Coaching voice</h2><div className="style-options">{([{ id: "patient", icon: "bulb", title: "Plain English · recommended", text: "What happened, why it matters, and one habit to take into your next game." }, { id: "direct", icon: "target", title: "Quick & direct", text: "The useful idea first, less reading." }, { id: "sharp", icon: "chart", title: "Engine-first", text: "Evaluations, centipawn loss, and lines by default." }] as const).map(style => <button key={style.id} className={`style-option ${form.coachTone === style.id ? "selected" : ""}`} onClick={() => set("coachTone", style.id)}><Icon name={style.icon} size={19}/><div><strong>{style.title}</strong><p>{style.text}</p></div>{form.coachTone === style.id ? <Icon name="check" size={15} style={{ marginLeft: "auto" }}/> : null}</button>)}</div><label className="field-label" style={{ marginTop: 16 }}>Practice focus<select className="select" value={form.focus} onChange={event => set("focus", event.target.value as Profile["focus"])}><option value="all">A little of everything</option><option value="tactics">Checks, captures, and piece safety</option><option value="openings">Development and king safety</option><option value="endgames">King activity and pawn endings</option></select></label></section>
      </div>
      <div>
        <section className="card settings-section"><h2>Board</h2><div className="settings-preview"><Board fen={preview} theme={form.boardTheme} pieceSet={form.pieceSet} interactive onMove={uci => { try { const chess = new Chess(preview); playUci(chess, uci); setPreview(chess.fen()); } catch { /* illegal */ } }}/></div><div className="piece-set-options">{([{ id: "chessnut", label: "Chessnut · modern" }, { id: "merida", label: "Merida · classic" }, { id: "cburnett", label: "Cburnett · original" }] as const).map(option => <button key={option.id} type="button" className={`piece-set-option ${form.pieceSet === option.id ? "selected" : ""}`} onClick={() => set("pieceSet", option.id)}><span className="piece-set-strip">{["k","q","r","b","n","p"].map(type => <img key={type} src={`/pieces/${option.id}/w${type.toUpperCase()}.svg`} alt="" />)}<img src={`/pieces/${option.id}/bN.svg`} alt="" /></span><span>{option.label}</span></button>)}</div>
<div className="theme-options">{THEMES.map(theme => <button key={theme.id} className={`theme-option ${form.boardTheme === theme.id ? "selected" : ""}`} onClick={() => set("boardTheme", theme.id)}><span className="theme-swatch" style={{ "--swatch": theme.color } as React.CSSProperties}/>{theme.name}</button>)}</div><button className="text-button" style={{ marginTop: 12 }} onClick={() => setPreview("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")}><Icon name="refresh" size={12}/>Reset preview</button><Toggle checked={form.sound} onChange={value => set("sound", value)} label="Move sounds" description="A soft sound for moves, captures, and good finds."/><Toggle checked={form.showArrows} onChange={value => set("showArrows", value)} label="Show engine hints by default" description="Off is better for practice."/></section>
        <section className="card settings-section"><div className="row spread"><h2 style={{ margin: 0 }}>Engine depth</h2><span className="badge green">STOCKFISH 19</span></div>
          <div className="depth-control"><div className="row spread"><span className="help">Manual reviews</span><strong>depth {form.depth}</strong></div><input type="range" min={8} max={14} step={2} value={form.depth} aria-label="Manual review depth" onChange={event => set("depth", Number(event.target.value))}/></div>
          <div className="depth-control"><div className="row spread"><span className="help">Background queue (Engine lab)</span><strong>depth {form.bulkDepth}</strong></div><input type="range" min={8} max={12} step={2} value={form.bulkDepth} aria-label="Background analysis depth" onChange={event => set("bulkDepth", Number(event.target.value))}/><div className="depth-labels"><span>8 · ~10s per game</span><span>10 · ~25s</span><span>12 · ~60s+</span></div></div>
        </section>
        <section className="card settings-section"><h2>What this is</h2><p className="about-copy">MYCHESS reads your public game archives and builds a study profile: openings, endgames, time habits, and—once Stockfish has analyzed games—tactics and puzzles. Labels are learning heuristics, accuracy is a study score, and nothing here is an official rating. Stockfish is GPL-3.0. Piece sets: Chessnut by Alexis Luengas (Apache 2.0), Merida by Armando Hernandez Marroquin (GPLv2+), Cburnett by Colin M.L. Burnett (GPLv2+), via lichess-org/lila.</p></section>
        <DeploymentStatus/>
      </div>
    </div>
    {error ? <div className="inline-error" role="alert"><Icon name="info"/>{error}</div> : null}
    <div className="settings-save"><span>{dirty ? "You have unsaved changes." : "Everything is saved."}</span><div className="row"><button className="button ghost small" disabled={!dirty || saving} onClick={() => { setForm(profile); setError(""); }}>Reset</button><button className="button primary" disabled={saving || !dirty} onClick={() => void save()}>{saving ? <Spinner/> : <Icon name="check" size={15}/>} Save</button></div></div>
    <Modal open={!!removing} onClose={() => setRemoving(null)} title={`Unlink ${removing?.displayName ?? ""}?`}><p className="modal-intro">Games imported from this account, their analysis, and practice positions will be removed from the workspace. Manually imported PGNs stay.</p><div className="row"><button className="button ghost grow" onClick={() => setRemoving(null)}>Keep it</button><button className="button danger grow" onClick={() => void remove()}>Unlink account</button></div></Modal>
  </div>;
}
