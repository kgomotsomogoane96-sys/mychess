"use client";

import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ImportProvider, useImport } from "@/components/import-dialog";
import { Icon, ToastProvider } from "@/components/ui";
import { WorkspaceFocusProvider } from "@/components/workspace-focus";
import { SmoothScroll, ScrollProgress, RouteProgress } from "@/components/motion-system";
import type { AccountView, Profile } from "@/lib/types";

const NAV = [
  { group: "HOME", items: [{ href: "/", label: "Dashboard", icon: "home" }] },
  { group: "LEARN", items: [{ href: "/games", label: "My games", icon: "archive" }, { href: "/practice", label: "Practice", icon: "target" }, { href: "/play", label: "Play the engine", icon: "play" }, { href: "/theory", label: "Daily theory", icon: "bulb" }, { href: "/theory/openings", label: "Opening theory", icon: "study" }, { href: "/great-games", label: "Great games", icon: "trophy" }] },
  { group: "UNDERSTAND", items: [{ href: "/openings", label: "Openings", icon: "study" }, { href: "/endgames", label: "Endgames", icon: "trophy" }, { href: "/habits", label: "Habits", icon: "chart" }, { href: "/library", label: "Universal library", icon: "grid" }] },
  { group: "LAB", items: [{ href: "/engine", label: "Engine lab", icon: "knight" }, { href: "/settings", label: "Settings", icon: "settings" }] },
];
const TITLES: Record<string, string> = { "/": "Dashboard", "/games": "My games", "/practice": "Practice", "/play": "Play the engine", "/openings": "Openings", "/endgames": "Endgames", "/habits": "Habits", "/library": "Universal library", "/theory": "Daily theory", "/engine": "Engine lab", "/settings": "Settings" };

function Frame({ children }: { children: ReactNode }) {
  const path = usePathname(); const router = useRouter(); const openImport = useImport(); const reduce = useReducedMotion();
  const [profile, setProfile] = useState<(Profile & { accounts: AccountView[] }) | null>(null);
  const [menu, setMenu] = useState(false); const [mobileNav, setMobileNav] = useState(false); const [collapsed, setCollapsed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null); const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const controller = new AbortController(); fetch("/api/profile", { signal: controller.signal }).then(r => r.json()).then(setProfile).catch(() => undefined); return () => controller.abort(); }, [path]);
  useEffect(() => {
    if (sessionStorage.getItem("mc-bootstrap-v1")) return;
    fetch("/api/setup/bootstrap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "auto" }) })
      .then(response => response.json())
      .then(json => { if (json.ok) { sessionStorage.setItem("mc-bootstrap-v1", "1"); if (json.seeded || json.schemaCreated) router.refresh(); } })
      .catch(() => undefined);
  }, [router]);
  useEffect(() => { setMobileNav(false); setMenu(false); }, [path]);
  useEffect(() => { const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenu(false); }; document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close); }, []);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href) || (href === "/games" && path.startsWith("/review/")));
  const account = profile?.accounts.find(item => item.id === profile.activeAccountId) ?? null;
  const title = path.startsWith("/review/") ? "Game review" : TITLES[path] ?? "MYCHESS";
  async function switchAccount(id: string | null) { setMenu(false); await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activeAccountId: id }) }); router.refresh(); setProfile(current => (current ? { ...current, activeAccountId: id } : current)); }
  const avatar = (item: AccountView | null, size = 30) => item?.avatarUrl ? <img src={item.avatarUrl} alt="" width={size} height={size} className="avatar-image"/> : <span className="avatar" style={{ width: size, height: size }}>{item ? item.displayName.slice(0, 2).toUpperCase() : <Icon name="user" size={15}/>}</span>;
  return <div className={`app-frame ${collapsed ? "collapsed" : ""} ${mobileNav ? "nav-open" : ""}`}>
    <SmoothScroll containerRef={contentRef}/>
    <ScrollProgress containerRef={contentRef}/>
    <RouteProgress/>
    <aside className="side-nav" aria-label="Main navigation">
      <Link href="/" className="brand"><span className="brand-icon"><Icon name="knight" size={22}/></span><span className="brand-word">MY<b>CHESS</b><small>YOUR PERSONAL CHESS LAB</small></span></Link>
      <nav className="nav-groups">{NAV.map(group => <div key={group.group}><p className="nav-label">{group.group}</p>{group.items.map(item => <Link key={item.href} href={item.href} className={`nav-link ${active(item.href) ? "active" : ""}`} title={item.label}>{active(item.href) ? <motion.span layoutId="nav-active" className="nav-highlight" transition={{ type: "spring", stiffness: 420, damping: 34 }}/> : null}<Icon name={item.icon} size={16}/><span>{item.label}</span></Link>)}</div>)}</nav>
      <div className="side-foot"><button className="nav-link" onClick={openImport}><Icon name="upload" size={16}/><span>Import a game</span></button><div className="engine-chip"><span className="status-dot"/><span>Stockfish 19 · local</span></div></div>
    </aside>
    {mobileNav ? <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)}/> : null}
    <div className="app-main">
      <header className="top-bar">
        <button className="icon-button nav-toggle" aria-label="Open navigation menu" onClick={() => { if (window.innerWidth < 900) setMobileNav(value => !value); else setCollapsed(value => !value); }}><Icon name="menu"/></button>
        <div className="top-title"><span className="eyebrow" style={{ margin: 0 }}>MYCHESS<span className="lime">®</span></span><h1>{title}</h1></div>
        <div className="top-actions">
          <button className="button primary small" onClick={openImport} aria-label="Import a game"><Icon name="plus" size={15}/><span>Import</span></button>
          <div className="account-menu" ref={menuRef}>
            <button className="account-button" aria-haspopup="menu" aria-expanded={menu} aria-label="Account and linked profiles" onClick={() => setMenu(value => !value)}>{avatar(account)}<span className="account-name">{account ? account.displayName : profile?.accounts.length ? "All accounts" : profile?.displayName ?? "You"}<small>{account ? (account.platform === "chesscom" ? "Chess.com" : "Lichess") : profile?.accounts.length ? `${profile.accounts.length} linked` : "No account linked"}</small></span><Icon name="down" size={13}/></button>
            <AnimatePresence>{menu ? <motion.div className="account-dropdown" role="menu" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .15 }}>
              {profile?.accounts.length ? <button role="menuitem" className={`dropdown-item ${!profile.activeAccountId ? "active" : ""}`} onClick={() => void switchAccount(null)}><span className="avatar" style={{ width: 28, height: 28 }}><Icon name="grid" size={14}/></span><span>All my accounts<small>Combined view</small></span></button> : null}
              {profile?.accounts.map(item => <button key={item.id} role="menuitem" className={`dropdown-item ${profile.activeAccountId === item.id ? "active" : ""}`} onClick={() => void switchAccount(item.id)}>{avatar(item, 28)}<span>{item.displayName}<small>{item.platform === "chesscom" ? "Chess.com" : "Lichess"} · {item.importedGames.toLocaleString()} games</small></span>{profile.activeAccountId === item.id ? <Icon name="check" size={14}/> : null}</button>)}
              <Link role="menuitem" href="/settings" className="dropdown-item"><span className="avatar" style={{ width: 28, height: 28 }}><Icon name="plus" size={14}/></span><span>Link another account<small>Chess.com or Lichess</small></span></Link>
            </motion.div> : null}</AnimatePresence>
          </div>
        </div>
      </header>
      <div className="app-content" ref={contentRef}><AnimatePresence mode="wait" initial={false}><motion.main key={path} className="page" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: .2, ease: "easeOut" }}>{children}</motion.main></AnimatePresence></div>
    </div>
  </div>;
}

export function Shell({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user"><ToastProvider><WorkspaceFocusProvider><ImportProvider><Frame>{children}</Frame></ImportProvider></WorkspaceFocusProvider></ToastProvider></MotionConfig>;
}
