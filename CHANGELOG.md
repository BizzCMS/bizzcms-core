# Changelog

## BizzCMS

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
