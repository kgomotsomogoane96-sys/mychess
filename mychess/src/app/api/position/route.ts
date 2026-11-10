import { Chess } from "chess.js";
import { pvToSan } from "@/lib/lines";
import { engineBusy, withEngine } from "@/lib/uci";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { fen?: string; depth?: number };
  const fen = String(body.fen ?? "");
  try {
    const chess = new Chess(fen);
    if (chess.isGameOver()) return Response.json({ lines: [] });
  } catch {
    return Response.json({ error: "That position is not legal." }, { status: 400 });
  }
  if (engineBusy()) return Response.json({ error: "Stockfish is reviewing a game." }, { status: 409 });
  const depth = Math.max(8, Math.min(14, Number(body.depth ?? 12)));
  const lines = await withEngine("position", (session) => session.analyze(fen, depth));
  return Response.json({
    lines: lines.slice(0, 2).map((line) => ({
      uci: line.pv[0] ?? "",
      san: line.pv[0] ? pvToSan(fen, [line.pv[0]], 1) : "",
      cp: line.cp,
      mate: line.mate,
      pv: line.pv,
      pvSan: pvToSan(fen, line.pv, 8),
    })),
  });
}
