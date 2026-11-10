"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { Icon } from "@/components/ui";
import { gameAccuracy, sourceLabel } from "@/lib/presentation";
import { resultLabel } from "@/lib/pgn";
import type { GameListItem } from "@/lib/types";

export function GameRow({ game }: { game: GameListItem }) {
  const accuracy = gameAccuracy(game);
  return <motion.div whileHover={{ x: 3 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}><Link href={`/review/${game.id}${game.status !== "analyzed" ? "?run=1" : ""}`} className="game-row"><span className="game-avatar"><Icon name={game.source === "sample" ? "knight" : "board"} size={18}/></span><span className="game-row-info"><strong>{game.whiteName} <span className="muted">vs</span> {game.blackName}</strong><p>{game.opening} · {sourceLabel(game.source)}</p></span><span className={`badge ${game.status === "analyzed" ? "green" : ""}`}>{game.status === "analyzed" ? resultLabel(game.result, game.youColor) : "Ready to review"}</span><span className="accuracy-number">{accuracy != null ? accuracy.toFixed(1) : "—"}<small>{game.youColor ? "your accuracy" : "both sides"}</small></span><Icon name="chevron" size={14}/></Link></motion.div>;
}
