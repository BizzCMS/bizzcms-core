# bizzcms-core

The CMS engine behind [BizzCMS](https://bizzcms.com) sites: content, admin, users and roles, media, REST API and
MCP for AI assistants. Runs on Cloudflare Workers with D1, R2 and KV.

Sites do not use this repository directly. They use the `bizzcms-core` package that
[BizzCMS/bizzcms](https://github.com/BizzCMS/bizzcms) ships in `vendor/` and syncs to every site.

## Build

```
npm install
npm run build      # dist/
npm test           # vitest
npm pack           # bizzcms-core-<version>.tgz
```

Build tools are pinned (`tsup` 8.5.1, `esbuild` 0.25.12) so the output stays reproducible.

## Releasing to the sites

1. Change the code here, add tests, bump `version` in `package.json` and note the change in `CHANGELOG.md`.
2. `npm run build && npm test && npm pack`.
3. Copy the `.tgz` into `../bizzcms/vendor/`, update the dependency in `../bizzcms/package.json`, then in each site:
   `npm run sync:core && npm install`, type-check and run its tests.

## Security defaults

- Telemetry is off. It runs only with `BIZZCMS_TELEMETRY=true` and a site's own `BIZZCMS_TELEMETRY_ENDPOINT`;
  `DO_NOT_TRACK` always wins. Nothing is sent to a third party.
- Admin › Users stores and shows roles by name; an unknown role never becomes Administrator.
- `POST /auth/seed-admin` exists only in development, test, e2e and local environments.
- Production refuses to start without `JWT_SECRET`.
- OAuth never links a provider to an existing account by e-mail alone.
- Uploaded SVG/HTML/XML files are served with a sandbox CSP and `nosniff`.

## Licence

MIT, see [LICENSE](LICENSE). The engine started from an open-source MIT-licensed CMS core; its original copyright
notice is kept in the licence file.
