import { ensureDatabase } from "@/lib/bootstrap";
import { dbUnavailable } from "@/lib/db-status";
import { addAccount, listAccounts } from "@/lib/store";
import type { Platform } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const unavailable = dbUnavailable(); if (unavailable) return unavailable;
  await ensureDatabase();
  return Response.json(await listAccounts());
}

export async function POST(request: Request) {
  const unavailable = dbUnavailable(); if (unavailable) return unavailable;
  await ensureDatabase();
  const body = (await request.json()) as { platform?: Platform; username?: string };
  if (body.platform !== "chesscom" && body.platform !== "lichess") return Response.json({ error: "Choose Chess.com or Lichess." }, { status: 400 });
  try {
    const account = await addAccount(body.platform, String(body.username ?? ""));
    return Response.json(account);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not link that account." }, { status: 400 });
  }
}
