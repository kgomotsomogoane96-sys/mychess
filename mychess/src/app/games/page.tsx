import { databaseUrl } from "@/lib/database-url";
import { SetupScreen } from "@/components/setup-screen";
import { Suspense } from "react";
import { GamesDesk } from "@/components/games-desk";
import { getScope } from "@/lib/scope";
import { listGamesPage } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "My games" };

export default async function GamesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!databaseUrl()) return <SetupScreen/>;
  const params = await searchParams; const scope = await getScope();
  const page = await listGamesPage({ accountIds: scope.accountIds, q: params.q, color: params.color, result: params.result, speed: params.speed, status: params.status, opening: params.opening, endgame: params.endgame, sort: params.sort, page: Number(params.page) || 1, pageSize: 24 });
  return <Suspense><GamesDesk items={page.items} total={page.total} page={page.page} pageSize={page.pageSize} scopeLabel={scope.scopeLabel}/></Suspense>;
}
