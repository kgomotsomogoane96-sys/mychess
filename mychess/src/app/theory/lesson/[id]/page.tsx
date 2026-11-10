import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { theoryProgress } from "@/db/schema";
import { databaseUrl } from "@/lib/database-url";
import { SetupScreen } from "@/components/setup-screen";
import { LessonDesk } from "@/components/lesson-desk";
import { THEORY_MODULES, moduleById } from "@/lib/curriculum";
import { getScope } from "@/lib/scope";
import { WORKSPACE_UID } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Theory lesson" };

export function generateStaticParams() {
  return THEORY_MODULES.map(module => ({ id: module.id }));
}

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  if (!databaseUrl()) return <SetupScreen/>;
  const { id } = await params;
  const module = THEORY_MODULES.find(item => item.id === id);
  if (!module) notFound();
  void moduleById(id);
  const [scope, rows] = await Promise.all([
    getScope(),
    db.select().from(theoryProgress).where(eq(theoryProgress.uid, WORKSPACE_UID)),
  ]);
  const row = rows.find(item => item.moduleId === id);
  const progress = row ? { bestScore: row.bestScore, correct: row.correct, attempts: row.attempts } : null;
  return <LessonDesk module={module} profile={scope.profile} progress={progress}/>;
}
