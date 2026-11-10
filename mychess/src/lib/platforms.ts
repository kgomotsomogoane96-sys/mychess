import type { AccountRatings, Platform } from "@/lib/types";

const UA = { "User-Agent": "MYCHESS personal chess lab (contact: workspace owner)", Accept: "application/json" };

export type PlatformProfile = { username: string; displayName: string; avatarUrl: string | null; country: string | null; joinedAt: Date | null; ratings: AccountRatings; totalGames: number };
export type RemoteGame = { url: string | null; pgn: string; speed: string | null; rated: boolean; endTime: Date | null; white: { username: string; rating: number | null; result: string | null }; black: { username: string; rating: number | null; result: string | null }; accuracies?: { white: number; black: number } | null };

export function normalizeUsername(platform: Platform, raw: string) {
  const value = raw.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?(chess\.com|lichess\.org)\/(member|@)\//i, "").replace(/\/.*$/, "");
  return platform === "chesscom" ? value.toLowerCase() : value;
}

async function fetchJson(url: string) {
  const response = await fetch(url, { headers: UA, cache: "no-store", redirect: "follow" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`The platform answered ${response.status}. Try again in a moment.`);
  return response.json();
}

export async function fetchProfile(platform: Platform, username: string): Promise<PlatformProfile | null> {
  if (platform === "chesscom") {
    const player = await fetchJson(`https://api.chess.com/pub/player/${encodeURIComponent(username)}`);
    if (!player?.username) return null;
    const stats = (await fetchJson(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/stats`)) ?? {};
    const ratings: AccountRatings = {};
    let total = 0;
    for (const [key, name] of [["chess_bullet", "bullet"], ["chess_blitz", "blitz"], ["chess_rapid", "rapid"], ["chess_daily", "daily"]] as const) {
      const entry = stats[key];
      if (!entry?.last) continue;
      const record = entry.record ?? {};
      ratings[name] = { rating: entry.last.rating, best: entry.best?.rating ?? null, wins: record.win ?? 0, losses: record.loss ?? 0, draws: record.draw ?? 0 };
      total += (record.win ?? 0) + (record.loss ?? 0) + (record.draw ?? 0);
    }
    if (stats.tactics?.highest?.rating) ratings.puzzles = { rating: stats.tactics.highest.rating };
    return { username: String(player.username).toLowerCase(), displayName: (typeof player.url === "string" && player.url.split("/").pop()) || player.username, avatarUrl: player.avatar ?? null, country: player.country ? String(player.country).split("/").pop() ?? null : null, joinedAt: player.joined ? new Date(player.joined * 1000) : null, ratings, totalGames: total };
  }
  const user = await fetchJson(`https://lichess.org/api/user/${encodeURIComponent(username)}`);
  if (!user?.id) return null;
  const ratings: AccountRatings = {};
  for (const name of ["bullet", "blitz", "rapid", "classical", "puzzle"] as const) {
    const perf = user.perfs?.[name];
    if (perf?.rating && perf.games) ratings[name === "classical" ? "daily" : name === "puzzle" ? "puzzles" : name] = { rating: perf.rating };
  }
  return { username: user.username, displayName: user.username, avatarUrl: null, country: user.profile?.country ?? null, joinedAt: user.createdAt ? new Date(user.createdAt) : null, ratings, totalGames: user.count?.all ?? 0 };
}

export async function listChesscomArchives(username: string): Promise<string[]> {
  const json = await fetchJson(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`);
  return [...(json?.archives ?? [])].reverse();
}

export async function fetchChesscomMonth(url: string): Promise<RemoteGame[]> {
  const json = await fetchJson(url);
  return ((json?.games ?? []) as Array<Record<string, unknown>>).filter(game => game.pgn && (!game.rules || game.rules === "chess")).map(game => {
    const white = game.white as { username: string; rating?: number; result?: string }; const black = game.black as { username: string; rating?: number; result?: string };
    const accuracies = game.accuracies as { white: number; black: number } | undefined;
    return { url: (game.url as string) ?? null, pgn: game.pgn as string, speed: (game.time_class as string) ?? null, rated: game.rated !== false, endTime: game.end_time ? new Date((game.end_time as number) * 1000) : null, white: { username: white.username, rating: white.rating ?? null, result: white.result ?? null }, black: { username: black.username, rating: black.rating ?? null, result: black.result ?? null }, accuracies: accuracies ?? null };
  });
}

export async function fetchLichessGames(username: string, max = 600): Promise<RemoteGame[]> {
  const response = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${max}&pgnInJson=true&opening=true&moves=true&clocks=false&evals=false&perfType=bullet,blitz,rapid,classical`, { headers: { Accept: "application/x-ndjson", "User-Agent": UA["User-Agent"] }, cache: "no-store" });
  if (!response.ok) throw new Error(`Lichess answered ${response.status}.`);
  const text = await response.text();
  return text.split("\n").filter(Boolean).map(line => { try { return JSON.parse(line) as Record<string, unknown>; } catch { return null; } }).filter((game): game is Record<string, unknown> => Boolean(game?.pgn && (!game.variant || game.variant === "standard"))).map(game => {
    const players = game.players as { white: { user?: { name: string }; rating?: number }; black: { user?: { name: string }; rating?: number } };
    const winner = game.winner as string | undefined; const status = game.status as string;
    const code = (color: "white" | "black") => winner ? (winner === color ? "win" : status === "mate" ? "checkmated" : status === "outoftime" ? "timeout" : status === "resign" ? "resigned" : "lose") : status === "stalemate" ? "stalemate" : status === "draw" ? "agreed" : status;
    return { url: game.id ? `https://lichess.org/${game.id}` : null, pgn: game.pgn as string, speed: (game.speed as string) ?? null, rated: game.rated !== false, endTime: game.lastMoveAt ? new Date(game.lastMoveAt as number) : null, white: { username: players.white.user?.name ?? "Anonymous", rating: players.white.rating ?? null, result: code("white") }, black: { username: players.black.user?.name ?? "Anonymous", rating: players.black.rating ?? null, result: code("black") }, accuracies: null };
  });
}
