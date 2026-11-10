export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const fen = new URL(request.url).searchParams.get("fen");
  if (!fen) return Response.json({ error: "Missing FEN" }, { status: 400 });
  const endpoint = `https://explorer.lichess.ovh/masters?fen=${encodeURIComponent(fen)}&moves=8&topGames=0`;
  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) return Response.json({ moves: [], opening: null, unavailable: true });
    const json = (await response.json()) as {
      opening?: { eco?: string; name?: string } | null;
      moves?: { san: string; uci: string; white: number; draws: number; black: number; averageRating?: number }[];
    };
    return Response.json({
      opening: json.opening ?? null,
      moves: (json.moves ?? []).slice(0, 6).map((move) => ({
        san: move.san,
        uci: move.uci,
        white: move.white,
        draws: move.draws,
        black: move.black,
        games: move.white + move.draws + move.black,
        averageRating: move.averageRating ?? null,
      })),
    });
  } catch {
    return Response.json({ moves: [], opening: null, unavailable: true });
  }
}
