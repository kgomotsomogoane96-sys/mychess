import { databaseUrl } from "@/lib/database-url";
import { SetupScreen } from "@/components/setup-screen";
import { EngineDesk } from "@/components/engine-desk";
import { getScope } from "@/lib/scope";
import { recentlyAnalyzed } from "@/lib/store";
import { workerStatus } from "@/lib/worker";

export const dynamic = "force-dynamic";
export const metadata = { title: "Engine lab" };

export default async function EnginePage() {
  if (!databaseUrl()) return <SetupScreen/>;
  const scope = await getScope();
  const [status, recent] = await Promise.all([workerStatus(scope.accountIds), recentlyAnalyzed(scope.accountIds, 10)]);
  return <EngineDesk status={status} recent={recent} profile={scope.profile} scopeLabel={scope.scopeLabel}/>;
}
