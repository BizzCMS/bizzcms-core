/**
 * Setup work (schema checks, type registration, plugin rows) that only needs to run once per deployed version,
 * not on every new isolate. Before 2026-10-20 every isolate repeated it on its first requests: ~3 s of D1 writes per
 * cold start, write-lock contention when several isolates started together, and the hang trap of
 * utils/shared-once.ts.
 *
 * The deploy is identified by the Cloudflare version metadata binding (`CF_VERSION_METADATA`, wrangler
 * `[version_metadata]`). Without it there is no reliable per-deploy id: `deployIdOf` returns null and callers keep
 * their previous behaviour (run every isolate), so sites that have not added the binding are unaffected.
 *
 * Done steps are remembered in the isolate and in CACHE_KV (`bizz:once:<name>:<deployId>`). A failing step is not
 * marked, so it runs again next time. Steps must stay idempotent: a few isolates starting at the same moment right
 * after a deploy may each run it once.
 */
const doneInIsolate = new Set<string>()

export function deployIdOf(env: unknown): string | null {
  const meta = (env as { CF_VERSION_METADATA?: { id?: unknown } } | undefined)?.CF_VERSION_METADATA
  return typeof meta?.id === 'string' && meta.id ? meta.id : null
}

/** True when `name` already ran for this deploy (isolate memory or KV). */
export async function doneThisDeploy(env: unknown, name: string): Promise<boolean> {
  const id = deployIdOf(env)
  if (!id) return false
  const key = `bizz:once:${name}:${id}`
  if (doneInIsolate.has(key)) return true
  const kv = (env as { CACHE_KV?: KVNamespace } | undefined)?.CACHE_KV
  if (!kv) return false
  try {
    if ((await kv.get(key)) === '1') { doneInIsolate.add(key); return true }
  } catch { /* KV unavailable: treat as not done */ }
  return false
}

/** Mark `name` as done for this deploy. */
export async function markDoneThisDeploy(env: unknown, name: string): Promise<void> {
  const id = deployIdOf(env)
  if (!id) return
  const key = `bizz:once:${name}:${id}`
  doneInIsolate.add(key)
  const kv = (env as { CACHE_KV?: KVNamespace } | undefined)?.CACHE_KV
  if (kv) await kv.put(key, '1', { expirationTtl: 60 * 60 * 24 * 120 }).catch(() => {})
}

/**
 * Run `fn` once per deploy. Without a deploy id it runs every time (previous behaviour). Errors propagate and leave
 * the step unmarked.
 */
export async function oncePerDeploy(env: unknown, name: string, fn: () => Promise<unknown>): Promise<void> {
  if (await doneThisDeploy(env, name)) return
  await fn()
  await markDoneThisDeploy(env, name)
}

/** Test helper: forget isolate memory. */
export function resetOncePerDeploy(): void { doneInIsolate.clear() }
