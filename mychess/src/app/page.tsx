import { databaseUrl } from "@/lib/database-url";
import { Dashboard } from "@/components/dashboard";
import { SetupScreen } from "@/components/setup-screen";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { theoryProgress } from "@/db/schema";
import { WORKSPACE_UID } from "@/lib/constants";
import { todayModule } from "@/lib/curriculum";
import { referenceCount } from "@/lib/reference";
import { buildPlan, openingFamilies, overallScore } from "@/lib/coachplan";
import { getScope } from "@/lib/scope";
import { compactGames, drillStats, listDrills, recentGames } from "@/lib/store";
import { workerStatus } from "@/lib/worker";

export const revalidate = 20;

export default async function HomePage() {
  if (!databaseUrl()) return <SetupScreen/>;
  const scope = await getScope();
  const [games, recent, drills, worker, progressRows, refCount, practice] = await Promise.all([
    compactGames(scope.accountIds), recentGames(scope.accountIds, 6), listDrills(scope.accountIds, 200), workerStatus(scope.accountIds),
    db.select().from(theoryProgress).where(eq(theoryProgress.uid, WORKSPACE_UID)), referenceCount(),
    drillStats(scope.accountIds),
  ]);
  const score = overallScore(games);
  const analyzed = games.filter(game => game.status === "analyzed").length;
  const plan = buildPlan(games, { analyzed, queued: worker.queued, hasAccounts: scope.accounts.length > 0 });
  const openings = openingFamilies(games).filter(row => row.games >= 5).slice(0, 6);
  const nextDrill = drills.find(drill => drill.lastResult !== "solved") ?? drills[0] ?? null;
  const today = todayModule(); const todayKey = new Date().toISOString().slice(0, 10);
  const doneDates = new Set(progressRows.map(row => row.completedAt.toISOString().slice(0, 10)));
  let streakCount = 0; const cursor = new Date();
  for (let i = 0; i < 60; i += 1) {
    const key = cursor.toISOString().slice(0, 10);
    if (doneDates.has(key)) { streakCount += 1; cursor.setUTCDate(cursor.getUTCDate() - 1); }
    else if (i === 0) cursor.setUTCDate(cursor.getUTCDate() - 1);
    else break;
  }
  const theory = { id: today.id, title: today.title, promise: today.promise, completed: progressRows.length, total: 10, todayDone: progressRows.some(row => row.moduleId === today.id && row.completedAt.toISOString().slice(0, 10) === todayKey), streak: streakCount };
  return <Dashboard account={scope.account} accounts={scope.accounts} scopeLabel={scope.scopeLabel} plan={plan} stats={{ games: games.length, score: score.score, analyzed, drills: practice.total, solved: practice.mastered, due: practice.due, wins: score.wins, losses: score.losses, draws: score.draws }} recent={recent} nextDrill={nextDrill} worker={worker} openings={openings} displayName={scope.profile.displayName} theory={theory} referenceCount={refCount}/>;
}
