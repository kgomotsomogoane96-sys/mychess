import { ensureDatabase } from "@/lib/bootstrap";
import { cached, invalidate } from "@/lib/cache";
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { accounts, drills, games, profile, syncCursors } from "@/db/schema";
import { resultForColor } from "@/lib/features";
import { makeDrills } from "@/lib/learning-drills";
import { buildLesson } from "@/lib/learning";
import { studyAccuracy } from "@/lib/math";
import { detectYou, parseGame, type ParsedGame } from "@/lib/pgn";
import { fetchChesscomMonth, fetchLichessGames, fetchProfile, listChesscomArchives, normalizeUsername, type RemoteGame } from "@/lib/platforms";
import { SAMPLE_GAMES } from "@/lib/samples";
import type { AccountView, AnalyzedMove, ColorName, CompactGame, DrillKind, DrillView, GameListItem, GameSummary, GameView, Platform, PositionTail, Profile } from "@/lib/types";

type GameRow = typeof games.$inferSelect;
type AccountRow = typeof accounts.$inferSelect;
type ProfileRow = typeof profile.$inferSelect;
const iso = (value: Date | null) => (value ? value.toISOString() : null);

export function toProfile(row: ProfileRow): Profile {
  return { displayName: row.displayName, chesscom: row.chesscom, lichess: row.lichess, rating: row.rating, depth: row.depth, bulkDepth: row.bulkDepth, boardTheme: (row.boardTheme as Profile["boardTheme"]) || "walnut", pieceSet: (row.pieceSet as Profile["pieceSet"]) || "cburnett", coachTone: (row.coachTone as Profile["coachTone"]) || "patient", focus: (row.focus as Profile["focus"]) || "all", sound: row.sound, showArrows: row.showArrows, activeAccountId: row.activeAccountId };
}
export function toAccount(row: AccountRow): AccountView {
  return { id: row.id, platform: row.platform as Platform, username: row.username, displayName: row.displayName, avatarUrl: row.avatarUrl, country: row.country, joinedAt: iso(row.joinedAt), ratings: row.ratings ?? {}, totalGames: row.totalGames, importedGames: row.importedGames, lastSyncedAt: iso(row.lastSyncedAt), syncStatus: row.syncStatus, syncMessage: row.syncMessage };
}
const listColumns = {
  id: games.id, source: games.source, externalUrl: games.externalUrl, accountId: games.accountId, whiteName: games.whiteName, blackName: games.blackName, whiteRating: games.whiteRating, blackRating: games.blackRating,
  result: games.result, youColor: games.youColor, opening: games.opening, openingFamily: games.openingFamily, eco: games.eco, timeControl: games.timeControl, speed: games.speed, rated: games.rated, termination: games.termination,
  yourResult: games.yourResult, oppResult: games.oppResult, endgameType: games.endgameType, endgameStartPly: games.endgameStartPly, endgameDiff: games.endgameDiff, platformAccuracy: games.platformAccuracy, event: games.event, site: games.site,
  playedAt: games.playedAt, plyCount: games.plyCount, status: games.status, analysisError: games.analysisError, depth: games.depth, accuracyWhite: games.accuracyWhite, accuracyBlack: games.accuracyBlack, acplWhite: games.acplWhite, acplBlack: games.acplBlack,
  estimatedWhite: games.estimatedWhite, estimatedBlack: games.estimatedBlack, createdAt: games.createdAt, analyzedAt: games.analyzedAt,
};
type ListRow = { [K in keyof typeof listColumns]: (typeof listColumns)[K]["_"]["data"] | null } & { id: string };
function toListItem(row: ListRow): GameListItem {
  return { ...row, source: row.source ?? "pgn", whiteName: row.whiteName ?? "White", blackName: row.blackName ?? "Black", result: row.result ?? "*", youColor: (row.youColor as ColorName | null) ?? null, opening: row.opening ?? "Uncharted opening", openingFamily: row.openingFamily ?? "Uncharted opening", rated: row.rated ?? true, plyCount: row.plyCount ?? 0, status: row.status ?? "imported", playedAt: iso(row.playedAt as Date | null), createdAt: (row.createdAt as Date).toISOString(), analyzedAt: iso(row.analyzedAt as Date | null) } as GameListItem;
}
function toGame(row: GameRow): GameView {
  return { ...toListItem(row as unknown as ListRow), pgn: row.pgn, initialFen: row.initialFen, summary: row.summary ?? null, moves: row.moves ?? null, tail: row.tail ?? null, notes: row.notes };
}

export async function ensureProfile() {
  await ensureDatabase();
  const existing = await db.select().from(profile).where(eq(profile.id, 1)).limit(1);
  if (existing[0]) return toProfile(existing[0]);
  await db.insert(profile).values({ id: 1, displayName: "You", seeded: true }).onConflictDoNothing();
  const person = toProfile((await db.select().from(profile).where(eq(profile.id, 1)))[0]);
  for (const sample of SAMPLE_GAMES) await insertParsedGame(sample.pgn, { id: sample.id, source: sample.source, youColor: sample.youColor });
  return person;
}
export async function saveProfile(input: Profile) {
  await ensureProfile();
  await db.update(profile).set({ displayName: input.displayName, chesscom: input.chesscom, lichess: input.lichess, rating: input.rating, depth: input.depth, bulkDepth: input.bulkDepth, boardTheme: input.boardTheme, pieceSet: input.pieceSet, coachTone: input.coachTone, focus: input.focus, sound: input.sound, showArrows: input.showArrows, activeAccountId: input.activeAccountId, updatedAt: new Date() }).where(eq(profile.id, 1));
  return ensureProfile();
}

export async function listAccounts() { return (await db.select().from(accounts).orderBy(asc(accounts.createdAt))).map(toAccount); }
export async function getAccount(id: string) { const row = (await db.select().from(accounts).where(eq(accounts.id, id)))[0]; return row ? toAccount(row) : null; }
export async function addAccount(platform: Platform, rawUsername: string) {
  const username = normalizeUsername(platform, rawUsername);
  if (!/^[A-Za-z0-9_-]{2,30}$/.test(username)) throw new Error("Enter a username, not a URL or email.");
  const existing = (await db.select().from(accounts).where(and(eq(accounts.platform, platform), eq(accounts.username, username))))[0];
  if (existing) return toAccount(existing);
  const remote = await fetchProfile(platform, username);
  if (!remote) throw new Error(`${platform === "chesscom" ? "Chess.com" : "Lichess"} has no player called “${username}”.`);
  const id = crypto.randomUUID();
  await db.insert(accounts).values({ id, platform, username: remote.username, displayName: remote.displayName, avatarUrl: remote.avatarUrl, country: remote.country, joinedAt: remote.joinedAt, ratings: remote.ratings, totalGames: remote.totalGames, syncStatus: "idle" });
  const current = await ensureProfile();
  if (!current.activeAccountId) await db.update(profile).set({ activeAccountId: id }).where(eq(profile.id, 1));
  await adoptOrphanGames(remote.username, id);
  return (await getAccount(id))!;
}
export async function removeAccount(id: string) {
  await db.delete(drills).where(eq(drills.accountId, id));
  await db.delete(games).where(and(eq(games.accountId, id), ne(games.source, "pgn")));
  await db.delete(accounts).where(eq(accounts.id, id));
  const current = await ensureProfile();
  if (current.activeAccountId === id) await db.update(profile).set({ activeAccountId: null }).where(eq(profile.id, 1));
}
async function adoptOrphanGames(username: string, accountId: string) {
  const orphans = await db.select({ id: games.id, white: games.whiteName, black: games.blackName }).from(games).where(and(isNull(games.accountId), ne(games.source, "sample")));
  for (const row of orphans) {
    const color = detectYou(row.white, row.black, [username]);
    if (color) await db.update(games).set({ accountId, youColor: color }).where(eq(games.id, row.id));
  }
}

export async function scopeIds(active: string | null) {
  if (active) return [active];
  return null;
}
function scopeWhere(accountIds: string[] | null) { return accountIds ? inArray(games.accountId, accountIds) : undefined; }

function rowFromParsed(parsed: ParsedGame, meta: { id?: string; source: string; externalUrl?: string | null; accountId?: string | null; youColor: ColorName | null; speed?: string | null; rated?: boolean; yourResult?: string | null; oppResult?: string | null; platformAccuracy?: number | null; playedAt?: Date | null }) {
  const color = meta.youColor;
  const yourResult = meta.yourResult ?? (color ? (resultForColor(parsed.result, color) === "win" ? "win" : parsed.terminationCode) : null);
  const oppResult = meta.oppResult ?? (color ? (resultForColor(parsed.result, color) === "loss" ? "win" : parsed.terminationCode) : null);
  return {
    id: meta.id ?? crypto.randomUUID(), pgnHash: parsed.pgnHash, source: meta.source, externalUrl: meta.externalUrl ?? null, accountId: meta.accountId ?? null, whiteName: parsed.whiteName, blackName: parsed.blackName, whiteRating: parsed.whiteRating, blackRating: parsed.blackRating,
    result: parsed.result, youColor: color, opening: parsed.opening, openingFamily: parsed.openingFamily, openingLine: parsed.facts.openingLine, eco: parsed.eco, timeControl: parsed.timeControl, speed: meta.speed ?? parsed.speed, rated: meta.rated ?? true,
    termination: parsed.terminationText, yourResult, oppResult, endgameType: parsed.facts.endgameType, endgameStartPly: parsed.facts.endgameStartPly, endgameDiff: parsed.facts.endgameDiff, whiteCastledPly: parsed.facts.whiteCastledPly, blackCastledPly: parsed.facts.blackCastledPly,
    platformAccuracy: meta.platformAccuracy ?? null, event: parsed.event, site: parsed.site, playedAt: meta.playedAt ?? parsed.playedAt, pgn: parsed.pgn, initialFen: parsed.initialFen, plyCount: parsed.plyCount, status: "imported", notes: "",
  };
}

export async function insertParsedGame(raw: string, options: { id?: string; source: string; externalUrl?: string | null; youColor?: ColorName | null; speed?: string | null }) {
  let parsed: ParsedGame;
  try { parsed = parseGame(raw); } catch (error) { return { error: error instanceof Error ? error.message : "Could not read that PGN." }; }
  const hit = await db.select({ id: games.id }).from(games).where(eq(games.pgnHash, parsed.pgnHash)).limit(1);
  if (hit[0]) return { id: hit[0].id, skipped: true as const };
  const linked = await listAccounts();
  const match = linked.find(account => detectYou(parsed.whiteName, parsed.blackName, [account.username, account.displayName]));
  const youColor = options.youColor === undefined ? (match ? detectYou(parsed.whiteName, parsed.blackName, [match.username, match.displayName]) : null) : options.youColor;
  const row = rowFromParsed(parsed, { id: options.id, source: options.source, externalUrl: options.externalUrl, accountId: match?.id ?? null, youColor, speed: options.speed });
  await db.insert(games).values(row).onConflictDoNothing();
  invalidate("compact:");
  return { id: row.id, skipped: false as const, white: parsed.whiteName, black: parsed.blackName, opening: parsed.opening };
}

export type SyncProgress = {
  type: "start" | "month" | "progress" | "done" | "error";
  message: string;
  imported?: number; scanned?: number; total?: number; months?: number; month?: number;
  complete?: boolean; cursor?: number;
};

/**
 * Imports one bounded batch of archive months. A Vercel function has a 60s
 * ceiling, so full archives are resumed by repeated calls using sync_cursors.
 */
export async function syncAccount(
  accountId: string,
  onProgress: (event: SyncProgress) => void,
  options: { full?: boolean; reset?: boolean; batchSize?: number } = {},
) {
  const account = await getAccount(accountId);
  if (!account) throw new Error("Account not found");
  const stateId = `${accountId}:${options.full ? "full" : "incremental"}`;
  if (options.reset) await db.delete(syncCursors).where(eq(syncCursors.id, stateId));
  const saved = (await db.select().from(syncCursors).where(eq(syncCursors.id, stateId)).limit(1))[0];
  let cursor = saved?.cursor ?? 0;
  let untouched = saved?.untouched ?? 0;
  let complete = false;
  await db.update(accounts).set({ syncStatus: "syncing", syncMessage: "Fetching games…" }).where(eq(accounts.id, accountId));
  const existing = new Set((await db.select({ url: games.externalUrl }).from(games).where(and(eq(games.accountId, accountId), isNotNull(games.externalUrl)))).map(row => row.url as string));
  let imported = 0, scanned = 0;
  const usernames = [account.username, account.displayName];
  const ingest = async (batch: RemoteGame[]) => {
    const rows = [];
    for (const game of batch) {
      scanned += 1;
      if (game.url && existing.has(game.url)) continue;
      try {
        const parsed = parseGame(game.pgn);
        const color = detectYou(game.white.username, game.black.username, usernames) ?? detectYou(parsed.whiteName, parsed.blackName, usernames);
        const me = color === "white" ? game.white : color === "black" ? game.black : null;
        const opp = color === "white" ? game.black : color === "black" ? game.white : null;
        rows.push(rowFromParsed(parsed, { source: account.platform, externalUrl: game.url, accountId, youColor: color, speed: game.speed, rated: game.rated, yourResult: me?.result ?? null, oppResult: opp?.result ?? null, platformAccuracy: game.accuracies ? (color === "white" ? game.accuracies.white : color === "black" ? game.accuracies.black : null) : null, playedAt: game.endTime }));
        if (game.url) existing.add(game.url);
      } catch { /* unreadable PGN: skip */ }
    }
    for (let i = 0; i < rows.length; i += 100) await db.insert(games).values(rows.slice(i, i + 100)).onConflictDoNothing();
    imported += rows.length;
  };
  try {
    const remote = await fetchProfile(account.platform, account.username);
    if (remote) await db.update(accounts).set({ displayName: remote.displayName, avatarUrl: remote.avatarUrl, country: remote.country, joinedAt: remote.joinedAt, ratings: remote.ratings, totalGames: remote.totalGames }).where(eq(accounts.id, accountId));
    if (account.platform === "chesscom") {
      const archives = await listChesscomArchives(account.username);
      cursor = Math.min(cursor, archives.length);
      const batchSize = Math.min(4, Math.max(1, options.batchSize ?? 3));
      const end = Math.min(archives.length, cursor + batchSize);
      onProgress({ type: "start", message: `Archive ${Math.min(cursor + 1, archives.length)}–${end} of ${archives.length} months`, months: archives.length, total: remote?.totalGames ?? 0 });
      for (let index = cursor; index < end; index += 1) {
        const month = await fetchChesscomMonth(archives[index]);
        const before = imported;
        await ingest(month);
        untouched = imported === before ? untouched + 1 : 0;
        cursor = index + 1;
        onProgress({ type: "month", message: `${archives[index].slice(-7).replace("/", "-")}: ${imported - before} new of ${month.length} games`, imported, scanned, months: archives.length, month: index + 1, total: remote?.totalGames ?? 0 });
        if (!options.full && untouched >= 2 && existing.size > 0) {
          onProgress({ type: "progress", message: "Older months are already in your library.", imported, scanned });
          complete = true;
          break;
        }
        await new Promise(resolve => setImmediate(resolve));
      }
      if (cursor >= archives.length) complete = true;
    } else {
      onProgress({ type: "start", message: "Fetching your recent Lichess games…", months: 1, total: remote?.totalGames ?? 0 });
      await ingest(await fetchLichessGames(account.username, options.full ? 600 : 300));
      onProgress({ type: "month", message: `${imported} new games imported`, imported, scanned, months: 1, month: 1 });
      complete = true;
    }
    const total = await db.select({ value: count() }).from(games).where(eq(games.accountId, accountId));
    await db.insert(syncCursors).values({ id: stateId, scope: options.full ? "full" : "incremental", cursor, untouched, complete, updatedAt: new Date() })
      .onConflictDoUpdate({ target: syncCursors.id, set: { cursor, untouched, complete, updatedAt: new Date() } });
    await db.update(accounts).set({
      syncStatus: complete ? "ready" : "syncing",
      syncMessage: complete ? `${imported} new games in the final batch` : `Batch complete · month ${cursor}`,
      importedGames: total[0]?.value ?? 0,
      lastSyncedAt: complete ? new Date() : account.lastSyncedAt ? new Date(account.lastSyncedAt) : null,
    }).where(eq(accounts.id, accountId));
    invalidate("compact:");
    onProgress({ type: "done", message: complete ? `${imported} new games in the final batch. ${scanned} checked.` : `${imported} new games in this batch. Continuing…`, imported, scanned, complete, cursor });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    await db.update(accounts).set({ syncStatus: "error", syncMessage: message }).where(eq(accounts.id, accountId));
    onProgress({ type: "error", message, imported, scanned, complete: true });
  }
  return { imported, scanned, complete, cursor };
}

export type GameFilters = { accountIds: string[] | null; q?: string; color?: string; result?: string; speed?: string; status?: string; opening?: string; endgame?: string; page?: number; pageSize?: number; sort?: string };
export async function listGamesPage(filters: GameFilters) {
  const clauses: (SQL | undefined)[] = [scopeWhere(filters.accountIds)];
  if (filters.q) clauses.push(or(ilike(games.whiteName, `%${filters.q}%`), ilike(games.blackName, `%${filters.q}%`), ilike(games.opening, `%${filters.q}%`), ilike(games.openingFamily, `%${filters.q}%`)));
  if (filters.color === "white" || filters.color === "black") clauses.push(eq(games.youColor, filters.color));
  if (filters.speed && filters.speed !== "all") clauses.push(eq(games.speed, filters.speed));
  if (filters.status === "analyzed") clauses.push(eq(games.status, "analyzed"));
  if (filters.status === "unread") clauses.push(ne(games.status, "analyzed"));
  if (filters.opening) clauses.push(eq(games.openingFamily, filters.opening));
  if (filters.endgame === "yes") clauses.push(isNotNull(games.endgameStartPly));
  if (filters.result === "win") clauses.push(or(and(eq(games.youColor, "white"), eq(games.result, "1-0")), and(eq(games.youColor, "black"), eq(games.result, "0-1"))));
  if (filters.result === "loss") clauses.push(or(and(eq(games.youColor, "white"), eq(games.result, "0-1")), and(eq(games.youColor, "black"), eq(games.result, "1-0"))));
  if (filters.result === "draw") clauses.push(eq(games.result, "1/2-1/2"));
  const where = and(...clauses.filter((clause): clause is SQL => Boolean(clause)));
  const pageSize = filters.pageSize ?? 24; const page = Math.max(1, filters.page ?? 1);
  const order = filters.sort === "accuracy" ? [desc(sql`coalesce(case when ${games.youColor} = 'black' then ${games.accuracyBlack} else ${games.accuracyWhite} end, -1)`)] : filters.sort === "oldest" ? [asc(games.playedAt)] : [desc(sql`coalesce(${games.playedAt}, ${games.createdAt})`)];
  const [rows, total] = await Promise.all([db.select(listColumns).from(games).where(where).orderBy(...order).limit(pageSize).offset((page - 1) * pageSize), db.select({ value: count() }).from(games).where(where)]);
  return { items: rows.map(row => toListItem(row as ListRow)), total: total[0]?.value ?? 0, page, pageSize };
}
export async function recentGames(accountIds: string[] | null, limit = 6) { return (await listGamesPage({ accountIds, pageSize: limit })).items; }

/** In-process memo: the analytics dataset is ~12k rows and feeds four pages.
 * Slow analytics pages also use 20s route-level ISR, so Vercel serves the
 * rendered HTML from its edge cache without re-running these queries. */
export function compactGames(accountIds: string[] | null): Promise<CompactGame[]> {
  return cached(`compact:${(accountIds ?? ["all"]).join(",")}`, 25_000, () => loadCompactGames(accountIds));
}

async function loadCompactGames(accountIds: string[] | null): Promise<CompactGame[]> {
  const rows = await db.select({ id: games.id, accountId: games.accountId, source: games.source, youColor: games.youColor, result: games.result, speed: games.speed, rated: games.rated, openingFamily: games.openingFamily, opening: games.opening, openingLine: games.openingLine, eco: games.eco, yourResult: games.yourResult, oppResult: games.oppResult, termination: games.termination, endgameType: games.endgameType, endgameStartPly: games.endgameStartPly, endgameDiff: games.endgameDiff, whiteCastledPly: games.whiteCastledPly, blackCastledPly: games.blackCastledPly, whiteRating: games.whiteRating, blackRating: games.blackRating, platformAccuracy: games.platformAccuracy, playedAt: games.playedAt, plyCount: games.plyCount, status: games.status, accuracyWhite: games.accuracyWhite, accuracyBlack: games.accuracyBlack, acplWhite: games.acplWhite, acplBlack: games.acplBlack, summary: games.summary }).from(games).where(and(scopeWhere(accountIds), ne(games.source, "sample"), isNotNull(games.youColor))).orderBy(asc(games.playedAt));
  return rows.map(row => ({ ...row, youColor: row.youColor as ColorName | null, playedAt: iso(row.playedAt), summary: (row.summary as GameSummary | null) ?? null }));
}

export async function getGame(id: string) { const rows = await db.select().from(games).where(eq(games.id, id)).limit(1); return rows[0] ? toGame(rows[0]) : null; }
export async function getGamesByIds(ids: string[]) { if (!ids.length) return []; return (await db.select().from(games).where(inArray(games.id, ids))).map(toGame); }

/** Lightweight replay fetch — avoids pulling moves/summary JSONB for endgame cards. */
export async function getReplayGames(ids: string[]) {
  if (!ids.length) return [];
  return db.select({ id: games.id, pgn: games.pgn, whiteName: games.whiteName, blackName: games.blackName }).from(games).where(inArray(games.id, ids));
}

export async function updateGameFields(id: string, patch: { notes?: string; youColor?: ColorName | null }) {
  await db.update(games).set({ notes: patch.notes, youColor: patch.youColor }).where(eq(games.id, id));
  if (patch.youColor === undefined) return;
  const row = (await db.select().from(games).where(eq(games.id, id)))[0];
  if (!row?.moves?.length) return;
  const person = await ensureProfile();
  await personalizeAnalysis(row, patch.youColor, person.focus);
}
async function personalizeAnalysis(row: GameRow, color: ColorName | null, focus: Profile["focus"]) {
  const moves = row.moves ?? [];
  const side = color === "white" ? "w" : color === "black" ? "b" : null;
  const relevant = moves.filter(move => !side || move.color === side);
  const important = relevant.filter(move => ["blunder", "mistake", "miss", "brilliant"].includes(move.classification)).sort((a, b) => b.cpLoss - a.cpLoss);
  const lessons = [...new Set(important.map(move => buildLesson(move, color).habit))].slice(0, 3);
  const leak = (["opening", "middlegame", "endgame"] as const).map(phase => { const values = relevant.filter(move => move.phase === phase).map(move => move.accuracy); return { phase, accuracy: values.length ? studyAccuracy(values) : 101 }; }).sort((a, b) => a.accuracy - b.accuracy)[0];
  if (row.summary) {
    await db.update(games).set({ summary: { ...row.summary, headline: color ? `Your ${color} game, decoded. ${important.length} moment${important.length === 1 ? "" : "s"} worth a closer look.` : "A game worth understanding. Explore the moments that changed the position.", lessons: lessons.length ? lessons : row.summary.lessons, yourLeak: leak.accuracy <= 100 ? leak.phase : null, keyMoments: row.summary.keyMoments.map(moment => { const move = moves.find(item => item.ply === moment.ply); return move ? { ...moment, comment: buildLesson(move, color).summary } : moment; }) } }).where(eq(games.id, row.id));
  }
  await replaceDrills(row.id, row.accountId, makeDrills(moves, color, focus));
}

export async function saveAnalysis(id: string, analysis: { depth: number; moves: AnalyzedMove[]; tail: PositionTail; summary: GameSummary; accuracyWhite: number; accuracyBlack: number; acplWhite: number; acplBlack: number; estimatedWhite: number; estimatedBlack: number }) {
  await db.update(games).set({ status: "analyzed", depth: analysis.depth, moves: analysis.moves, tail: analysis.tail, summary: analysis.summary, accuracyWhite: analysis.accuracyWhite, accuracyBlack: analysis.accuracyBlack, acplWhite: analysis.acplWhite, acplBlack: analysis.acplBlack, estimatedWhite: analysis.estimatedWhite, estimatedBlack: analysis.estimatedBlack, analysisError: null, analyzedAt: new Date() }).where(eq(games.id, id));
}
export async function deleteGame(id: string) { await db.delete(drills).where(eq(drills.gameId, id)); await db.delete(games).where(eq(games.id, id)); invalidate("compact:"); }

export async function queueGames(options: { accountIds: string[] | null; scope: "recent" | "losses" | "rapid" | "unanalyzed" | "ids"; limit: number; ids?: string[] }) {
  const clauses: (SQL | undefined)[] = [scopeWhere(options.accountIds), inArray(games.status, ["imported", "failed"]), ne(games.source, "sample")];
  if (options.scope === "losses") clauses.push(or(and(eq(games.youColor, "white"), eq(games.result, "0-1")), and(eq(games.youColor, "black"), eq(games.result, "1-0"))));
  if (options.scope === "rapid") clauses.push(inArray(games.speed, ["rapid", "classical"]));
  if (options.scope === "ids") clauses.push(inArray(games.id, options.ids?.length ? options.ids : ["none"]));
  const rows = await db.select({ id: games.id }).from(games).where(and(...clauses.filter((clause): clause is SQL => Boolean(clause)))).orderBy(desc(sql`coalesce(${games.playedAt}, ${games.createdAt})`)).limit(Math.min(options.limit, 25000));
  if (!rows.length) return 0;
  const priority = options.scope === "ids" ? 100 : options.scope === "losses" ? 60 : options.scope === "rapid" ? 50 : options.scope === "recent" ? 40 : 10;
  await db.update(games).set({ status: "queued", priority, queuedAt: new Date(), analysisError: null }).where(inArray(games.id, rows.map(row => row.id)));
  invalidate("compact:");
  return rows.length;
}
export async function clearQueue() { await db.update(games).set({ status: "imported", queuedAt: null }).where(eq(games.status, "queued")); }
export async function nextQueued() { const row = (await db.select().from(games).where(eq(games.status, "queued")).orderBy(desc(games.priority), asc(games.queuedAt)).limit(1))[0]; return row ? toGame(row) : null; }
export async function markGameStatus(id: string, status: string, error?: string | null) { await db.update(games).set({ status, analysisError: error ?? null }).where(eq(games.id, id)); }
export async function resetStuckAnalysis() { await db.update(games).set({ status: "queued" }).where(eq(games.status, "analyzing")); }
export async function queueCounts(accountIds: string[] | null) {
  const rows = await db.select({ status: games.status, value: count() }).from(games).where(and(scopeWhere(accountIds), ne(games.source, "sample"))).groupBy(games.status);
  const map = Object.fromEntries(rows.map(row => [row.status, row.value]));
  return { queued: map.queued ?? 0, analyzing: map.analyzing ?? 0, analyzed: map.analyzed ?? 0, imported: map.imported ?? 0, failed: map.failed ?? 0 };
}
export async function recentlyAnalyzed(accountIds: string[] | null, limit = 8) {
  const rows = await db.select(listColumns).from(games).where(and(scopeWhere(accountIds), eq(games.status, "analyzed"))).orderBy(desc(games.analyzedAt)).limit(limit);
  return rows.map(row => toListItem(row as ListRow));
}

export async function replaceDrills(gameId: string, accountId: string | null, next: { kind: DrillKind; found: boolean; ply: number; fen: string; solution: string; solutionSan: string; playedSan: string; prompt: string; theme: string; classification: string }[]) {
  const existing = await db.select().from(drills).where(eq(drills.gameId, gameId));
  const previous = new Map(existing.map(drill => [`${drill.ply}:${drill.solution}`, drill]));
  await db.delete(drills).where(eq(drills.gameId, gameId));
  if (!next.length) return;
  await db.insert(drills).values(next.map(drill => { const old = previous.get(`${drill.ply}:${drill.solution}`); return { id: old?.id ?? crypto.randomUUID(), gameId, accountId, ...drill, attempts: old?.attempts ?? 0, solved: old?.solved ?? 0, lastResult: old?.lastResult ?? null }; }));
}
export async function listDrills(accountIds: string[] | null, limit = 400): Promise<DrillView[]> {
  const rows = await db.select({ id: drills.id, gameId: drills.gameId, accountId: drills.accountId, kind: drills.kind, found: drills.found, ply: drills.ply, fen: drills.fen, solution: drills.solution, solutionSan: drills.solutionSan, playedSan: drills.playedSan, prompt: drills.prompt, theme: drills.theme, classification: drills.classification, attempts: drills.attempts, solved: drills.solved, lastResult: drills.lastResult, whiteName: games.whiteName, blackName: games.blackName, opening: games.opening, playedAt: games.playedAt }).from(drills).innerJoin(games, eq(drills.gameId, games.id)).where(accountIds ? inArray(drills.accountId, accountIds) : undefined).orderBy(desc(games.playedAt), desc(drills.createdAt)).limit(limit);
  return rows.map(row => ({ ...row, kind: row.kind as DrillKind, playedAt: iso(row.playedAt) }));
}
/** One source of truth for practice counts, with no display limit. */
export async function drillStats(accountIds: string[] | null) {
  const where = accountIds ? inArray(drills.accountId, accountIds) : undefined;
  const [totals, kinds] = await Promise.all([
    db.select({
      total: sql<number>`cast(count(*) as int)`,
      mastered: sql<number>`cast(count(*) filter (where ${drills.lastResult} = 'solved') as int)`,
      attempted: sql<number>`cast(count(*) filter (where ${drills.attempts} > 0) as int)`,
      revealed: sql<number>`cast(count(*) filter (where ${drills.lastResult} = 'revealed') as int)`,
    }).from(drills).innerJoin(games, eq(drills.gameId, games.id)).where(where),
    db.select({ kind: drills.kind, value: sql<number>`cast(count(*) as int)` }).from(drills).innerJoin(games, eq(drills.gameId, games.id)).where(where).groupBy(drills.kind),
  ]);
  const row = totals[0];
  const total = Number(row?.total ?? 0);
  const mastered = Number(row?.mastered ?? 0);
  return {
    total,
    mastered,
    due: total - mastered,
    attempted: Number(row?.attempted ?? 0),
    revealed: Number(row?.revealed ?? 0),
    byKind: Object.fromEntries(kinds.map(item => [item.kind, Number(item.value)])) as Record<string, number>,
  };
}

export async function recordDrill(id: string, outcome: "solved" | "revealed" | "missed") {
  const drill = (await db.select().from(drills).where(eq(drills.id, id)).limit(1))[0];
  if (!drill) return null;
  const update = { attempts: drill.attempts + 1, solved: drill.solved + (outcome === "solved" ? 1 : 0), lastResult: outcome === "missed" && drill.lastResult === "solved" ? "solved" : outcome };
  await db.update(drills).set(update).where(eq(drills.id, id));
  return { ...drill, ...update };
}
