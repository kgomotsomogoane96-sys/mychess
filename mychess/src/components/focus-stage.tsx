"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui";

/**
 * Turns its children into a full-viewport stage when `active` is true.
 * The children stay mounted, so games in progress are never lost.
 * - Esc exits the stage
 * - "Fullscreen" requests the native browser fullscreen
 * - The side panel (play / practice / review panel) slides in from the right
 */
export function FocusFrame({ active, onExit, panelOpen, onTogglePanel, title, children }: {
  active: boolean;
  onExit: () => void;
  panelOpen?: boolean;
  onTogglePanel?: () => void;
  title?: string;
  children: ReactNode;
}) {
  const [fs, setFs] = useState(false);
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "Escape") onExit();
    };
    const onFs = () => setFs(Boolean(document.fullscreenElement));
    document.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
      document.body.style.overflow = prev;
    };
  }, [active, onExit]);

  const toggleFs = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  return <div className={`focus-frame ${active ? "focus-active" : ""} ${panelOpen ? "panel-open" : ""}`}>
    <AnimatePresence>
      {active && <motion.div
        className="focus-topbar"
        initial={{ y: -56, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -56, opacity: 0 }}
        transition={{ duration: .25, ease: "easeOut" }}
      >
        <span className="focus-title"><Icon name="expand" size={13}/>{title}</span>
        <div className="row">
          {onTogglePanel ? <button type="button" className="button ghost small" onClick={onTogglePanel}><Icon name={panelOpen ? "panel-close" : "panel"} size={13}/>{panelOpen ? "Hide panel" : "Show panel"}</button> : null}
          <button type="button" className="button ghost small" onClick={toggleFs} aria-label={fs ? "Exit fullscreen" : "Enter fullscreen"}>{fs ? <Icon name="shrink" size={13}/> : <Icon name="expand" size={13}/>}{fs ? "Exit" : "Fullscreen"}</button>
          <button type="button" className="button ghost small" onClick={onExit}><Icon name="close" size={13}/>Close<span className="kbd">Esc</span></button>
        </div>
      </motion.div>}
    </AnimatePresence>
    {children}
  </div>;
}
