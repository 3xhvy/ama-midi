# Pre-Day Architecture & Environment Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the complete AMA-MIDI monorepo with Turborepo + pnpm, Docker Compose, design system, and shared TypeScript types — everything needed before Day 1 application code.

**Architecture:** Turborepo monorepo with three workspace packages: `apps/web` (Vite + React 18), `apps/api` (NestJS), and `packages/shared` (zero-dependency types). Single `docker-compose.yml` for CI/grading with all 4 services. CSS design system uses CSS variables consumed by Tailwind.

**Tech Stack:** pnpm, Turborepo, Vite, React 18, TypeScript, TailwindCSS, NestJS, Docker Compose, PostgreSQL 15, Redis 7

**Linear Issues:** OHO-207, OHO-208, OHO-209, OHO-227

---

## File Structure Overview

```
ama-midi/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   └── styles/
│   │   │       └── globals.css
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.js
│   │   ├── postcss.config.js
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── api/
│       ├── src/
│       │   ├── app.module.ts
│       │   ├── app.controller.ts
│       │   ├── app.service.ts
│       │   └── main.ts
│       ├── Dockerfile
│       ├── tsconfig.json
│       ├── nest-cli.json
│       └── package.json
│
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── index.ts
│       │   ├── types.ts
│       │   ├── colors.ts
│       │   └── constants.ts
│       ├── tsconfig.json
│       └── package.json
│
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

---

## Task 1: Initialize Root Monorepo with pnpm + Turborepo

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`

- [ ] **Step 1: Create root package.json**

```bash
cd /Users/hohoanghvy/Projects/ama-midi
```

Create `package.json`:

```json
{
  "name": "ama-midi",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test"
  },
  "devDependencies": {
    "turbo": "^2.0.0"
  },
  "packageManager": "pnpm@9.1.0"
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Create turbo.json**

Create `turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "outputs": []
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    }
  }
}
```

- [ ] **Step 4: Create .gitignore**

Create `.gitignore`:

```
# Dependencies
node_modules
.pnpm-store

# Build outputs
dist
.next
.turbo

# Environment
.env
.env.local
.env.*.local

# IDE
.idea
.vscode
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# Test
coverage
```

- [ ] **Step 5: Install turbo**

Run:
```bash
pnpm install
```

Expected: `pnpm-lock.yaml` created, `node_modules` contains turbo.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json .gitignore pnpm-lock.yaml
git commit -m "chore: initialize turborepo monorepo with pnpm"
```

---

## Task 2: Create packages/shared

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/colors.ts`
- Create: `packages/shared/src/constants.ts`

- [ ] **Step 1: Create packages/shared directory**

```bash
mkdir -p packages/shared/src
```

- [ ] **Step 2: Create packages/shared/package.json**

Create `packages/shared/package.json`:

```json
{
  "name": "@ama-midi/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 3: Create packages/shared/tsconfig.json**

Create `packages/shared/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Create packages/shared/src/constants.ts**

Create `packages/shared/src/constants.ts`:

```typescript
export const TRACK_MIN = 1
export const TRACK_MAX = 8
export const TIME_MIN = 0
export const TIME_MAX = 300
export const SNAP_RESOLUTION = 0.1
```

- [ ] **Step 5: Create packages/shared/src/colors.ts**

Create `packages/shared/src/colors.ts`:

```typescript
export const LAYER_COLORS = {
  midi: { primary: '#3B82F6', bg: '#EFF6FF', label: 'MIDI' },
  beatmap: { primary: '#06B6D4', bg: '#ECFEFF', label: 'Beat Map' },
  gameplay: { primary: '#8B5CF6', bg: '#F5F3FF', label: 'Gameplay' },
  difficulty: { primary: '#EC4899', bg: '#FDF2F8', label: 'Difficulty' },
  events: { primary: '#F59E0B', bg: '#FFFBEB', label: 'Events' },
} as const

export const NOTE_PRESET_COLORS = [
  '#6C63FF',
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#EC4899',
  '#06B6D4',
  '#8B5CF6',
] as const

export const STATUS_COLORS = {
  synced: { color: '#10B981', bg: '#ECFDF5', label: 'Synced' },
  needsReview: { color: '#F59E0B', bg: '#FFFBEB', label: 'Needs Review' },
  outdated: { color: '#EF4444', bg: '#FEF2F2', label: 'Outdated' },
  draft: { color: '#6B6585', bg: '#F3F0F9', label: 'Draft' },
} as const
```

- [ ] **Step 6: Create packages/shared/src/types.ts**

Create `packages/shared/src/types.ts`:

```typescript
export type UserRole = 'ADMIN' | 'COMPOSER' | 'VIEWER'
export type NoteEventType = 'NOTE_CREATED' | 'NOTE_UPDATED' | 'NOTE_DELETED'

export interface AuthUser {
  id: string
  email: string
  name: string
  avatarUrl?: string
  role: UserRole
}

export interface Song {
  id: string
  name: string
  createdBy: string
  creatorName: string
  noteCount: number
  createdAt: string
  updatedAt: string
}

export interface Note {
  id: string
  songId: string
  track: number
  time: number
  title: string
  description: string
  color: string
  createdBy: string
  creatorName: string
  createdAt: string
  updatedAt: string
}

export interface NoteEvent {
  id: string
  songId: string
  noteId: string | null
  eventType: NoteEventType
  userId: string
  userName: string
  userAvatarUrl?: string
  timestamp: string
  beforeState: Partial<Note> | null
  afterState: Partial<Note> | null
}

export interface NoteSuggestion {
  track: number
  time: number
  color: string
}
```

- [ ] **Step 7: Create packages/shared/src/index.ts**

Create `packages/shared/src/index.ts`:

```typescript
export * from './types'
export * from './colors'
export * from './constants'
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd packages/shared && pnpm install && pnpm lint
```

Expected: Exit code 0, no errors.

- [ ] **Step 9: Commit**

```bash
cd /Users/hohoanghvy/Projects/ama-midi
git add packages/shared
git commit -m "feat(shared): add domain types, colors, and constants"
```

---

## Task 3: Create apps/api (NestJS)

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/nest-cli.json`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/app.controller.ts`
- Create: `apps/api/src/app.service.ts`
- Create: `apps/api/Dockerfile`

- [ ] **Step 1: Create apps/api directory**

```bash
mkdir -p apps/api/src
```

- [ ] **Step 2: Create apps/api/package.json**

Create `apps/api/package.json`:

```json
{
  "name": "@ama-midi/api",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,test}/**/*.ts\"",
    "test": "jest"
  },
  "dependencies": {
    "@ama-midi/shared": "workspace:*",
    "@nestjs/common": "^10.3.0",
    "@nestjs/core": "^10.3.0",
    "@nestjs/platform-express": "^10.3.0",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.3.0",
    "@nestjs/schematics": "^10.1.0",
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 3: Create apps/api/tsconfig.json**

Create `apps/api/tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "strict": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create apps/api/nest-cli.json**

Create `apps/api/nest-cli.json`:

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

- [ ] **Step 5: Create apps/api/src/app.service.ts**

Create `apps/api/src/app.service.ts`:

```typescript
import { Injectable } from '@nestjs/common'

@Injectable()
export class AppService {
  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    }
  }
}
```

- [ ] **Step 6: Create apps/api/src/app.controller.ts**

Create `apps/api/src/app.controller.ts`:

```typescript
import { Controller, Get } from '@nestjs/common'
import { AppService } from './app.service'

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth(): { status: string; timestamp: string } {
    return this.appService.getHealth()
  }
}
```

- [ ] **Step 7: Create apps/api/src/app.module.ts**

Create `apps/api/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 8: Create apps/api/src/main.ts**

Create `apps/api/src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  const port = process.env.PORT || 3001
  await app.listen(port)

  console.log(`API running on http://localhost:${port}`)
}
bootstrap()
```

- [ ] **Step 9: Create apps/api/Dockerfile**

Create `apps/api/Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN pnpm --filter @ama-midi/api build

FROM node:20-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "dist/main"]
```

- [ ] **Step 10: Verify import from @ama-midi/shared works**

Add to `apps/api/src/app.controller.ts` at top:

```typescript
import { TRACK_MAX } from '@ama-midi/shared'
```

Add inside `getHealth()` return:

```typescript
return {
  status: 'ok',
  timestamp: new Date().toISOString(),
  maxTracks: TRACK_MAX,
}
```

- [ ] **Step 11: Install dependencies and verify**

```bash
cd /Users/hohoanghvy/Projects/ama-midi
pnpm install
cd apps/api && pnpm start:dev
```

Expected: Console shows "API running on http://localhost:3001". `curl http://localhost:3001/health` returns JSON with status "ok".

Stop the server (Ctrl+C).

- [ ] **Step 12: Commit**

```bash
cd /Users/hohoanghvy/Projects/ama-midi
git add apps/api
git commit -m "feat(api): scaffold NestJS app with health endpoint"
```

---

## Task 4: Create apps/web (Vite + React + TypeScript + Tailwind)

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tailwind.config.js`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/styles/globals.css`
- Create: `apps/web/Dockerfile`

- [ ] **Step 1: Create apps/web directory**

```bash
mkdir -p apps/web/src/styles
```

- [ ] **Step 2: Create apps/web/package.json**

Create `apps/web/package.json`:

```json
{
  "name": "@ama-midi/web",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx"
  },
  "dependencies": {
    "@ama-midi/shared": "workspace:*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0"
  }
}
```

- [ ] **Step 3: Create apps/web/tsconfig.json**

Create `apps/web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create apps/web/vite.config.ts**

Create `apps/web/vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
})
```

- [ ] **Step 5: Create apps/web/postcss.config.js**

Create `apps/web/postcss.config.js`:

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 6: Create apps/web/tailwind.config.js**

Create `apps/web/tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6C63FF',
          light: '#EEF0FF',
          dark: '#4B44CC',
        },
        editor: {
          bg: '#13111E',
          surface: '#1E1B2E',
          border: '#2D2847',
          text: '#E2DEFF',
          muted: '#6B6585',
        },
        app: {
          bg: '#F8F7FF',
          surface: '#FFFFFF',
          border: '#E8E6F0',
        },
      },
      borderRadius: {
        xl: '16px',
        '2xl': '24px',
      },
      fontFamily: {
        sans: ['Inter', 'DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        brand: '0 4px 16px rgba(108,99,255,0.12), 0 2px 4px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 7: Create apps/web/src/styles/globals.css**

Create `apps/web/src/styles/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Brand */
  --color-primary: #6C63FF;
  --color-primary-light: #EEF0FF;
  --color-primary-dark: #4B44CC;

  /* Editor surface (piano roll dark zone) */
  --color-editor-bg: #13111E;
  --color-editor-surface: #1E1B2E;
  --color-editor-border: #2D2847;
  --color-editor-text: #E2DEFF;
  --color-editor-muted: #6B6585;
  --color-grid-line: rgba(255, 255, 255, 0.06);
  --color-grid-line-bold: rgba(255, 255, 255, 0.12);

  /* App surface (light zones) */
  --color-bg: #F8F7FF;
  --color-surface: #FFFFFF;
  --color-border: #E8E6F0;
  --color-border-strong: #C4BFD8;

  /* Text */
  --color-text-primary: #1A1635;
  --color-text-secondary: #6B6585;
  --color-text-tertiary: #A09BB5;

  /* Semantic */
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-info: #3B82F6;

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-full: 9999px;

  /* Shadow */
  --shadow-sm: 0 1px 3px rgba(108, 99, 255, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 16px rgba(108, 99, 255, 0.12), 0 2px 4px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 8px 32px rgba(108, 99, 255, 0.16), 0 4px 8px rgba(0, 0, 0, 0.08);

  /* Typography */
  --font-sans: 'Inter', 'DM Sans', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
}

body {
  font-family: var(--font-sans);
  background-color: var(--color-bg);
  color: var(--color-text-primary);
}

/* Animation keyframes */
@keyframes note-appear {
  from {
    transform: scale(0.5);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes note-disappear {
  from {
    transform: scale(1);
    opacity: 1;
  }
  to {
    transform: scale(0.3);
    opacity: 0;
  }
}

@keyframes ghost-pulse {
  0%,
  100% {
    transform: scale(0.95);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.05);
    opacity: 1;
  }
}

@keyframes slide-in-right {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes toast-up {
  from {
    transform: translateY(8px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.note-circle {
  animation: note-appear 150ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.note-ghost {
  animation: ghost-pulse 1.5s ease-in-out infinite;
}

.panel-right {
  animation: slide-in-right 250ms ease;
}
```

- [ ] **Step 8: Create apps/web/index.html**

Create `apps/web/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AMA-MIDI</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 9: Create apps/web/src/main.tsx**

Create `apps/web/src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 10: Create apps/web/src/App.tsx**

Create `apps/web/src/App.tsx`:

```tsx
import { NOTE_PRESET_COLORS, TRACK_MAX } from '@ama-midi/shared'

function App() {
  return (
    <div className="min-h-screen bg-app-bg p-8">
      <h1 className="text-2xl font-semibold text-primary mb-4">AMA-MIDI</h1>
      <p className="text-gray-600 mb-4">
        Max tracks: {TRACK_MAX}
      </p>
      <div className="flex gap-2">
        {NOTE_PRESET_COLORS.map((color) => (
          <div
            key={color}
            className="w-8 h-8 rounded-full"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  )
}

export default App
```

- [ ] **Step 11: Create apps/web/Dockerfile**

Create `apps/web/Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN pnpm --filter @ama-midi/web build

FROM nginx:alpine AS runner

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 12: Install dependencies and verify**

```bash
cd /Users/hohoanghvy/Projects/ama-midi
pnpm install
cd apps/web && pnpm dev
```

Expected: Browser opens `http://localhost:3000` showing "AMA-MIDI", "Max tracks: 8", and 8 colored circles. Inter font is loaded.

Stop the server (Ctrl+C).

- [ ] **Step 13: Commit**

```bash
cd /Users/hohoanghvy/Projects/ama-midi
git add apps/web
git commit -m "feat(web): scaffold Vite React app with design system"
```

---

## Task 5: Create docker-compose.yml

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create docker-compose.yml**

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: ama-midi-postgres
    environment:
      POSTGRES_DB: ama_midi
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: ama-midi-redis
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 5

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    container_name: ama-midi-api
    ports:
      - '3001:3001'
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/ama_midi
      REDIS_URL: redis://redis:6379
      PORT: 3001
      NODE_ENV: production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    container_name: ama-midi-web
    ports:
      - '3000:80'
    depends_on:
      - api

volumes:
  postgres_data:
  redis_data:
```

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: add docker-compose with all 4 services"
```

---

## Task 6: Create .env.example and README

**Files:**
- Create: `.env.example`
- Create: `README.md`

- [ ] **Step 1: Create .env.example**

Create `.env.example`:

```
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ama_midi

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your_jwt_secret_here_min_32_chars
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback

# AI
ANTHROPIC_API_KEY=your_anthropic_api_key

# CORS
FRONTEND_URL=http://localhost:3000

# Server
PORT=3001
NODE_ENV=development
```

- [ ] **Step 2: Create README.md**

Create `README.md`:

```markdown
# AMA-MIDI

Real-time collaborative MIDI sequencer for Amanotes — piano roll editor, WebSocket collaboration, event-sourced ledger, AI note suggestions.

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose (for full stack)
- PostgreSQL 15 (local dev)
- Redis 7 (local dev)

### Local Development

1. Clone and install:

```bash
git clone <repo>
cd ama-midi
pnpm install
```

2. Copy environment:

```bash
cp .env.example .env
# Edit .env with your values
```

3. Start databases (if using Docker for deps only):

```bash
docker-compose up postgres redis -d
```

4. Run apps:

```bash
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001

### Full Docker Stack

```bash
docker-compose up --build
```

## Project Structure

```
ama-midi/
├── apps/
│   ├── web/          # React 18 + Vite + TailwindCSS
│   └── api/          # NestJS + Prisma
├── packages/
│   └── shared/       # Shared TypeScript types
├── docker-compose.yml
└── turbo.json
```

## Tech Stack

- **Frontend:** React 18, TypeScript, TailwindCSS, TanStack Query, Zustand, Socket.io-client
- **Backend:** NestJS, PostgreSQL, Prisma, Redis, Socket.io
- **Infra:** Docker, Turborepo, pnpm, GitHub Actions
```

- [ ] **Step 3: Commit**

```bash
git add .env.example README.md
git commit -m "docs: add .env.example and README"
```

---

## Task 7: Final Verification

- [ ] **Step 1: Full pnpm install from root**

```bash
cd /Users/hohoanghvy/Projects/ama-midi
rm -rf node_modules apps/*/node_modules packages/*/node_modules pnpm-lock.yaml
pnpm install
```

Expected: All workspaces install without errors.

- [ ] **Step 2: Verify turbo dev runs both apps**

```bash
pnpm dev
```

Expected: Both apps start — web on :3000, api on :3001.

Stop with Ctrl+C.

- [ ] **Step 3: Verify shared imports work**

```bash
cd apps/api && pnpm start:dev &
sleep 5
curl http://localhost:3001/health
```

Expected: JSON response includes `maxTracks: 8`.

Kill the process.

- [ ] **Step 4: Verify TypeScript strict mode passes**

```bash
cd /Users/hohoanghvy/Projects/ama-midi
pnpm --filter @ama-midi/shared lint
pnpm --filter @ama-midi/api exec tsc --noEmit
pnpm --filter @ama-midi/web exec tsc --noEmit
```

Expected: All three pass with exit code 0.

- [ ] **Step 5: Commit verification**

```bash
git status
```

Expected: Working tree clean (all changes committed).

- [ ] **Step 6: Tag Pre-Day complete**

```bash
git tag -a pre-day-complete -m "Pre-Day milestone complete: monorepo, docker, design system"
```

---

## Verification Checklist (from OHO-207, OHO-208, OHO-209, OHO-227)

After all tasks, verify these pass:

- [ ] `pnpm install` at root installs all workspaces
- [ ] `cd apps/web && pnpm dev` loads React page at :3000
- [ ] `cd apps/api && pnpm start:dev` starts NestJS at :3001
- [ ] `import { Note } from '@ama-midi/shared'` works in apps/api
- [ ] `import { NOTE_PRESET_COLORS } from '@ama-midi/shared'` works in apps/web
- [ ] `turbo.json` present with build/dev pipelines
- [ ] `darkMode: 'class'` in tailwind.config.js
- [ ] All 5 keyframe animations in globals.css
- [ ] `docker-compose.yml` defines 4 services
- [ ] `.env.example` committed with 10 variables
- [ ] `.env` is in `.gitignore`
