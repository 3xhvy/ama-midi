# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install
pnpm install

# Dev (both apps, port 3000 web / 3001 api)
pnpm dev

# Build all
pnpm build

# Lint all
pnpm lint

# Test all
pnpm test

# Test API only
cd apps/api && pnpm test

# Integration tests (real DB)
cd apps/api && DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ama_midi_test pnpm test

# DB migrations
cd apps/api && npx prisma migrate dev

# Full Docker stack
docker-compose up --build
```

## Architecture

**Turborepo monorepo**, pnpm workspaces.

```
apps/web      React 18 + Vite + TypeScript (Vercel)
apps/api      NestJS + TypeScript (Railway)
packages/shared  Zero-dep shared TS types, colors, constants
```

### Frontend (`apps/web/src/`)

- `features/` — domain folders: `auth`, `songs`, `editor`, `notes`, `collaboration`, `history`
- `hooks/` — `useSocket`, `useNotes`, `useUndo`
- `store/` — Zustand: editor mode, user presence, view mode (Composer/Developer/QA)
- State: TanStack Query for server state, Zustand for client state
- Piano roll renders notes via `@tanstack/virtual` (Y-axis virtualization) — only ~80 DOM nodes in view for 10,000 notes
- Optimistic UI: note appears instantly, rolls back on 409/error with toast

### Backend (`apps/api/src/modules/`)

- `auth/` — Google OAuth via Passport.js, JWT guards
- `songs/` — Song CRUD
- `notes/` — Note CRUD; catches Prisma `P2002` → HTTP 409 (never 500)
- `ledger/` — Immutable `NoteEvent` records (`NOTE_CREATED/UPDATED/DELETED`) with `before_data`/`after_data` JSONB; undo = compensating event
- `realtime/` — Socket.io gateway + Redis adapter for multi-instance broadcast
- `ai/` — Anthropic Claude API, COMPOSER role only, returns ghost-overlay suggestions

### Shared (`packages/shared/src/`)

- `types.ts` — `Note`, `Song`, `NoteEvent`, `AuthUser`, `NoteSuggestion`
- `colors.ts` — `LAYER_COLORS`, `NOTE_PRESET_COLORS`, `STATUS_COLORS`
- `constants.ts` — `TRACK_MIN/MAX` (1–8), `TIME_MIN/MAX` (0–300s), `SNAP_RESOLUTION`

## Critical Invariants

**Duplicate prevention** is enforced at the DB layer, not just application layer:
```sql
CREATE UNIQUE INDEX uq_notes_song_track_time_active
ON notes (song_id, track, time)
WHERE deleted_at IS NULL;
```
API catches `P2002` → 409. Never add app-level pre-checks as the sole guard.

**Soft deletes** — notes have `deleted_at TIMESTAMPTZ`, never hard deleted (ledger integrity).

**WebSocket broadcast** — events publish to Redis channel; Socket.io Redis adapter fans out to all API instances. All real-time changes go through `realtime/` module.

**Ledger** — every note mutation must write a `NoteEvent`. Do not modify notes without writing the corresponding event.

## Environment

Required vars (see `.env.example`):
- `DATABASE_URL`, `REDIS_URL`
- `JWT_SECRET` (min 32 chars)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
- `ANTHROPIC_API_KEY`
- `FRONTEND_URL`
