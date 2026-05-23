// Load .env for local CLI; production sets DATABASE_URL via Docker env_file
import { createRequire } from 'node:module'
import { defineConfig } from 'prisma/config'

const require = createRequire(import.meta.url)
try {
  require('dotenv/config')
} catch {
  // dotenv not bundled in production image — rely on process.env
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
})
