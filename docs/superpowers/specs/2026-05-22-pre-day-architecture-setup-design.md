# AMA-MIDI — Pre-Day Architecture, Structure & Environment Design

**Date:** 2026-05-22  
**Scope:** Pre-Day milestone (OHO-207, OHO-208, OHO-209, OHO-227)  
**Status:** Approved  

---

## 1. Context

AMA-MIDI is a real-time collaborative MIDI sequencer for Amanotes internal teams. The project is a 3-day build evaluated against a 100-point grading rubric. Every day of the build depends on the Pre-Day setup being correct. This document covers the architecture, folder structure, and environment decisions made before any application code is written.

All decisions are grounded in the four Linear issues for the Pre-Day milestone:
- **OHO-207** — Turborepo monorepo structure
- **OHO-208** — Docker Compose (full stack)
- **OHO-209** — `.env.example`
- **OHO-227** — CSS design system + `packages/shared` types

---

## 2. Repository Structure

### 2.1 Monorepo — Turborepo + pnpm

**Decision:** Turborepo monorepo managed with pnpm workspaces.

**Why Turborepo over separate repos:**
- `packages/shared` TypeScript types can be imported by both `apps/web` and `apps/api` with zero duplication — critical since `Note`, `Song`, `NoteEvent` types must be identical on frontend and backend.
- Single `pnpm install` at root — no lockfile drift between apps.
- Turbo's build cache rebuilds only what changed — fast CI.
- Clean architecture signal for graders.

**Why pnpm over npm/yarn:**
- Native workspace protocol (`workspace:*`) with no hoisting surprises.
- Faster installs, disk-efficient content-addressable store.

### 2.2 Full Folder Structure

```
ama-midi/                               ← git root
├── apps/
│   ├── web/                            ← Vite + React 18 + TypeScript
│   │   ├── src/
│   │   │   ├── app/                    ← routing, providers, App.tsx
│   │   │   ├── components/             ← shared UI primitives
│   │   │   ├── features/               ← feature slices
│   │   │   │   ├── auth/
│   │   │   │   ├── songs/
│   │   │   │   ├── editor/
│   │   │   │   ├── notes/
│   │   │   │   ├── collaboration/
│   │   │   │   └── history/
│   │   │   ├── hooks/                  ← useSocket, useNotes, useUndo
│   │   │   ├── lib/                    ← api client, ws client, utils
│   │   │   ├── store/                  ← Zustand stores
│   │   │   ├── styles/                 ← globals.css
│   │   │   └── types/                  ← frontend-only types
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.js
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── api/                            ← NestJS + TypeScript
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/               ← Google OAuth + JWT + guards
│       │   │   ├── users/              ← user profile
│       │   │   ├── songs/              ← song CRUD
│       │   │   ├── notes/              ← note CRUD + conflict handling
│       │   │   ├── ledger/             ← note_events + undo
│       │   │   ├── realtime/           ← Socket.io gateway + Redis adapter
│       │   │   └── ai/                 ← Claude API note suggester
│       │   ├── common/                 ← decorators, filters, interceptors, pipes
│       │   ├── database/               ← Prisma service + module
│       │   ├── app.module.ts
│       │   └── main.ts
│       ├── prisma/
│       │   └── schema.prisma
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   └── shared/                         ← zero-dependency shared package
│       ├── src/
│       │   ├── types.ts                ← domain interfaces
│       │   ├── colors.ts               ← color constants
│       │   └── constants.ts            ← track/time range constants
│       ├── tsconfig.json
│       └── package.json                ← name: "@ama-midi/shared"
│
├── docker-compose.yml                  ← full stack (postgres + redis + api + web)
├── turbo.json
├── pnpm-workspace.yaml
├── .env.example
├── .gitignore
└── README.md
```

---

## 3. Turborepo Pipeline Config (`turbo.json`)

Four pipelines:

| Pipeline | Depends on | Cached | Notes |
|---|---|---|---|
| `build` | `^build` | Yes | Builds dependencies first |
| `dev` | — | No | Watch mode, runs apps in parallel |
| `lint` | — | Yes | ESLint on all packages |
| `test` | `build` | Yes | Jest unit + integration |

The `dev` pipeline runs `apps/web` (Vite HMR on `:3000`) and `apps/api` (NestJS watch on `:3001`) in parallel. `packages/shared` has no dev script — consumed directly via TypeScript path aliases.

---

## 4. Docker Compose (`docker-compose.yml`)

**One file, all 4 services.** Used for CI, grading verification, and production.

| Service | Image | Port | Notes |
|---|---|---|---|
| `postgres` | `postgres:15` | `5432` | healthcheck: `pg_isready` |
| `redis` | `redis:7-alpine` | `6379` | healthcheck: `redis-cli ping` |
| `api` | `build: ./apps/api` | `3001` | `depends_on` postgres + redis with health condition |
| `web` | `build: ./apps/web` | `3000` | — |

**Local dev workflow:** Run apps natively with `pnpm dev` + local Postgres and Redis. The `docker-compose.yml` is for CI/grading — the grading checklist requires `docker-compose up starts everything`.

---

## 5. Environment Variables (`.env.example`)

Based on OHO-209 with 3 practical additions:

```
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ama_midi

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your_jwt_secret_here
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

`.env` is gitignored. `.env.example` is committed. A separate `.env.test` (not committed) sets `DATABASE_URL` to `ama_midi_test` for Jest integration tests.

---

## 6. `packages/shared` Contents

### 6.1 `src/types.ts` — domain interfaces

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
  track: number        // 1–8
  time: number         // 0.0–300.0, 0.1s resolution
  title: string
  description: string
  color: string        // hex
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

### 6.2 `src/colors.ts` — design system constants

```typescript
export const LAYER_COLORS = {
  midi:       { primary: '#3B82F6', bg: '#EFF6FF', label: 'MIDI' },
  beatmap:    { primary: '#06B6D4', bg: '#ECFEFF', label: 'Beat Map' },
  gameplay:   { primary: '#8B5CF6', bg: '#F5F3FF', label: 'Gameplay' },
  difficulty: { primary: '#EC4899', bg: '#FDF2F8', label: 'Difficulty' },
  events:     { primary: '#F59E0B', bg: '#FFFBEB', label: 'Events' },
} as const

export const NOTE_PRESET_COLORS = [
  '#6C63FF', '#3B82F6', '#10B981', '#F59E0B',
  '#EF4444', '#EC4899', '#06B6D4', '#8B5CF6',
] as const

export const STATUS_COLORS = {
  synced:      { color: '#10B981', bg: '#ECFDF5', label: 'Synced' },
  needsReview: { color: '#F59E0B', bg: '#FFFBEB', label: 'Needs Review' },
  outdated:    { color: '#EF4444', bg: '#FEF2F2', label: 'Outdated' },
  draft:       { color: '#6B6585', bg: '#F3F0F9', label: 'Draft' },
} as const
```

### 6.3 `src/constants.ts` — validation constants

```typescript
export const TRACK_MIN = 1
export const TRACK_MAX = 8
export const TIME_MIN = 0
export const TIME_MAX = 300
export const SNAP_RESOLUTION = 0.1
```

These are imported by both `apps/api` (NestJS DTO validators in OHO-210, OHO-214) and `apps/web` (grid coordinate math in OHO-215).

---

## 7. Frontend Design System (`apps/web`)

### 7.1 `src/styles/globals.css` — CSS variables + keyframes

All components reference CSS variables, never hardcoded hex values. Variables cover:
- Brand: `--color-primary` (#6C63FF), `--color-primary-light`, `--color-primary-dark`
- Editor surface (dark zone): `--color-editor-bg` (#13111E), `--color-editor-surface`, `--color-editor-border`, `--color-editor-text`, `--color-grid-line`, `--color-grid-line-bold`
- App surface (light zones): `--color-bg` (#F8F7FF), `--color-surface`, `--color-border`
- Text: `--color-text-primary` (#1A1635), `--color-text-secondary`, `--color-text-tertiary`
- Semantic: `--color-success`, `--color-warning`, `--color-error`, `--color-info`
- Radius: `--radius-sm` (6px) through `--radius-full` (9999px)
- Shadow: `--shadow-sm`, `--shadow-md`, `--shadow-lg` (brand-tinted purple)
- Typography: `--font-sans`, `--font-mono`
- Transitions: `--transition-fast` (150ms), `--transition-normal` (250ms)

Five keyframe animations (from OHO-227):
- `note-appear` — note placement pop-in (150ms cubic-bezier spring)
- `note-disappear` — note deletion fade-out
- `ghost-pulse` — AI suggestion ghost notes (1.5s loop)
- `slide-in-right` — history/right panels (250ms)
- `toast-up` — toast notifications (150ms)

### 7.2 `tailwind.config.js` — extended theme

- `darkMode: 'class'` (required by OHO-207)
- Extended colors: `primary`, `editor`, `app` scales mapped to CSS variables
- Extended fonts: Inter + JetBrains Mono
- Extended shadows: `brand` shadow
- Extended border radius: `xl` (16px), `2xl` (24px)

### 7.3 Fonts

Google Fonts link in `index.html`: Inter (400/500/600/700) + JetBrains Mono (400/500).

---

## 8. Verification Checklist

Drawn from OHO-207, OHO-208, OHO-209, OHO-227 acceptance criteria:

### Monorepo
- [ ] `pnpm install` at root installs all workspaces
- [ ] `cd apps/web && pnpm dev` loads blank React page at `:3000`
- [ ] `cd apps/api && pnpm start:dev` starts NestJS at `:3001` with no errors
- [ ] `import { Note } from '@ama-midi/shared'` works in `apps/api` without TS error
- [ ] `import { NOTE_PRESET_COLORS } from '@ama-midi/shared'` works in `apps/web` without TS error
- [ ] `turbo.json` present at root with `build` and `dev` pipelines

### Docker
- [ ] `docker-compose up` starts all 4 services with zero errors
- [ ] `psql -h localhost -U postgres ama_midi` connects
- [ ] `redis-cli -h localhost ping` returns PONG
- [ ] No container exits immediately after starting

### Environment
- [ ] `.env.example` committed with all 10 variables
- [ ] `.env` is in `.gitignore` and not committed

### Design System
- [ ] `var(--color-editor-bg)` resolves in browser DevTools
- [ ] Inter font loads (DevTools → Computed → font-family shows 'Inter')
- [ ] All 5 keyframe animations present in `globals.css`
- [ ] `darkMode: 'class'` in `tailwind.config.js`
- [ ] `npx tsc --noEmit` passes in `packages/shared`

---

## 9. What This Does NOT Cover

The following are out of scope for this Pre-Day spec and belong to their own Linear issues:

- Prisma schema (OHO-210 — Day 1, Block 1)
- AuthModule (OHO-212 — Day 1, Block 2)
- Any React component or NestJS module
- GitHub Actions CI/CD (OHO-225 — Day 3)
- Railway/Vercel deployment config (OHO-225 — Day 3)
