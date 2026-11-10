"use client";

import { FocusButton } from "@/components/focus-button";
import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function Icon({ name, size = 18, className = "", style }: { name: string; size?: number; className?: string; style?: CSSProperties }) {
  const paths: Record<string, ReactNode> = {
    home: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    board: <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></>,
    archive: <><rect x="3" y="7" width="18" height="14" rx="3"/><path d="M3 11h18M9 15h6M8 3h8"/></>,
    study: <><path d="M12 5v16M3 4h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5v15h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3z"/></>,
    chart: <><path d="M4 4v16h16M7 14l4-5 4 3 5-7"/><path d="M16 5h4v4"/></>,
    settings: <><path d="m9 3-.6 2.2-2 .9-2-.6-2 3.5 1.5 1.6v2.8L2.4 15l2 3.5 2-.6 2 .9L9 21h4l.6-2.2 2-.9 2 .6 2-3.5-1.5-1.6v-2.8L19.6 9l-2-3.5-2 .6-2-.9L13 3z"/><circle cx="11" cy="12" r="3"/></>,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6"/></>,
    chevron: <path d="m9 5 7 7-7 7"/>,
    down: <path d="m6 9 6 6 6-6"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/></>,
    download: <><path d="M12 3v13m-5-5 5 5 5-5M4 16v4h16v-4"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    bulb: <><path d="M9 18h6M9 21h6M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 3H9c0-1 0-2-1-3z"/></>,
    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    play: <path d="m8 4 12 8-12 8z"/>,
    pause: <><path d="M8 5v14M16 5v14"/></>,
    back: <><path d="m14 6-6 6 6 6M4 5v14"/></>,
    next: <><path d="m10 6 6 6-6 6M20 5v14"/></>,
    flip: <><path d="M4 8h14l-3-3M20 16H6l3 3"/></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/></>,
    spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/></>,
    note: <><path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h5"/></>,
    trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
    link: <><path d="m10 13 4-4M8 15l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 9l2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(1 0) scale(.9)"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/></>,
    trophy: <><path d="M8 3h8v7a4 4 0 0 1-8 0zM8 5H4v3a4 4 0 0 0 4 4M16 5h4v3a4 4 0 0 1-4 4M12 14v6M8 21h8"/></>,
    knight: <><path d="M7 21h12l-1-4c-1-2-2-3-2-5 2-5-1-9-6-10l-1 3-4 4 2 3 4-2c0 4-5 5-4 11z"/><path d="M10 7h.01M6 21h14"/></>,
    expand: <><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></>,
    shrink: <><path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5"/></>,
    panel: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/></>,
    "panel-close": <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16M18 12h-6"/></>,
  };
  return <svg className={className} style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.board}</svg>;
}

export function Spinner({ size = 16 }: { size?: number }) { return <span className="spinner" style={{ width: size, height: size }} aria-label="Loading"/>; }

export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 22, scale: .985 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, margin: "-20px" }} transition={{ duration: .5, delay, ease: [.22, 1, .36, 1] }}>{children}</motion.div>;
}

export function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!visible || !ref.current) return;
    if (reduce) { ref.current.textContent = value.toFixed(decimals); return; }
    const control = animate(0, value, { duration: .85, ease: "easeOut", onUpdate: v => { if (ref.current) ref.current.textContent = v.toFixed(decimals); } });
    return () => control.stop();
  }, [value, visible, decimals, reduce]);
  return <span ref={ref}>{value.toFixed(decimals)}</span>;
}

export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-heading"><div><p className="eyebrow"><span className="status-dot"/>{eyebrow}</p><h1>{title}</h1>{description ? <p className="page-description">{description}</p> : null}</div><div className="row wrap">{action}<FocusButton/></div></div>;
}

export function Modal({ open, onClose, title, children, className = "" }: { open: boolean; onClose: () => void; title: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (open) { const old = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = old; }; }
  }, [open]);
  return <dialog ref={ref} className={`modal-shell ${className}`} aria-label={title} data-lenis-prevent onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><motion.div className="modal-card" initial={{ opacity: 0, y: 20, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 350, damping: 30 }}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="close"/></button></div>{children}</motion.div></dialog>;
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (value: boolean) => void; label: string; description?: string }) {
  const reduce = useReducedMotion();
  return <div className="toggle-row"><div><strong>{label}</strong>{description ? <p>{description}</p> : null}</div><motion.button type="button" role="switch" aria-checked={checked} aria-label={label} className={`toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)} whileTap={{ scale: .94 }} animate={checked ? { boxShadow: "0 0 16px rgba(99,244,91,.35)" } : { boxShadow: "0 0 0px rgba(99,244,91,0)" }} transition={{ duration: .22 }}><motion.span layout transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 32 }}/>{checked ? <motion.i className="toggle-glow" initial={{ opacity: 0 }} animate={{ opacity: 1 }}/> : null}</motion.button></div>;
}

type Toast = { id: number; message: string; kind: "success" | "error" | "info" };
const ToastContext = createContext<(message: string, kind?: Toast["kind"]) => void>(() => undefined);
export function useToast() { return useContext(ToastContext); }
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => { setMounted(true); return () => timers.current.forEach(clearTimeout); }, []);
  const notify = useCallback((message: string, kind: Toast["kind"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts(current => [...current.slice(-2), { id, message, kind }]);
    timers.current.push(setTimeout(() => setToasts(current => current.filter(t => t.id !== id)), 4500));
  }, []);
  return <ToastContext.Provider value={notify}>{children}{mounted ? createPortal(<div className="toast-stack" aria-live="polite">{toasts.map(toast => <motion.div key={toast.id} className={`toast ${toast.kind}`} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}><Icon name={toast.kind === "success" ? "check" : "info"}/><span>{toast.message}</span><button aria-label="Dismiss notification" onClick={() => setToasts(current => current.filter(t => t.id !== toast.id))}><Icon name="close" size={14}/></button></motion.div>)}</div>, document.body) : null}</ToastContext.Provider>;
}
