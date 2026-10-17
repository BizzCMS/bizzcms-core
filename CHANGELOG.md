# Changelog

## BizzCMS

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
