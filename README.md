# bizzcms-core

> Core framework for BizzCMS - A modern, TypeScript-first headless CMS built for Cloudflare's edge platform.

[![Version](https://img.shields.io/npm/v/bizzcms-core)](https://www.npmjs.com/package/bizzcms-core)
[![License](https://img.shields.io/npm/l/bizzcms-core)](./LICENSE)

---

## 🏠 New to BizzCMS?

**Visit [bizzcms.com](https://bizzcms.com) for full documentation and guides.**

To create a new BizzCMS project, use:

```bash
npx create-bizzcms@latest my-app
```

This is the recommended way to get started with BizzCMS. It sets up everything you need with a single command.

---

## ✨ Features

- 🚀 **Edge-First**: Runs on Cloudflare Workers for sub-50ms global response times
- 📦 **Zero Cold Starts**: V8 isolates provide instant startup
- 🔒 **Type-Safe**: Full TypeScript support with comprehensive type definitions
- 🔌 **Plugin System**: Extensible architecture with hooks and middleware
- ⚡ **Three-Tier Caching**: Memory, KV, and database layers for optimal performance
- 🎨 **Admin Interface**: Glass-morphism design system
- 🔐 **Authentication**: Better Auth with session management and role-based permissions
- 📝 **Content Management**: Document-model collections with versioning
- 🖼️ **Media Management**: R2 storage with automatic optimization
- 🌐 **REST API**: Auto-generated endpoints for all collections

## 📦 Installation

```bash
npm install bizzcms-core
```

### Required Peer Dependencies

```bash
npm install @cloudflare/workers-types hono drizzle-orm zod
```

### Optional Dependencies

```bash
npm install wrangler drizzle-kit  # For development
```

## 🚀 Quick Start

### 1. Register Collections and Create Your Application

```typescript
// src/index.ts
import {
  createBizzCMSApp,
  registerCollections,
} from 'bizzcms-core'
import type { BizzCMSConfig } from 'bizzcms-core'
import blogPostsCollection from './collections/blog-posts.collection'

// Register code-defined collections before creating the app
registerCollections([blogPostsCollection])

const config: BizzCMSConfig = {
  plugins: {
    register: [/* your plugins here */],
  },
}

export default createBizzCMSApp(config)
```

### 2. Define Collections

Collections are TypeScript config objects — no database table required.

```typescript
// src/collections/blog-posts.collection.ts
import type { CollectionConfig } from 'bizzcms-core'

export default {
  name: 'blog_post',
  displayName: 'Blog Post',
  slug: 'blog-posts',
  description: 'Manage your blog posts',

  schema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        title: 'Title',
        required: true,
        maxLength: 200,
      },
      content: {
        type: 'lexical',
        title: 'Content',
        required: true,
      },
      publishedAt: {
        type: 'datetime',
        title: 'Published Date',
      },
    },
    required: ['title', 'content'],
  },

  managed: true,
  isActive: true,
} satisfies CollectionConfig
```

### 3. Configure Cloudflare Workers

```toml
# wrangler.toml
name = "my-bizzcms-app"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "my-bizzcms-db"
database_id = "your-database-id"
migrations_dir = "./node_modules/bizzcms-core/migrations"

[[r2_buckets]]
binding = "MEDIA_BUCKET"
bucket_name = "my-bizzcms-media"
```

### 4. Start Development

```bash
# Run migrations
wrangler d1 migrations apply DB --local

# Start dev server
wrangler dev
```

Visit `http://localhost:8787/admin` to access the admin interface.

## 📚 Core Exports

### Main Application

```typescript
import { createBizzCMSApp, registerCollections } from 'bizzcms-core'
import type { BizzCMSConfig, BizzCMSApp, Bindings, Variables } from 'bizzcms-core'
```

### Services

```typescript
import {
  loadCollectionConfigs,
  MigrationService,
  Logger,
  PluginService
} from 'bizzcms-core'
```

### Middleware

```typescript
import {
  requireAuth,
  requireRole,
  requirePermission,
  loggingMiddleware,
  cacheHeaders,
  securityHeaders
} from 'bizzcms-core'
```

### Types

```typescript
import type {
  CollectionConfig,
  FieldConfig,
  Plugin,
  PluginContext,
  User,
  Content,
  Media
} from 'bizzcms-core'
```

### Templates

```typescript
import {
  renderForm,
  renderTable,
  renderPagination,
  renderAlert
} from 'bizzcms-core'
```

### Utilities

```typescript
import {
  sanitizeInput,
  TemplateRenderer,
  QueryFilterBuilder,
  metricsTracker
} from 'bizzcms-core'
```

### Database

```typescript
import {
  createDb,
  users,
  content,
  contentVersions,
  media
} from 'bizzcms-core'
```

## 🔌 Subpath Exports

The package provides organized subpath exports:

```typescript
// Services only
import { MigrationService } from 'bizzcms-core/services'

// Middleware only
import { requireAuth } from 'bizzcms-core/middleware'

// Types only
import type { CollectionConfig } from 'bizzcms-core/types'

// Templates only
import { renderForm } from 'bizzcms-core/templates'

// Utilities only
import { sanitizeInput } from 'bizzcms-core/utils'

// Plugins only
import { HookSystemImpl } from 'bizzcms-core/plugins'
```

## 🎯 Usage Examples

### Custom Routes

```typescript
import { Hono } from 'hono'
import { requireAuth } from 'bizzcms-core/middleware'
import type { Bindings } from 'bizzcms-core'

const customRoutes = new Hono<{ Bindings: Bindings }>()

customRoutes.get('/api/custom', requireAuth(), async (c) => {
  const db = c.env.DB
  // Your custom logic
  return c.json({ message: 'Custom endpoint' })
})

// In your app config
export default createBizzCMSApp({
  plugins: {
    register: [{ name: 'custom', version: '1.0.0', register: (app) => app.route('/custom', customRoutes) }],
  },
})
```

### Custom Plugin

```typescript
import type { Plugin, PluginContext } from 'bizzcms-core'

export default {
  name: 'my-plugin',
  version: '1.0.0',
  description: 'My custom plugin',

  async activate(context: PluginContext) {
    console.log('Plugin activated!')
  },

  async install(context: PluginContext) {
    // Run once on install — migrations, seed data, etc.
  },
} satisfies Plugin
```

### Accessing Services

```typescript
import { Logger, MigrationService } from 'bizzcms-core'

const logger = new Logger({ category: 'custom', level: 'info' })
logger.info('Application started')

const migrationService = new MigrationService(db)
const status = await migrationService.getMigrationStatus()
await migrationService.ensureSchemaCompatibility()
```

## 🏗️ Architecture

```
bizzcms-core
├── src/
│   ├── app.ts              # Application factory
│   ├── db/                 # Database schemas & utilities
│   │   └── migrations-bundle.ts  # Auto-generated migration bundle
│   ├── services/           # Business logic
│   ├── middleware/         # Request processing
│   ├── routes/             # HTTP handlers
│   ├── templates/          # Admin UI components
│   ├── plugins/            # Plugin system & core plugins
│   ├── types/              # TypeScript definitions
│   └── utils/              # Utility functions
├── migrations/             # Core database migrations (.sql files)
├── scripts/
│   └── generate-migrations.ts  # Migration bundler script
└── dist/                   # Compiled output
```

## 🔄 Development Workflow

### Migration System

BizzCMS uses a **build-time migration bundler** because Cloudflare Workers cannot access the filesystem at runtime. All migration SQL is bundled into TypeScript during the build process.

#### Creating New Migrations

1. **Create the SQL file** in `migrations/`:
   ```bash
   # Use sequential three-digit numbering
   touch migrations/027_add_your_feature.sql
   ```

2. **Write idempotent SQL**:
   ```sql
   -- migrations/027_add_your_feature.sql
   CREATE TABLE IF NOT EXISTS your_table (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL
   );

   CREATE INDEX IF NOT EXISTS idx_your_table_name ON your_table(name);
   ```

3. **Regenerate the bundle**:
   ```bash
   npm run generate:migrations
   # Or this runs automatically during: npm run build
   ```

4. **Build the package**:
   ```bash
   npm run build
   ```

5. **Apply to your test database**:
   ```bash
   cd ../my-bizzcms-app
   wrangler d1 migrations apply DB --local
   ```

#### Available Scripts

```bash
# Generate migrations bundle only
npm run generate:migrations

# Build (automatically runs generate:migrations first)
npm run build

# Type check
npm run type-check

# Run tests
npm run test
```

#### How It Works

```
migrations/*.sql → scripts/generate-migrations.ts → src/db/migrations-bundle.ts → dist/
```

The `generate-migrations.ts` script:
- Reads all `.sql` files from `migrations/`
- Generates `src/db/migrations-bundle.ts` with embedded SQL
- Lets `MigrationService` compare bundled migrations against D1's `d1_migrations` status

**Important**: Cloudflare D1/Wrangler is the migration runner and `d1_migrations` is the canonical tracking table. Run migrations with `wrangler d1 migrations apply`; BizzCMS only reports status and runs idempotent compatibility repairs at bootstrap.

## 🔄 Versioning

BizzCMS follows semantic versioning:

- **v3.x.x** - Current (document model, Better Auth, edge-first)
- **v2.x.x** - Legacy monolith (deprecated)

**Current Version**: `3.0.0-beta.9`

### Upgrade Path

```bash
# Install the latest package
npm install bizzcms-core@latest

# Run any new migrations
wrangler d1 migrations apply DB

# Test your application
npm run dev
```

## 📖 Documentation

- [Getting Started](https://bizzcms.com/installation)
- [API Reference](https://bizzcms.com/api)
- [Collections Guide](https://bizzcms.com/collections)
- [Plugin Development](https://bizzcms.com/plugins)
- [Deployment](https://bizzcms.com/deployment)

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md).

## 📄 License

MIT © BizzCMS - See [LICENSE](./LICENSE) for details.

## 💬 Support & Community

- **Issues**: [GitHub Issues](https://github.com/lane711/sonicjs/issues)
- **Discord**: [Join our community](https://discord.gg/8bMy6bv3sZ)
- **Docs**: [bizzcms.com](https://bizzcms.com)
- **Twitter**: [@bizzcmscms](https://twitter.com/bizzcmscms)

## 🔖 Resources

- [Create BizzCMS App](../../packages/create-app) - Scaffold a new project
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Database](https://developers.cloudflare.com/d1/)
- [R2 Storage](https://developers.cloudflare.com/r2/)

## ⚡ Performance

- Global edge deployment
- Sub-50ms response times
- Zero cold starts
- Automatic scaling
- Built-in caching

## 🛡️ Security

- Better Auth (sessions + RBAC)
- Role-based access control
- Permission system
- Secure headers
- Input sanitization

---

**Built with ❤️ for the edge** | v3.0.0-beta.9
