/**
 * Fewer sequential D1/KV round trips per admin request.
 *
 * Each test counts the lookups a hot-path helper makes. The behaviour (who may enter, which
 * plugins show, what the status says) is unchanged; only the number of round trips drops.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// The v2 layout loads the Catalyst layout with require(), which vitest cannot resolve; the dashboard
// test only needs the page content, so hand it back unchanged.
vi.mock('../../templates/layouts/admin-layout-v2.template', () => ({
  renderAdminLayout: (d: { content: string }) => d.content,
}))
import { requireRbac } from '../../middleware/auth'
import { RbacService } from '../../services/rbac'
import {
  getActivePluginSlugs,
  clearActivePluginSlugsCache,
  ACTIVE_PLUGIN_SLUGS_TTL_MS,
} from '../../services/active-plugin-slugs'
import { invalidatePluginStatusCache } from '../../middleware/plugin-middleware'
import { pluginMenuMiddleware, isJsonRequest } from '../../middleware/plugin-menu'
import { menuMiddleware, clearMenuPluginActiveCache } from '../../middleware/menu'
import {
  MigrationService,
  clearMigrationStatusCache,
  MIGRATION_STATUS_TTL_MS,
} from '../../services/migrations'
import {
  securityAuditMiddleware,
  clearSecurityAuditActiveCache,
} from '../../plugins/core-plugins/security-audit-plugin/middleware/audit-middleware'
import { renderAdminLayoutCatalyst } from '../../templates/layouts/admin-layout-catalyst.template'
import { renderDashboardPage } from '../../templates/pages/admin-dashboard.template'

/** D1 stub that records every statement and answers through `answer(sql)`. */
function countingDb(answer: (sql: string) => unknown = () => ({ results: [] })) {
  const seen: string[] = []
  const prepare = vi.fn((sql: string) => {
    const run = async () => {
      seen.push(sql)
      const r = answer(sql)
      if (r instanceof Error) throw r
      return r
    }
    const stmt: any = {
      bind: () => stmt,
      all: run,
      first: async () => {
        const r: any = await run()
        return r && 'results' in r ? (r.results[0] ?? null) : r
      },
      run,
    }
    return stmt
  })
  return { db: { prepare } as any, seen }
}

describe('requireRbac uses permissions already loaded for the request', () => {
  function ctx(perms: string[] | undefined, db: any) {
    let status = 0
    const store: Record<string, unknown> = { user: { userId: 'u1' }, rbacPerms: perms }
    return {
      env: { DB: db },
      req: { header: () => 'application/json' },
      get: (k: string) => store[k],
      json: (_b: unknown, s: number) => {
        status = s
        return new Response(null, { status: s })
      },
      redirect: () => new Response(null, { status: 302 }),
      get status() {
        return status
      },
    }
  }

  it('allows portal:access from the loaded permissions without touching D1', async () => {
    const { db, seen } = countingDb(() => new Error('D1 must not be used'))
    const next = vi.fn(async () => undefined)
    await requireRbac('portal', 'access')(ctx(['portal:access', 'dashboard:read'], db) as any, next as any)
    expect(next).toHaveBeenCalledTimes(1)
    expect(seen).toHaveLength(0)
  })

  it('still denies when the loaded permissions lack the grant', async () => {
    const { db, seen } = countingDb(() => new Error('D1 must not be used'))
    const next = vi.fn(async () => undefined)
    const c = ctx(['content:read'], db)
    await requireRbac('portal', 'access')(c as any, next as any)
    expect(next).not.toHaveBeenCalled()
    expect(c.status).toBe(403)
    expect(seen).toHaveLength(0)
  })
})

describe('RbacService.permissionsForUser KV write', () => {
  function service(kv: any, waitUntil?: (p: Promise<unknown>) => void) {
    const svc: any = new RbacService({} as any, kv, waitUntil)
    svc.getDoc = async () => ({ data: { roleIds: ['role-admin'] } })
    svc.grantsForRoleIds = async () => [{ resource: '*', verb: 'manage', scope: 'any' }]
    svc.getResources = async () => [{ key: 'portal' }, { key: 'dashboard' }]
    svc.getVerbs = async () => [{ name: 'access' }, { name: 'read' }]
    return svc as RbacService
  }

  it('hands the cache write to waitUntil instead of awaiting it', async () => {
    const pending = new Promise<void>(() => {}) // a KV write that never finishes
    const kv = { get: vi.fn(async () => null), put: vi.fn(() => pending) }
    const waitUntil = vi.fn()
    const perms = await service(kv, waitUntil).permissionsForUser('u1')
    expect(perms).toContain('portal:access')
    expect(kv.put).toHaveBeenCalledWith('rbac:perms:u1', JSON.stringify(perms), { expirationTtl: 60 })
    expect(waitUntil).toHaveBeenCalledTimes(1)
  })

  it('without waitUntil it still waits for the write (previous behaviour)', async () => {
    const kv = { get: vi.fn(async () => null), put: vi.fn(async () => undefined) }
    await service(kv).permissionsForUser('u1')
    expect(kv.put).toHaveBeenCalledTimes(1)
  })

  it('a failing cache write does not fail the request', async () => {
    const kv = {
      get: vi.fn(async () => null),
      put: vi.fn(async () => {
        throw new Error('kv down')
      }),
    }
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(service(kv).permissionsForUser('u1')).resolves.toContain('portal:access')
    err.mockRestore()
  })

  it('a cache hit is a single KV read', async () => {
    const kv = { get: vi.fn(async () => JSON.stringify(['portal:access'])), put: vi.fn() }
    expect(await service(kv).permissionsForUser('u1')).toEqual(['portal:access'])
    expect(kv.get).toHaveBeenCalledTimes(1)
    expect(kv.put).not.toHaveBeenCalled()
  })
})

describe('active plugin list cache', () => {
  beforeEach(() => clearActivePluginSlugsCache())

  it('reads D1 once within the TTL and again after it', async () => {
    const { db, seen } = countingDb(() => ({ results: [{ slug: 'menu' }] }))
    const t0 = 1_000_000
    expect([...(await getActivePluginSlugs(db, t0))]).toEqual(['menu'])
    await getActivePluginSlugs(db, t0 + ACTIVE_PLUGIN_SLUGS_TTL_MS - 1)
    expect(seen).toHaveLength(1)
    await getActivePluginSlugs(db, t0 + ACTIVE_PLUGIN_SLUGS_TTL_MS + 1)
    expect(seen).toHaveLength(2)
  })

  it('is dropped at once when a plugin is activated/deactivated in this isolate', async () => {
    const { db, seen } = countingDb(() => ({ results: [] }))
    await getActivePluginSlugs(db, 1)
    invalidatePluginStatusCache('menu')
    await getActivePluginSlugs(db, 2)
    expect(seen).toHaveLength(2)
  })

  it('does not cache a failure', async () => {
    let fail = true
    const { db, seen } = countingDb(() => (fail ? new Error('boom') : { results: [{ slug: 'a' }] }))
    await expect(getActivePluginSlugs(db, 1)).rejects.toThrow('boom')
    fail = false
    expect([...(await getActivePluginSlugs(db, 2))]).toEqual(['a'])
    expect(seen).toHaveLength(2)
  })
})

describe('plugin-menu middleware', () => {
  beforeEach(() => clearActivePluginSlugsCache())

  function ctx(path: string, db: any, accept?: string) {
    const store: Record<string, unknown> = {}
    return {
      env: { DB: db },
      req: { url: `http://localhost${path}`, header: (n: string) => (n === 'Accept' ? accept : undefined) },
      res: new Response('<html></html>', { headers: { 'content-type': 'text/html' } }),
      get: (k: string) => store[k],
      set: (k: string, v: unknown) => {
        store[k] = v
      },
    }
  }

  it('costs no D1 query on the second admin request', async () => {
    const { db, seen } = countingDb(() => ({ results: [] }))
    const mw = pluginMenuMiddleware()
    await mw(ctx('/admin/content', db) as any, async () => {})
    await mw(ctx('/admin/media', db) as any, async () => {})
    expect(seen).toHaveLength(1)
  })

  it('does no work at all for JSON requests', async () => {
    const { db, seen } = countingDb()
    const next = vi.fn(async () => {})
    await pluginMenuMiddleware()(ctx('/admin/api/stats', db) as any, next as any)
    await pluginMenuMiddleware()(ctx('/admin/dashboard', db, 'application/json') as any, next as any)
    expect(next).toHaveBeenCalledTimes(2)
    expect(seen).toHaveLength(0)
  })

  it('isJsonRequest only skips real JSON callers', () => {
    expect(isJsonRequest('/admin/api/x', undefined)).toBe(true)
    expect(isJsonRequest('/admin/x', 'application/json')).toBe(true)
    expect(isJsonRequest('/admin/x', 'text/html,application/json')).toBe(false)
    expect(isJsonRequest('/admin/x', '*/*')).toBe(false)
    expect(isJsonRequest('/admin/x', undefined)).toBe(false)
  })
})

describe('menu middleware plugin-active check', () => {
  beforeEach(() => clearMenuPluginActiveCache())

  it('is cached, skipped for non-HTML, and dropped on plugin activation', async () => {
    const { db, seen } = countingDb(() => ({ results: [] })) // no menu plugin row -> inactive
    const run = (type: string) =>
      menuMiddleware()(
        {
          env: { DB: db },
          req: { url: 'http://localhost/admin/content' },
          res: new Response('x', { headers: { 'content-type': type } }),
        } as any,
        async () => {},
      )
    await run('application/json')
    expect(seen).toHaveLength(0)
    await run('text/html')
    await run('text/html')
    expect(seen).toHaveLength(1)
    invalidatePluginStatusCache('menu')
    await run('text/html')
    expect(seen).toHaveLength(2)
  })
})

describe('migration status', () => {
  beforeEach(() => clearMigrationStatusCache())

  const applied = [
    '0001_core.sql',
    '0002_documents.sql',
    '0003_session_org.sql',
    '0004_forms.sql',
    '0005_otp_codes.sql',
    '0006_two_factor_lockout.sql',
    '0007_two_factor_required.sql',
  ].map((name) => ({ name, applied_at: '2026-01-01' }))

  it('is a single read of d1_migrations (no schema repair queries)', async () => {
    const { db, seen } = countingDb(() => ({ results: applied }))
    const status = await new MigrationService(db).getMigrationStatus()
    expect(status.pendingMigrations).toBe(0)
    expect(seen).toHaveLength(1)
    expect(seen[0]).toContain('d1_migrations')
  })

  it('the cached variant reads D1 once per 5 minutes', async () => {
    const { db, seen } = countingDb(() => ({ results: applied }))
    const svc = new MigrationService(db)
    const t0 = 5_000_000
    await svc.getMigrationStatusCached(t0)
    await svc.getMigrationStatusCached(t0 + MIGRATION_STATUS_TTL_MS - 1)
    expect(seen).toHaveLength(1)
    await svc.getMigrationStatusCached(t0 + MIGRATION_STATUS_TTL_MS + 1)
    expect(seen).toHaveLength(2)
  })
})

describe('security-audit plugin-active check', () => {
  beforeEach(() => clearSecurityAuditActiveCache())

  function ctx(path: string, db: any) {
    return { env: { DB: db }, req: { url: `http://localhost${path}`, header: () => undefined, method: 'GET' } }
  }

  it('looks the plugin up once for many /auth requests, and not at all elsewhere', async () => {
    const { db, seen } = countingDb(() => ({ results: [{ status: 'inactive' }] }))
    const next = vi.fn(async () => {})
    const mw = securityAuditMiddleware()
    await mw(ctx('/auth/me', db) as any, next as any)
    await mw(ctx('/auth/me', db) as any, next as any)
    await mw(ctx('/auth/login', db) as any, next as any)
    await mw(ctx('/admin/content', db) as any, next as any)
    expect(next).toHaveBeenCalledTimes(4)
    expect(seen).toHaveLength(1)
  })

  it('a missing legacy plugins table is remembered too (no failing query per request)', async () => {
    const { db, seen } = countingDb(() => new Error('no such table: plugins'))
    const mw = securityAuditMiddleware()
    await mw(ctx('/auth/me', db) as any, async () => {})
    await mw(ctx('/auth/me', db) as any, async () => {})
    expect(seen).toHaveLength(1)
  })
})

describe('admin templates', () => {
  it('the layout checks migrations at most once per browser session', () => {
    const html = renderAdminLayoutCatalyst({ title: 'T', content: '<p>x</p>' })
    expect(html).toContain("'migrationCheck'")
    expect(html).toContain('30 * 60 * 1000')
    expect(html).toContain('sessionStorage.setItem(MIGRATION_CHECK_KEY')
  })

  it('the dashboard polls every 30 s and only while the tab is visible', () => {
    const html = renderDashboardPage({ user: { name: 'A', email: 'a@b.c', role: 'admin' } } as any)
    expect(html).not.toContain('every 1s')
    expect(html).toContain('hx-get="/admin/dashboard/api/metrics"')
    expect(html).toContain("every 30s [document.visibilityState === 'visible']")
    expect(html).toContain("load, every 30s [document.visibilityState === 'visible']")
  })
})
