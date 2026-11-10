import type { ColorName, CompactGame, OpeningFamilyRow, OpeningNode, PlanItem, ScoreRow } from "@/lib/types";
import { resultForColor } from "@/lib/features";

export type Outcome = "win" | "loss" | "draw";
export const outcomeOf = (game: CompactGame) => resultForColor(game.result, game.youColor);
export const yourRating = (game: CompactGame) => (game.youColor === "white" ? game.whiteRating : game.blackRating);
export const oppRating = (game: CompactGame) => (game.youColor === "white" ? game.blackRating : game.whiteRating);
export const yourAccuracy = (game: CompactGame) => (game.youColor === "white" ? game.accuracyWhite : game.accuracyBlack) ?? game.platformAccuracy;
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);

export function scoreRows<T extends string>(items: CompactGame[], keyOf: (game: CompactGame) => T | null, labelOf: (key: T) => string = key => key): ScoreRow[] {
  const map = new Map<T, ScoreRow>();
  for (const game of items) {
    const key = keyOf(game); const outcome = outcomeOf(game);
    if (!key || !outcome) continue;
    const row = map.get(key) ?? { key, label: labelOf(key), games: 0, wins: 0, draws: 0, losses: 0, score: 0, accuracy: null, extra: { accuracySum: 0, accuracyCount: 0 } };
    row.games += 1; row[outcome === "win" ? "wins" : outcome === "draw" ? "draws" : "losses"] += 1;
    const accuracy = yourAccuracy(game);
    if (accuracy != null && row.extra) { row.extra.accuracySum = (row.extra.accuracySum ?? 0) + accuracy; row.extra.accuracyCount = (row.extra.accuracyCount ?? 0) + 1; }
    map.set(key, row);
  }
  return [...map.values()].map(row => ({ ...row, score: pct(row.wins + row.draws / 2, row.games), accuracy: row.extra?.accuracyCount ? Math.round(((row.extra.accuracySum ?? 0) / row.extra.accuracyCount) * 10) / 10 : null })).sort((a, b) => b.games - a.games);
}

export function overallScore(items: CompactGame[]) {
  const scored = items.filter(game => outcomeOf(game));
  const wins = scored.filter(game => outcomeOf(game) === "win").length; const draws = scored.filter(game => outcomeOf(game) === "draw").length;
  return { games: scored.length, wins, draws, losses: scored.length - wins - draws, score: pct(wins + draws / 2, scored.length) };
}

export function openingFamilies(items: CompactGame[]): OpeningFamilyRow[] {
  const rows: OpeningFamilyRow[] = [];
  for (const color of ["white", "black"] as ColorName[]) {
    const subset = items.filter(game => game.youColor === color);
    const byFamily = scoreRows(subset, game => game.openingFamily);
    for (const row of byFamily) {
      const familyGames = subset.filter(game => game.openingFamily === row.key);
      rows.push({ ...row, color, eco: familyGames.find(game => game.eco)?.eco ?? null, analyzed: familyGames.filter(game => game.status === "analyzed").length, lastPlayed: familyGames.reduce<string | null>((latest, game) => (!latest || (game.playedAt ?? "") > latest ? game.playedAt : latest), null) });
    }
  }
  return rows.sort((a, b) => b.games - a.games);
}

export function openingTree(items: CompactGame[], maxPlies = 12): OpeningNode {
  const root: OpeningNode = { san: "start", games: 0, wins: 0, draws: 0, losses: 0, children: [] };
  for (const game of items) {
    const outcome = outcomeOf(game); if (!outcome) continue;
    let node = root; node.games += 1; node[outcome === "win" ? "wins" : outcome === "draw" ? "draws" : "losses"] += 1;
    for (const san of game.openingLine.split(" ").filter(Boolean).slice(0, maxPlies)) {
      let child = node.children.find(item => item.san === san);
      if (!child) { child = { san, games: 0, wins: 0, draws: 0, losses: 0, children: [] }; node.children.push(child); }
      child.games += 1; child[outcome === "win" ? "wins" : outcome === "draw" ? "draws" : "losses"] += 1; node = child;
    }
  }
  const sortTree = (node: OpeningNode) => { node.children.sort((a, b) => b.games - a.games); node.children = node.children.filter(child => child.games >= 2 || node.games < 6); node.children.forEach(sortTree); };
  sortTree(root);
  return root;
}

export function weakBranches(tree: OpeningNode, color: ColorName, minGames = 6) {
  const results: { line: string[]; games: number; score: number; yours: boolean }[] = [];
  const walk = (node: OpeningNode, path: string[]) => {
    node.children.forEach(child => {
      const line = [...path, child.san];
      const ply = line.length;
      const yours = (color === "white") === (ply % 2 === 1);
      if (child.games >= minGames && ply >= 3) results.push({ line, games: child.games, score: pct(child.wins + child.draws / 2, child.games), yours });
      walk(child, line);
    });
  };
  walk(tree, []);
  return results.sort((a, b) => a.score - b.score || b.games - a.games);
}

export function endgameReport(items: CompactGame[]) {
  const reached = items.filter(game => game.endgameStartPly != null && outcomeOf(game));
  const perspective = (game: CompactGame) => (game.youColor === "white" ? game.endgameDiff ?? 0 : -(game.endgameDiff ?? 0));
  const ahead = reached.filter(game => perspective(game) >= 2); const behind = reached.filter(game => perspective(game) <= -2); const level = reached.filter(game => Math.abs(perspective(game)) < 2);
  const converted = ahead.filter(game => outcomeOf(game) === "win").length; const saved = behind.filter(game => outcomeOf(game) !== "loss").length; const levelWon = level.filter(game => outcomeOf(game) === "win").length; const levelLost = level.filter(game => outcomeOf(game) === "loss").length;
  const byType = scoreRows(reached, game => game.endgameType ?? "other");
  const outside = items.filter(game => game.endgameStartPly == null && outcomeOf(game));
  return { reached: reached.length, reachedShare: pct(reached.length, items.filter(game => outcomeOf(game)).length), endgameScore: overallScore(reached).score, middlegameScore: overallScore(outside).score, ahead: ahead.length, converted, conversionRate: pct(converted, ahead.length), behind: behind.length, saved, saveRate: pct(saved, behind.length), level: level.length, levelWon, levelLost, byType, replay: [...ahead.filter(game => outcomeOf(game) !== "win"), ...level.filter(game => outcomeOf(game) === "loss")].sort((a, b) => (b.playedAt ?? "").localeCompare(a.playedAt ?? "")).slice(0, 12) };
}

export function habitsReport(items: CompactGame[]) {
  const scored = items.filter(game => outcomeOf(game)).sort((a, b) => (a.playedAt ?? "").localeCompare(b.playedAt ?? ""));
  const losses = scored.filter(game => outcomeOf(game) === "loss");
  const lossReasons = scoreRows(losses, game => game.yourResult ?? "unknown", key => ({ timeout: "Ran out of time", checkmated: "Checkmated", resigned: "Resigned", abandoned: "Abandoned", lose: "Lost" } as Record<string, string>)[key] ?? key);
  const winReasons = scoreRows(scored.filter(game => outcomeOf(game) === "win"), game => game.oppResult ?? "unknown", key => ({ timeout: "Opponent ran out of time", checkmated: "Checkmate", resigned: "Opponent resigned", abandoned: "Opponent abandoned" } as Record<string, string>)[key] ?? key);
  const bySpeed = scoreRows(scored, game => game.speed ?? "other", key => key[0].toUpperCase() + key.slice(1));
  const timeoutBySpeed = bySpeed.map(row => { const speedLosses = losses.filter(game => (game.speed ?? "other") === row.key); return { key: row.key, label: row.label, losses: speedLosses.length, timeouts: speedLosses.filter(game => game.yourResult === "timeout").length, share: pct(speedLosses.filter(game => game.yourResult === "timeout").length, speedLosses.length) }; });
  const byColor = scoreRows(scored, game => game.youColor, key => (key === "white" ? "As White" : "As Black"));
  const hourOf = (game: CompactGame) => (game.playedAt ? new Date(game.playedAt).getUTCHours() : null);
  const byDaypart = scoreRows(scored, game => { const hour = hourOf(game); if (hour == null) return null; return hour < 6 ? "night" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"; }, key => ({ night: "Night (00–06 UTC)", morning: "Morning (06–12 UTC)", afternoon: "Afternoon (12–18 UTC)", evening: "Evening (18–24 UTC)" } as Record<string, string>)[key] ?? key);
  let afterLoss = { games: 0, wins: 0 }; let afterWin = { games: 0, wins: 0 }; const sessions: number[] = []; let sessionLength = 0; let lastTime = 0; const deep = { games: 0, wins: 0 }; const early = { games: 0, wins: 0 };
  scored.forEach((game, index) => {
    const time = game.playedAt ? new Date(game.playedAt).getTime() : 0;
    if (lastTime && time - lastTime > 45 * 60 * 1000) { sessions.push(sessionLength); sessionLength = 0; }
    sessionLength += 1; lastTime = time;
    const bucket = sessionLength > 6 ? deep : early; bucket.games += 1; if (outcomeOf(game) === "win") bucket.wins += 1;
    const previous = scored[index - 1];
    if (previous && time - new Date(previous.playedAt ?? 0).getTime() < 45 * 60 * 1000) {
      const target = outcomeOf(previous) === "loss" ? afterLoss : outcomeOf(previous) === "win" ? afterWin : null;
      if (target) { target.games += 1; if (outcomeOf(game) === "win") target.wins += 1; }
    }
  });
  if (sessionLength) sessions.push(sessionLength);
  const castled = scored.filter(game => (game.youColor === "white" ? game.whiteCastledPly : game.blackCastledPly) != null);
  const castledEarly = castled.filter(game => ((game.youColor === "white" ? game.whiteCastledPly : game.blackCastledPly) ?? 99) <= 20);
  const neverCastled = scored.filter(game => (game.youColor === "white" ? game.whiteCastledPly : game.blackCastledPly) == null && game.plyCount >= 30);
  const ratingSeries: Record<string, { t: string; rating: number }[]> = {};
  for (const game of scored) { const rating = yourRating(game); if (!rating || !game.playedAt || !game.speed) continue; (ratingSeries[game.speed] ??= []).push({ t: game.playedAt, rating }); }
  for (const key of Object.keys(ratingSeries)) { const series = ratingSeries[key]; if (series.length > 160) { const step = series.length / 160; ratingSeries[key] = Array.from({ length: 160 }, (_, i) => series[Math.floor(i * step)]); } }
  const analyzed = scored.filter(game => game.status === "analyzed" && game.summary);
  const themes = new Map<string, number>(); let blunders = 0;
  for (const game of analyzed) { const side = game.youColor === "white" ? "w" : "b"; blunders += game.summary?.counts.blunder[side] ?? 0; for (const [theme, value] of Object.entries(game.summary?.themeCounts?.[side] ?? {})) themes.set(theme, (themes.get(theme) ?? 0) + value); }
  const phaseAccuracy = (["opening", "middlegame", "endgame"] as const).map(phase => { const values = analyzed.map(game => game.summary?.phaseAccuracy[phase][game.youColor === "white" ? "w" : "b"]).filter((value): value is number => value != null); return { phase, accuracy: values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null, games: values.length }; });
  return {
    games: scored.length, lossReasons, winReasons, bySpeed, timeoutBySpeed, byColor, byDaypart,
    afterLoss: { ...afterLoss, rate: pct(afterLoss.wins, afterLoss.games) }, afterWin: { ...afterWin, rate: pct(afterWin.wins, afterWin.games) },
    sessions: { count: sessions.length, average: sessions.length ? Math.round((sessions.reduce((a, b) => a + b, 0) / sessions.length) * 10) / 10 : 0, longest: Math.max(0, ...sessions), earlyRate: pct(early.wins, early.games), deepRate: pct(deep.wins, deep.games), deepGames: deep.games },
    castling: { castledShare: pct(castled.length, scored.length), earlyShare: pct(castledEarly.length, scored.length), castledScore: overallScore(castledEarly).score, neverScore: overallScore(neverCastled).score, neverGames: neverCastled.length },
    averageLength: scored.length ? Math.round(scored.reduce((sum, game) => sum + game.plyCount, 0) / scored.length / 2) : 0,
    ratingSeries, analyzed: analyzed.length, blundersPerGame: analyzed.length ? Math.round((blunders / analyzed.length) * 10) / 10 : null,
    themes: [...themes.entries()].map(([theme, value]) => ({ theme, count: value })).sort((a, b) => b.count - a.count).slice(0, 6), phaseAccuracy,
  };
}

export function buildPlan(items: CompactGame[], context: { analyzed: number; queued: number; hasAccounts: boolean }): PlanItem[] {
  const plan: PlanItem[] = [];
  if (!context.hasAccounts || !items.length) return [{ id: "link", area: "engine", title: "Link your Chess.com or Lichess account", why: "The coaching plan is built from your own games: openings, endgames, time habits, and the mistakes you repeat.", action: { label: "Link an account", href: "/settings" }, metric: "0 games", severity: 100 }];
  const habits = habitsReport(items); const endgames = endgameReport(items); const families = openingFamilies(items);
  const worstTimeout = habits.timeoutBySpeed.filter(row => row.losses >= 15).sort((a, b) => b.share - a.share)[0];
  if (worstTimeout && worstTimeout.share >= 22) plan.push({ id: "time", area: "time", title: `Stop losing ${worstTimeout.label.toLowerCase()} games on the clock`, why: `${worstTimeout.share}% of your ${worstTimeout.label.toLowerCase()} losses end on time. Decide faster in simple positions and keep a reserve for the critical moment.`, action: { label: "See your time habits", href: "/habits" }, metric: `${worstTimeout.timeouts} of ${worstTimeout.losses} losses`, severity: 40 + worstTimeout.share });
  const weakOpening = families.filter(row => row.games >= 15 && row.score < 46).sort((a, b) => a.score - b.score || b.games - a.games)[0];
  if (weakOpening) plan.push({ id: `opening-${weakOpening.color}-${weakOpening.key}`, area: "openings", title: `Fix the ${weakOpening.label} as ${weakOpening.color}`, why: `You score ${weakOpening.score}% in ${weakOpening.games} games. Learn the purpose of the first ten moves and the one branch that keeps costing you.`, action: { label: "Open the repertoire", href: `/openings?color=${weakOpening.color}&family=${encodeURIComponent(weakOpening.key)}` }, metric: `${weakOpening.score}% in ${weakOpening.games} games`, severity: 50 + (50 - weakOpening.score) });
  if (endgames.ahead >= 10 && endgames.conversionRate < 70) plan.push({ id: "convert", area: "endgames", title: "Convert winning endgames", why: `You reached ${endgames.ahead} endgames with a material edge and won ${endgames.conversionRate}%. Technique turns those into points.`, action: { label: "Replay those endgames", href: "/endgames" }, metric: `${endgames.converted} of ${endgames.ahead} converted`, severity: 45 + (70 - endgames.conversionRate) });
  if (endgames.behind >= 10 && endgames.saveRate < 25) plan.push({ id: "defend", area: "endgames", title: "Defend worse endgames longer", why: `When behind in material you save only ${endgames.saveRate}% of endgames. Activity and stubborn defense win half points.`, action: { label: "See your endgame numbers", href: "/endgames" }, metric: `${endgames.saved} of ${endgames.behind} saved`, severity: 35 });
  if (habits.afterLoss.games >= 30 && habits.afterWin.games >= 30 && habits.afterWin.rate - habits.afterLoss.rate >= 7) plan.push({ id: "tilt", area: "habits", title: "Take a breath after a loss", why: `Right after a loss you win ${habits.afterLoss.rate}% of games, versus ${habits.afterWin.rate}% after a win. A short pause protects your rating.`, action: { label: "See the pattern", href: "/habits" }, metric: `${habits.afterLoss.rate}% vs ${habits.afterWin.rate}%`, severity: 30 + (habits.afterWin.rate - habits.afterLoss.rate) });
  if (habits.castling.neverGames >= 20 && habits.castling.castledScore - habits.castling.neverScore >= 8) plan.push({ id: "castle", area: "habits", title: "Get the king safe earlier", why: `In ${habits.castling.neverGames} longer games you never castled, scoring ${habits.castling.neverScore}% versus ${habits.castling.castledScore}% when you castled early.`, action: { label: "Practice opening habits", href: "/practice?kind=opening" }, metric: `${habits.castling.earlyShare}% castle by move 10`, severity: 32 });
  if (context.analyzed >= 5 && habits.blundersPerGame != null && habits.blundersPerGame >= 1) plan.push({ id: "blunders", area: "tactics", title: habits.themes[0] ? `Cut the ${habits.themes[0].theme} mistakes` : "Cut the blunders", why: `Stockfish found ${habits.blundersPerGame} blunders per analyzed game${habits.themes[0] ? `, most often “${habits.themes[0].theme}”` : ""}. Practice positions built from those moments.`, action: { label: "Practice from your games", href: "/practice" }, metric: `${habits.blundersPerGame} blunders / game`, severity: 40 + habits.blundersPerGame * 10 });
  if (context.analyzed < 20) plan.push({ id: "analyze", area: "engine", title: context.analyzed ? "Let Stockfish read more of your games" : "Let Stockfish read your recent games", why: `${context.analyzed} of your games have engine analysis${context.queued ? ` and ${context.queued} are queued` : ""}. Tactical lessons and puzzles come from analyzed games.`, action: { label: "Open the Engine lab", href: "/engine" }, metric: `${context.analyzed} analyzed`, severity: context.analyzed ? 20 : 60 });
  return plan.sort((a, b) => b.severity - a.severity).slice(0, 5);
}
