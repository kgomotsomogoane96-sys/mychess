import { databaseUrl } from "@/lib/database-url";
import { SetupScreen } from "@/components/setup-screen";
import { Chess } from "chess.js";
import { EndgamesDesk } from "@/components/endgames-desk";
import { endgameReport } from "@/lib/coachplan";
import { getScope } from "@/lib/scope";
import { compactGames, getReplayGames, listDrills } from "@/lib/store";

export const revalidate = 20;
export const metadata = { title: "Endgames" };

export default async function EndgamesPage() {
  if (!databaseUrl()) return <SetupScreen/>;
  const scope = await getScope();
  const [games, drills] = await Promise.all([compactGames(scope.accountIds), listDrills(scope.accountIds, 400)]);
  const report = endgameReport(games);
  const full = await getReplayGames(report.replay.map(game => game.id));
  const replay = report.replay.map(game => {
    const row = full.find(item => item.id === game.id); if (!row || !game.endgameStartPly) return null;
    try { const chess = new Chess(); chess.loadPgn(row.pgn); const history = chess.history({ verbose: true }); const fen = history[game.endgameStartPly - 1]?.after; if (!fen) return null; return { id: game.id, fen, opponent: game.youColor === "white" ? row.blackName : row.whiteName, youColor: game.youColor, result: game.result, type: game.endgameType, diff: game.youColor === "white" ? game.endgameDiff ?? 0 : -(game.endgameDiff ?? 0), playedAt: game.playedAt, ply: game.endgameStartPly }; } catch { return null; }
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));
  return <EndgamesDesk report={{ ...report, replay: [] }} replay={replay} drills={drills.filter(drill => drill.kind === "endgame").slice(0, 6)} scopeLabel={scope.scopeLabel} theme={scope.profile.boardTheme}/>;
}
