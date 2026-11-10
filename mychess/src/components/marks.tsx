import { classMeta } from "@/lib/labels";
import type { ClassName } from "@/lib/types";

const COLORS: Record<ClassName, string> = { brilliant: "#5eead4", great: "#8cb7ff", best: "#63f45b", excellent: "#a3e68c", good: "#b5c99a", book: "#c4b18a", inaccuracy: "#ffc768", mistake: "#ffab70", miss: "#ff9191", blunder: "#ff7979" };
export function classColor(name: string) { return COLORS[name as ClassName] ?? COLORS.good; }
export function ClassPill({ name }: { name: string }) {
  const meta = classMeta(name);
  return <span className="pill" style={{ "--pill-color": classColor(name) } as React.CSSProperties}><em>{meta.glyph}</em>{meta.label}</span>;
}
