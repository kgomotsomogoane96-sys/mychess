/** Tiny in-process TTL cache for expensive analytics queries. */
const globalCache = globalThis as typeof globalThis & { __mychessCache?: Map<string, { value: unknown; expires: number }> };
const store = (globalCache.__mychessCache ??= new Map());

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await load();
  store.set(key, { value, expires: Date.now() + ttlMs });
  // Prevent an unbounded map in a long-running process.
  if (store.size > 60) {
    for (const [k, v] of store) if (v.expires <= Date.now()) store.delete(k);
  }
  return value;
}

export function invalidate(prefix: string) {
  for (const key of store.keys()) if (key.startsWith(prefix)) store.delete(key);
}
