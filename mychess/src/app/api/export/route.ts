import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, drills, games, profile, referenceGames, theoryProgress } from "@/db/schema";
import { dbUnavailable } from "@/lib/db-status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const LIMIT = 250_000;

/** Human-readable, restore-ready backup of everything the app owns. */
export async function GET(request: Request) {
  const unavailable = dbUnavailable(); if (unavailable) return unavailable;
  const includeReference = new URL(request.url).searchParams.get("reference") === "1";
  try {
    const [profileRow] = await db.select().from(profile).where(eq(profile.id, 1)).limit(1);
    const [gameRows, drillRows, accountRows, theoryRows] = await Promise.all([
      db.select({ id: games.id, source: games.source, externalUrl: games.externalUrl, accountId: games.accountId, whiteName: games.whiteName, blackName: games.blackName, result: games.result, youColor: games.youColor, opening: games.opening, openingFamily: games.openingFamily, eco: games.eco, speed: games.speed, timeControl: games.timeControl, playedAt: games.playedAt, plyCount: games.plyCount, status: games.status, accuracyWhite: games.accuracyWhite, accuracyBlack: games.accuracyBlack, notes: games.notes, pgn: games.pgn, analyzedAt: games.analyzedAt }).from(games).orderBy(asc(games.createdAt)).limit(LIMIT),
      db.select().from(drills).orderBy(asc(drills.createdAt)).limit(LIMIT),
      db.select().from(accounts).orderBy(asc(accounts.createdAt)),
      db.select().from(theoryProgress).orderBy(asc(theoryProgress.completedAt)),
    ]);
    const reference = includeReference ? await db.select({ id: referenceGames.id, externalUrl: referenceGames.externalUrl, whiteName: referenceGames.whiteName, blackName: referenceGames.blackName, result: referenceGames.result, opening: referenceGames.opening, playedAt: referenceGames.playedAt, pgn: referenceGames.pgn }).from(referenceGames).limit(LIMIT) : undefined;
    const payload = {
      format: "mychass.backup.v1",
      exportedAt: new Date().toISOString(),
      counts: { games: gameRows.length, drills: drillRows.length, accounts: accountRows.length, theory: theoryRows.length, reference: reference?.length ?? 0 },
      profile: profileRow ?? null,
      accounts: accountRows,
      games: gameRows,
      drills: drillRows,
      theoryProgress: theoryRows,
      referenceGames: reference,
    };
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="mychess-backup-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Export failed" }, { status: 500 });
  }
}
