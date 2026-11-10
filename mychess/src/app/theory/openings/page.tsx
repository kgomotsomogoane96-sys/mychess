import { databaseUrl } from "@/lib/database-url";
import { SetupScreen } from "@/components/setup-screen";
import { OpeningTrainer } from "@/components/opening-trainer";
import { getScope } from "@/lib/scope";

export const dynamic = "force-dynamic";
export const metadata = { title: "Opening theory" };

export default async function OpeningTheoryPage() {
  if (!databaseUrl()) return <SetupScreen/>;
  const scope = await getScope();
  return <OpeningTrainer profile={scope.profile}/>;
}
