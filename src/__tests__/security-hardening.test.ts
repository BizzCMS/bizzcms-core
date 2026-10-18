/**
 * Regression tests for the 2026-10 security pass: seed-admin is dev-only, Admin > Users escapes
 * profile fields, production refuses to run without JWT_SECRET, and uploaded SVG/HTML served from
 * /files/* cannot run script on the site origin.
 */
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import authRoutes from '../routes/auth'
import { renderUsersListPage } from '../templates/pages/admin-users-list.template'
import { createBizzCMSApp } from '../app'

describe('POST /auth/seed-admin', () => {
  const app = new Hono()
  app.route('/auth', authRoutes)
  for (const ENVIRONMENT of ['production', 'staging', 'preview', '']) {
    it(`is not available when ENVIRONMENT=${JSON.stringify(ENVIRONMENT)}`, async () => {
      const res = await app.request('/auth/seed-admin', { method: 'POST' }, { ENVIRONMENT, DB: {} } as never)
      expect(res.status).toBe(404)
    })
  }
})

describe('Admin > Users list', () => {
  const evil = '"><b id=x>'
  const html = renderUsersListPage({
    users: [{
      id: 'u1', email: 'u@test.local', username: 'u', firstName: evil, lastName: evil,
      role: 'viewer', avatar: 'javascript:alert(1)', isActive: true, lastLoginAt: null,
      createdAt: Date.now(), updatedAt: Date.now(), formattedLastLogin: 'Never', formattedCreatedAt: '',
    }],
    currentPage: 1, totalPages: 1, totalUsers: 1, searchFilter: '', roleFilter: '', statusFilter: '',
  } as never)
  it('escapes first and last name', () => expect(html).not.toContain('<b id=x>'))
  it('drops avatar URLs that are not http(s) or site-relative', () => expect(html).not.toContain('javascript:alert'))
})

describe('production without JWT_SECRET', () => {
  it('refuses to serve instead of signing with the placeholder key', async () => {
    const app = createBizzCMSApp()
    const res = await app.request('/files/x.svg', {}, { ENVIRONMENT: 'production' } as never)
    expect(res.status).toBe(500)
    expect(await res.text()).toContain('misconfigured')
  })
})

describe('GET /files/*', () => {
  const bucket = (contentType: string) => ({
    get: async () => ({ body: 'x', httpMetadata: { contentType } }),
  })
  const get = (contentType: string) =>
    createBizzCMSApp().request('/files/a', {}, { ENVIRONMENT: 'test', JWT_SECRET: 'k'.repeat(32), MEDIA_BUCKET: bucket(contentType) } as never)

  it('sandboxes SVG and sends nosniff', async () => {
    const res = await get('image/svg+xml')
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('Content-Security-Policy')).toContain('sandbox')
  })
  it('leaves ordinary images without a sandbox CSP', async () => {
    const res = await get('image/webp')
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('Content-Security-Policy') ?? '').not.toContain('sandbox')
  })
})

describe('Admin > Users server-side sort', () => {
  const html = renderUsersListPage({
    users: [{ id: 'u1', email: 'a@test.local', username: 'a', firstName: 'Ana', lastName: 'B', role: 'supplier', avatar: null, isActive: true, lastLoginAt: null, createdAt: Date.now(), updatedAt: Date.now() }],
    currentPage: 1, totalPages: 1, totalUsers: 1, searchFilter: 'ana', roleFilter: 'supplier', statusFilter: 'all',
    sortKey: 'lastLoginAt', sortDir: 'desc',
  } as never)
  it('sortable headers link to a server sort that keeps the filters', () => {
    expect(html).toContain('/admin/users?search=ana&amp;role=supplier&amp;status=all&amp;sort=lastLoginAt&amp;dir=asc')
    expect(html).toContain('sort=createdAt&amp;dir=desc')
    expect(html).toContain('sort=email&amp;dir=asc')
  })
  it('marks the current sort', () => expect(html).toContain('aria-sort="descending"'))
})

describe('Admin > Users: not activated', () => {
  const html = renderUsersListPage({
    users: [{ id: 'u1', email: 'a@test.local', username: 'a', firstName: 'Ana', lastName: 'B', role: 'supplier', avatar: null, isActive: true, canSignIn: false, lastLoginAt: null, createdAt: Date.now(), updatedAt: Date.now() }],
    currentPage: 1, totalPages: 1, totalUsers: 1, statusFilter: 'pending',
  } as never)
  it('shows the badge and the filter option', () => {
    expect(html).toContain('>Not activated</span>')
    expect(html).toContain('<option value="pending" selected>Not activated</option>')
  })
})
