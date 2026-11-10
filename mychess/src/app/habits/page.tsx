import { databaseUrl } from "@/lib/database-url";
import { SetupScreen } from "@/components/setup-screen";
import { HabitsDesk } from "@/components/habits-desk";
import { habitsReport } from "@/lib/coachplan";
import { getScope } from "@/lib/scope";
import { compactGames } from "@/lib/store";

export const revalidate = 20;
export const metadata = { title: "Habits" };

export default async function HabitsPage() {
  if (!databaseUrl()) return <SetupScreen/>;
  const scope = await getScope();
  const games = await compactGames(scope.accountIds);
  return <HabitsDesk report={habitsReport(games)} scopeLabel={scope.scopeLabel} account={scope.account}/>;
}
