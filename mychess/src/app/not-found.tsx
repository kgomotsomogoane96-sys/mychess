import Link from "next/link";
import { Icon } from "@/components/ui";

export default function NotFound() {
  return <div className="not-found"><Icon name="knight" size={48} style={{ color: "var(--lime)", margin: "0 auto 20px" }}/><p className="eyebrow" style={{ justifyContent: "center" }}>A WRONG TURN, NOT A LOST GAME</p><h1>This position isn't in your library.</h1><p className="help">The game may have been removed, or the link is out of date. Your other lessons are still here.</p><div className="row" style={{ justifyContent: "center", marginTop: 25 }}><Link href="/" className="button primary">Back to overview <Icon name="arrow" size={15}/></Link><Link href="/archive" className="button ghost">My games</Link></div></div>;
}
