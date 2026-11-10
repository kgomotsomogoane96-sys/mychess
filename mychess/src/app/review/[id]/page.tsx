import { databaseUrl } from "@/lib/database-url";
import { SetupScreen } from "@/components/setup-screen";
import { notFound } from "next/navigation";
import { ReviewStage } from "@/components/review-stage";
import { getScope } from "@/lib/scope";
import { getGame } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ run?: string }> }) {
  if (!databaseUrl()) return <SetupScreen/>;
  const { id } = await params; const query = await searchParams;
  const [game, scope] = await Promise.all([getGame(id), getScope()]);
  if (!game) notFound();
  return <ReviewStage game={game} profile={scope.profile} autoRun={query.run === "1"}/>;
}
