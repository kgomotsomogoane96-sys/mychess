import { databaseUrl } from "@/lib/database-url";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { TheoryDesk } from "@/components/theory-desk";
import { SetupScreen } from "@/components/setup-screen";
import { db } from "@/db";
import { theoryProgress } from "@/db/schema";
import { WORKSPACE_UID } from "@/lib/constants";
import { todayModule } from "@/lib/curriculum";
import { getScope } from "@/lib/scope";
import { referenceCount } from "@/lib/reference";
import type { TheoryProgressView } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Daily theory" };

export default async function TheoryPage() {
  if (!databaseUrl()) return <SetupScreen/>;
  const [scope, count, rows] = await Promise.all([getScope(), referenceCount(), db.select().from(theoryProgress).where(eq(theoryProgress.uid, WORKSPACE_UID))]);
  const progress: TheoryProgressView[] = rows.map(row => ({ uid: row.uid, moduleId: row.moduleId, correct: row.correct, attempts: row.attempts, bestScore: row.bestScore, notes: row.notes, completedAt: row.completedAt.toISOString() }));
  return <Suspense><TheoryDesk today={todayModule()} progress={progress} profileTheme={scope.profile.boardTheme} referenceCount={count}/></Suspense>;
}
