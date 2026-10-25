/**
 * Per-isolate cache of the slugs of all active plugins (documents of type 'plugin').
 *
 * The admin sidebar middleware needs this on every /admin request. Reading it from D1 each time
 * costs one sequential round trip per lookup, so the list is kept in the isolate for a short time.
 * `invalidatePluginStatusCache()` (called by PluginService on activate/deactivate) bumps an epoch
 * that drops this cache immediately in the isolate that made the change; other isolates pick the
 * change up when their copy expires.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { getPluginCacheEpoch } from '../middleware/plugin-middleware'

export const ACTIVE_PLUGIN_SLUGS_TTL_MS = 30_000

interface Entry {
  slugs: Set<string>
  expiresAt: number
  epoch: number
}

let entry: Entry | null = null

/** Drop the cached list (tests, and callers that just changed plugin status). */
export function clearActivePluginSlugsCache(): void {
  entry = null
}

/**
 * Slugs of the active plugins. Throws when D1 fails (callers decide how to fail), and never
 * caches a failure.
 */
export async function getActivePluginSlugs(db: D1Database, now: number = Date.now()): Promise<Set<string>> {
  const epoch = getPluginCacheEpoch()
  if (entry && entry.epoch === epoch && entry.expiresAt > now) return entry.slugs

  const result = await db
    .prepare(
      `SELECT slug FROM documents WHERE type_id = 'plugin' AND tenant_id = 'default' AND q_plugin_status = 'active' AND is_current_draft = 1 AND deleted_at IS NULL`,
    )
    .all<{ slug: string }>()
  const slugs = new Set((result.results || []).map((r) => r.slug))
  entry = { slugs, expiresAt: now + ACTIVE_PLUGIN_SLUGS_TTL_MS, epoch }
  return slugs
}
