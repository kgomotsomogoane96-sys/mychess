import { databaseUrl } from "@/lib/database-url";
import { SetupScreen } from "@/components/setup-screen";
import { OpeningsDesk } from "@/components/openings-desk";
import { openingFamilies, openingTree, weakBranches } from "@/lib/coachplan";
import { getScope } from "@/lib/scope";
import { compactGames } from "@/lib/store";
import type { ColorName } from "@/lib/types";

export const revalidate = 20;
export const metadata = { title: "Openings" };

export default async function OpeningsPage({ searchParams }: { searchParams: Promise<{ color?: string; family?: string }> }) {
  if (!databaseUrl()) return <SetupScreen/>;
  const params = await searchParams; const scope = await getScope();
  const games = await compactGames(scope.accountIds);
  const families = openingFamilies(games);
  const color: ColorName = params.color === "black" ? "black" : "white";
  const selected = params.family ?? families.find(row => row.color === color)?.key ?? null;
  const subset = games.filter(game => game.youColor === color && (!selected || game.openingFamily === selected));
  const tree = openingTree(subset);
  return <OpeningsDesk families={families} color={color} selected={selected} tree={tree} weak={weakBranches(tree, color).slice(0, 5)} sample={subset.slice(-6).reverse().map(game => ({ id: game.id, opening: game.opening, result: game.result, youColor: game.youColor, playedAt: game.playedAt }))} scopeLabel={scope.scopeLabel} total={subset.length}/>;
}
