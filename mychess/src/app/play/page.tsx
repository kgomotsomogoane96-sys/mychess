import { databaseUrl } from "@/lib/database-url";
import { SetupScreen } from "@/components/setup-screen";
import { Suspense } from "react";
import { PlayStage } from "@/components/play-stage";
import { getScope } from "@/lib/scope";
import { getGame } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Play the engine" };

export default async function PlayPage({ searchParams }: { searchParams: Promise<{ fen?: string; game?: string; label?: string }> }) {
  if (!databaseUrl()) return <SetupScreen/>;
  const params = await searchParams; const scope = await getScope();
  const source = params.game ? await getGame(params.game) : null;
  const rating = scope.account?.ratings.rapid?.rating ?? scope.account?.ratings.blitz?.rating ?? scope.profile.rating;
  return <Suspense><PlayStage profile={scope.profile} startFen={params.fen ?? null} label={params.label ?? (source ? `${source.whiteName} vs ${source.blackName}` : null)} sourceGameId={source?.id ?? null} rating={rating} youColor={source?.youColor ?? null}/></Suspense>;
}
