import { databaseUrl } from "@/lib/database-url";
import { SetupScreen } from "@/components/setup-screen";
import { SettingsDesk } from "@/components/settings-desk";
import { getScope } from "@/lib/scope";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  if (!databaseUrl()) return <SetupScreen/>;
  const scope = await getScope();
  return <SettingsDesk profile={scope.profile} accounts={scope.accounts}/>;
}
