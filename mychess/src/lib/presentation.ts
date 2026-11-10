import type { ColorName, GameListItem, GameView } from "@/lib/types";

export function gameAccuracy(game: Pick<GameView, "youColor" | "accuracyWhite" | "accuracyBlack"> | Pick<GameListItem, "youColor" | "accuracyWhite" | "accuracyBlack">) {
  if (game.youColor === "white") return game.accuracyWhite;
  if (game.youColor === "black") return game.accuracyBlack;
  if (game.accuracyWhite != null && game.accuracyBlack != null) return (game.accuracyWhite + game.accuracyBlack) / 2;
  return game.accuracyWhite ?? game.accuracyBlack;
}
export function sourceLabel(source: string) { return source === "chesscom" ? "Chess.com" : source === "lichess" ? "Lichess" : source === "sample" ? "Example game" : "PGN import"; }
export function resultTone(result: string, color: ColorName | null) {
  if (result === "1/2-1/2") return "amber";
  if (result === "*") return "";
  return (result === "1-0" && color === "white") || (result === "0-1" && color === "black") ? "green" : color ? "red" : "";
}
export function moveNumber(ply: number) { return `${Math.ceil(ply / 2)}${ply % 2 ? "." : "…"}`; }
export function friendlyDate(value: string | null) {
  if (!value) return "Date not supplied";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
