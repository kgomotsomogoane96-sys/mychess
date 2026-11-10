"use client";

import { useWorkspaceFocus } from "@/components/workspace-focus";
import { Icon } from "@/components/ui";

/** Works in server-rendered pages too: this is the client boundary. */
export function FocusButton({ className = "button ghost small", compact = false }: { className?: string; compact?: boolean }) {
  const { focus, toggle } = useWorkspaceFocus();
  return <button type="button" className={className} onClick={toggle} aria-pressed={focus} aria-label={focus ? "Exit focus mode" : "Enter focus mode"} title="Give this page the whole screen · Esc to exit">
    {focus ? <Icon name="shrink" size={13}/> : <Icon name="expand" size={13}/>}{compact ? null : focus ? "Exit focus" : "Focus"}
  </button>;
}
