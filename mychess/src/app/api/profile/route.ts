import { ensureDatabase } from "@/lib/bootstrap";
import { dbUnavailable } from "@/lib/db-status";
import { ensureProfile, listAccounts, saveProfile } from "@/lib/store";
import type { BoardThemeName, CoachTone, Profile, StudyFocus } from "@/lib/types";

export const dynamic = "force-dynamic";
const THEMES = new Set(["neon", "walnut", "ink", "sage", "ice"]);
const PIECE_SETS = new Set(["chessnut", "merida", "cburnett"]);
const TONES = new Set(["patient", "direct", "sharp"]);
const FOCI = new Set(["all", "tactics", "openings", "endgames"]);

export async function GET() {
  const unavailable = dbUnavailable(); if (unavailable) return unavailable;
  await ensureDatabase();
  const [person, accounts] = await Promise.all([ensureProfile(), listAccounts()]);
  return Response.json({ ...person, accounts });
}

export async function PUT(request: Request) {
  const unavailable = dbUnavailable(); if (unavailable) return unavailable;
  await ensureDatabase();
  const body = (await request.json()) as Partial<Profile>;
  const current = await ensureProfile();
  const accounts = await listAccounts();
  const rating = Number(body.rating ?? current.rating); const depth = Number(body.depth ?? current.depth); const bulkDepth = Number(body.bulkDepth ?? current.bulkDepth);
  const activeAccountId = body.activeAccountId === undefined ? current.activeAccountId : body.activeAccountId && accounts.some(account => account.id === body.activeAccountId) ? body.activeAccountId : null;
  const next: Profile = {
    displayName: String(body.displayName ?? current.displayName).trim().slice(0, 40) || "You",
    chesscom: String(body.chesscom ?? current.chesscom).trim().replace(/^@/, "").slice(0, 32),
    lichess: String(body.lichess ?? current.lichess).trim().replace(/^@/, "").slice(0, 32),
    rating: Number.isFinite(rating) ? Math.max(100, Math.min(3200, Math.round(rating))) : current.rating,
    depth: [8, 10, 12, 14].includes(depth) ? depth : current.depth,
    bulkDepth: [8, 10, 12].includes(bulkDepth) ? bulkDepth : current.bulkDepth,
    boardTheme: THEMES.has(String(body.boardTheme)) ? (body.boardTheme as BoardThemeName) : current.boardTheme,
    pieceSet: PIECE_SETS.has(String(body.pieceSet)) ? (body.pieceSet as Profile["pieceSet"]) : current.pieceSet,
    coachTone: TONES.has(String(body.coachTone)) ? (body.coachTone as CoachTone) : current.coachTone,
    focus: FOCI.has(String(body.focus)) ? (body.focus as StudyFocus) : current.focus,
    sound: typeof body.sound === "boolean" ? body.sound : current.sound,
    showArrows: typeof body.showArrows === "boolean" ? body.showArrows : current.showArrows,
    activeAccountId,
  };
  const saved = await saveProfile(next);
  return Response.json({ ...saved, accounts });
}
