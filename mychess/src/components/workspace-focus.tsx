"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui";

type FocusState = { focus: boolean; toggle: () => void; exit: () => void };
const Ctx = createContext<FocusState>({ focus: false, toggle: () => undefined, exit: () => undefined });
export const useWorkspaceFocus = () => useContext(Ctx);

/**
 * Makes ANY page a self-contained fullscreen workspace: hides the sidebar and
 * top bar, gives the whole viewport to the current page, Esc to leave.
 */
export function WorkspaceFocusProvider({ children }: { children: ReactNode }) {
  const [focus, setFocus] = useState(false);
  const path = usePathname();
  const reduce = useReducedMotion();
  const exit = useCallback(() => setFocus(false), []);
  const toggle = useCallback(() => setFocus(v => !v), []);

  useEffect(() => { setFocus(false); }, [path]);
  useEffect(() => {
    document.documentElement.classList.toggle("zen-mode", focus);
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (event.key === "Escape" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") setFocus(false);
    };
    document.addEventListener("keydown", onKey);
    return () => { document.documentElement.classList.remove("zen-mode"); document.removeEventListener("keydown", onKey); };
  }, [focus]);

  return <Ctx.Provider value={{ focus, toggle, exit }}>
    {children}
    <AnimatePresence>
      {focus ? <motion.button
        type="button"
        className="zen-exit"
        onClick={exit}
        initial={reduce ? false : { opacity: 0, y: 16, scale: .9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: .9 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        aria-label="Exit focus mode"
      ><Icon name="shrink" size={15}/>Exit focus<span className="kbd">Esc</span></motion.button> : null}
    </AnimatePresence>
  </Ctx.Provider>;
}
