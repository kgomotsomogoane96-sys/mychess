import { databaseUrl } from "@/lib/database-url";
import { SetupScreen } from "@/components/setup-screen";
import { Suspense } from "react";
import { LibraryDesk } from "@/components/library-desk";
import { getScope } from "@/lib/scope";
import { listReference } from "@/lib/reference";

export const dynamic = "force-dynamic";
export const metadata = { title: "Universal library" };

export default async function LibraryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!databaseUrl()) return <SetupScreen/>;
  const params = await searchParams; const scope = await getScope();
  const page = await listReference({ q: params.q, opening: params.opening, player: params.player, page: Number(params.page) || 1, pageSize: 30 });
  return <Suspense><LibraryDesk items={page.items} total={page.total} page={page.page} pageSize={page.pageSize} families={page.families} theme={scope.profile.boardTheme}/></Suspense>;
}
