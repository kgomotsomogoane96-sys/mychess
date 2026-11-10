import { databaseUrl } from "@/lib/database-url";
import { SetupScreen } from "@/components/setup-screen";
import { Suspense } from "react";
import { PracticeStage } from "@/components/practice-stage";
import { getScope } from "@/lib/scope";
import { drillStats, listDrills } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Practice" };

export default async function PracticePage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  if (!databaseUrl()) return <SetupScreen/>;
  const params = await searchParams; const scope = await getScope();
  const [drills, practice] = await Promise.all([listDrills(scope.accountIds, 400), drillStats(scope.accountIds)]);
  return <Suspense><PracticeStage drills={drills} stats={practice} profile={scope.profile} initialKind={params.kind ?? "all"} scopeLabel={scope.scopeLabel}/></Suspense>;
}
