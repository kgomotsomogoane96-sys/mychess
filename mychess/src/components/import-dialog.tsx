"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { Icon, Modal, Spinner, useToast } from "@/components/ui";
import { readEventStream } from "@/lib/sse-client";
import type { AccountView, Platform } from "@/lib/types";

const ImportContext = createContext<() => void>(() => undefined);
export function useImport() { return useContext(ImportContext); }

export function useAccountSync() {
  const notify = useToast();
  return async function sync(account: AccountView, onProgress?: (message: string, done: boolean) => void, full = false) {
    let totalImported = 0;
    let complete = false;
    for (let batch = 0; batch < 40 && !complete; batch += 1) {
      let retry = 0;
      while (retry < 3) {
        const url = `/api/accounts/${account.id}/sync?full=${full ? 1 : 0}&reset=${batch === 0 ? 1 : 0}`;
        const response = await fetch(url, { cache: "no-store" });
        if (response.status === 409) { retry += 1; await new Promise(resolve => setTimeout(resolve, 1200)); continue; }
        await readEventStream(response, event => {
          if (event.type === "done") totalImported += Number(event.imported ?? 0);
          if (event.message) onProgress?.(event.message, false);
          if (event.type === "error") throw new Error(event.message || "Sync failed");
          if (event.type === "done") complete = event.complete !== false;
        });
        break;
      }
      if (retry >= 3) throw new Error("Another sync is still running. Try again in a moment.");
    }
    onProgress?.(`Sync complete · ${totalImported.toLocaleString()} new games in the final batch.`, true);
    notify(`${account.displayName}: archive sync complete.`);
    return totalImported;
  };
}

export function ImportProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"account" | "pgn">("account");
  const [platform, setPlatform] = useState<Platform>("chesscom");
  const [username, setUsername] = useState("");
  const [pgn, setPgn] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [filename, setFilename] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter(); const notify = useToast(); const sync = useAccountSync();
  async function readFile(file?: File) { if (!file) return; if (file.size > 2_000_000) { setError("Please use a file smaller than 2 MB."); return; } setPgn(await file.text()); setFilename(file.name); setError(""); }
  async function submit() {
    setBusy(true); setError(""); setProgress("");
    try {
      if (tab === "account") {
        const response = await fetch("/api/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platform, username }) });
        const account = (await response.json()) as AccountView & { error?: string };
        if (!response.ok) throw new Error(account.error || "Could not link that account.");
        setProgress("Account linked. Importing your games in batches…");
        await sync(account, message => setProgress(message));
        setOpen(false); router.push("/"); router.refresh();
      } else {
        const response = await fetch("/api/games", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pgn, source: "pgn" }) });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "We couldn't read that PGN.");
        const fresh = (json.saved as { id: string; skipped?: boolean }[]).filter(item => !item.skipped);
        notify(fresh.length ? `${fresh.length} game${fresh.length === 1 ? "" : "s"} added.` : "Those games were already in your library.");
        setOpen(false); setPgn(""); setFilename("");
        if (fresh.length === 1) router.push(`/review/${fresh[0].id}?run=1`); else { router.push("/games"); router.refresh(); }
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  }
  return <ImportContext.Provider value={() => { setError(""); setOpen(true); }}>{children}
    <Modal open={open} onClose={() => { if (!busy) setOpen(false); }} title="Bring your chess in." className="import-modal">
      <p className="modal-intro">Link a public account to build your coaching plan from every game you've played, or import a single PGN.</p>
      <div className="segmented import-tabs" role="tablist"><button role="tab" aria-selected={tab === "account"} className={tab === "account" ? "selected" : ""} onClick={() => setTab("account")}>Link an account</button><button role="tab" aria-selected={tab === "pgn"} className={tab === "pgn" ? "selected" : ""} onClick={() => setTab("pgn")}>PGN / FEN</button></div>
      <AnimatePresence mode="wait"><motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .15 }}>
        {tab === "account" ? <div className="account-import">
          <div className="segmented" style={{ marginBottom: 16 }}><button className={platform === "chesscom" ? "selected" : ""} onClick={() => setPlatform("chesscom")}>Chess.com</button><button className={platform === "lichess" ? "selected" : ""} onClick={() => setPlatform("lichess")}>Lichess</button></div>
          <label className="field-label">Your {platform === "chesscom" ? "Chess.com" : "Lichess"} username<input className="field" value={username} onChange={event => setUsername(event.target.value)} placeholder="e.g. Ghost-KM-0" autoComplete="off" onKeyDown={event => { if (event.key === "Enter" && !busy) void submit(); }}/></label>
          <p className="help" style={{ marginTop: 12 }}><Icon name="shield" size={14}/> No password. We read your public game archive in small batches, recognize your side in every game, and build your openings, endgames, habits, and practice from it.</p>
        </div> : <div className={`drop-zone ${dragging ? "dragging" : ""}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); void readFile(event.dataTransfer.files[0]); }}>
          <button className="upload-prompt" onClick={() => input.current?.click()}><Icon name="upload" size={22}/><strong>{filename || "Drop a PGN file, or click to browse"}</strong><span>One game, a tournament file, or a FEN position.</span></button>
          <input ref={input} type="file" accept=".pgn,.txt,.fen" hidden onChange={event => void readFile(event.target.files?.[0])}/>
          <textarea aria-label="PGN or FEN" value={pgn} onChange={event => setPgn(event.target.value)} placeholder={"Or paste your game here…\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 …"} spellCheck={false}/>
        </div>}
      </motion.div></AnimatePresence>
      {progress ? <p className="sync-progress"><Spinner size={12}/>{progress}</p> : null}
      {error ? <div className="inline-error" role="alert"><Icon name="info"/>{error}</div> : null}
      <button className="button primary full" disabled={busy || (tab === "pgn" ? !pgn.trim() : !username.trim())} onClick={() => void submit()}>{busy ? <Spinner/> : <Icon name="spark"/>}{busy ? " Working…" : tab === "account" ? " Link & build my plan" : " Import game"}{!busy && <Icon name="arrow"/>}</button>
      <p className="privacy-note"><Icon name="shield" size={12}/> Large archives import in resumable batches so they work within serverless time limits.</p>
    </Modal>
  </ImportContext.Provider>;
}
