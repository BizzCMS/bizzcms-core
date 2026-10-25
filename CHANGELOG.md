# Changelog

## BizzCMS

### 3.0.0-beta.28-bizzcms.11 (Unreleased, packed locally)

- Fewer sequential D1/KV round trips per admin request (trivial admin endpoints took 0.5-0.75 s wall for ~12 ms CPU because ~13 lookups ran one after another). Behaviour and permission checks are unchanged.
- Admin permissions: the user's permissions are now loaded once, BEFORE `requireRbac('portal','access')`, so the portal gate reads them from the request instead of running its own 2 D1 queries; the nav/landing middleware reuses the same list. The KV write of a freshly computed permission list (TTL still 60 s: role-matrix saves and role assignment drop it, other role edits do not) is no longer awaited (`RbacService` takes an optional `waitUntil`), and a failing write no longer fails the request.
- Admin sidebar: the active-plugin list is read once per isolate (30 s, dropped at once when a plugin is activated/deactivated in that isolate) instead of 2 queries per request (`services/active-plugin-slugs.ts`); the menu plugin's active check is cached the same way; JSON requests (`/admin/api/*`, `Accept: application/json` without HTML) skip the plugin-menu work entirely.
- `GET /admin/api/migrations/status` no longer re-runs `ensureSchemaCompatibility()` (8 sequential queries; it still runs once per deploy at bootstrap and in the two-factor plugin's onBoot) and caches its result 5 minutes per isolate. The admin layout asks at most once per browser session: a "0 pending" answer is kept in sessionStorage for 30 minutes.
- Dashboard: metrics poll every 30 s (was 1 s), the system-status poll every 30 s, both only while the tab is visible; the chart labels follow the 30 s step.
- `GET /auth/me` reads the user row and the profile document in parallel. The security-audit middleware caches its plugin-active check per isolate (60 s; a failed lookup 15 s) instead of one query on every `/auth/*` request.
- Not changed: Better Auth `session.cookieCache` (the session cookie is only refreshed on the auth handler, not on the app's `getSession` call, so it would help for the first minutes after sign-in only, while a revoked session or changed role/super-admin flag would stay valid until it expires).

### 3.0.0-beta.28-bizzcms.10 (Unreleased, packed locally)

- Image source records: every media image can store `source` (link to the original page, http/https only), `credit` (author) and `license` (free text) in its media_asset data (no migration; the legacy `media` table is untouched). Admin > Media > file details has Source link, Author and Licence (with suggestions) under Tags; `PATCH /api/media/:id` accepts `source`, `credit`, `license` (invalid link: 400); the admin media grid shows a neutral "No source" badge on images without a source. Stored only: nothing is rendered on public pages.

### 3.0.0-beta.28-bizzcms.9

- `/auth/me` also returns `email_verified`, so sites can require e-mail confirmation for new accounts (BizzCMS site accounts, `confirmSince`).

### 3.0.0-beta.28-bizzcms.8 (packed locally, released as .9)

- Setup runs once per deploy, not on every new isolate: bootstrap (migrations, collection sync, plugin bootstrap) and the setup in the two-factor, e-mail and menu plugins' onBoot. New `utils/once-per-deploy.ts`: the deploy is `CF_VERSION_METADATA.id` (wrangler `[version_metadata] binding = "CF_VERSION_METADATA"`), done steps are remembered in the isolate and in CACHE_KV (`bizz:once:<name>:<deployId>`). A failing step is not marked. Without the binding nothing changes (runs per isolate as before). Isolate state (KV wiring, collection registry, 2FA policy, e-mail service) is still set up on every isolate.

### 3.0.0-beta.28-bizzcms.7

- Plugin wiring: a request waits at most 3 s (was 8 s) and a stuck wiring restarts after 8 s; `/files/*` (media) never waits for plugin wiring. Seen live: wiring still pending after 8 s on one isolate.

### 3.0.0-beta.28-bizzcms.6

- Fix intermittent hangs ("the site hangs, sometimes signed in, sometimes not"): promises shared by all requests of an isolate (plugin wiring on every request, plugin boot, documents schema cache) are never awaited forever. A request cancelled mid-start left them pending for the isolate's life. New `utils/shared-once.ts`: a caller waits at most a few seconds, a stale attempt is restarted, a failure is retried.

### 3.0.0-beta.28-bizzcms.5 (.4 was packed twice under one version; .5 is the complete build)

### 3.0.0-beta.28-bizzcms.4

- Every sign-in records `auth_user.last_login_at` (Better Auth session-create hook), so Admin › Users shows the real last login (it said "Never" for everyone).
- Admin › Users statistics count all users (they counted only the 20 on the page and showed fixed fake percentages): Total, Activated, Not activated, Administrators, each opening its filter; new Status filter "Activated".

### 3.0.0-beta.28-bizzcms.3

- Admin › Users: "Not activated" status filter and badge for accounts with no password or social login yet (e.g. imported, invitation not used).

### 3.0.0-beta.28-bizzcms.2

- Admin › Users sorts on the server across all users (name, e-mail, role, last login, created; never-logged-in last); paging keeps search, filters and sort. Tables get an optional `serverSort`.

### 3.0.0-beta.28-bizzcms.1 (unreleased)

- Engine source now lives in BizzCMS/bizzcms-core (imported from the 3.0.0-beta.28 release of the open-source core it
  started from, MIT).
- Security: telemetry is opt-in with no default endpoint; Admin › Users roles are stored and shown by name and an
  unknown role never falls back to Administrator; the role filter lists the real roles.
- Rebrand: BizzCMS in all texts, admin screens, links and the API (old API names kept as deprecated aliases).
- Security pass:
  - `POST /auth/seed-admin` only answers when `ENVIRONMENT` is development, test, e2e or local (404 elsewhere,
    including an unset value) and is no longer CSRF-exempt.
  - Production and staging refuse to serve without `JWT_SECRET` instead of signing with the placeholder key.
  - OAuth sign-in no longer links a provider to an existing account by e-mail alone, and respects the
    self-registration switch.
  - Admin › Users escapes names and only shows http(s) or site-relative avatars; form submissions and form names are
    escaped in the admin.
  - `/files/*` always sends `nosniff`; SVG, HTML and XML uploads get a sandbox CSP.
  - `/api/system/info`, `/stats` and `/env` are for administrators only (`/health` and `/ping` stay public).
  - The admin permission check fails closed (503) when permissions cannot be loaded.
  - Admin and sign-in scripts pinned to exact versions; htmx, Alpine and Chart.js load with integrity hashes.
- Better Auth 1.6.33 (latest 1.6).
