import { Suspense } from "react";
import { databaseUrl } from "@/lib/database-url";
import { SetupScreen } from "@/components/setup-screen";
import { GreatGamesDesk } from "@/components/great-games-desk";
import { getScope } from "@/lib/scope";
import { listReference } from "@/lib/reference";

export const dynamic = "force-dynamic";
export const metadata = { title: "Great games" };

export default async function GreatGamesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!databaseUrl()) return <SetupScreen/>;
  const params = await searchParams;
  const scope = await getScope();
  const page = await listReference({
    q: params.q,
    opening: params.opening,
    player: params.player,
    era: params.era,
    tier: params.tier,
    page: Number(params.page) || 1,
    pageSize: 30,
  });
  return <Suspense><GreatGamesDesk items={page.items} total={page.total} page={page.page} pageSize={page.pageSize} scopeLabel={scope.scopeLabel} profile={scope.profile}/></Suspense>;
}
