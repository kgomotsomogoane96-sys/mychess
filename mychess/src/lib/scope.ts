import { ensureDatabase } from "@/lib/bootstrap";
import { ensureProfile, listAccounts } from "@/lib/store";

export async function getScope() {
  await ensureDatabase();
  const [profile, accounts] = await Promise.all([ensureProfile(), listAccounts()]);
  const account = accounts.find(item => item.id === profile.activeAccountId) ?? null;
  const accountIds = account ? [account.id] : accounts.length ? accounts.map(item => item.id) : null;
  return { profile, accounts, account, accountIds, scopeLabel: account ? account.displayName : accounts.length > 1 ? "all your accounts" : accounts[0]?.displayName ?? "your games" };
}
