# AMA-MIDI

> A real-time collaborative MIDI sequencer for Amanotes internal teams. Piano roll editor with 10,000-note performance, event-sourced change history, WebSocket collaboration, and AI note suggestions.

---

## What it does

AMA-MIDI is a shared visual workspace for music sequences. Composers, game developers, and QA can open the same song, place notes on an 8-track × 300-second piano roll, and see each other's changes in real time — without corrupting shared data.

Three non-negotiables:
- **Visual clarity** — 10,000 notes must be scannable, not frozen
- **Data integrity** — no two notes can occupy the same `(track, time)` position under any conditions, enforced at the database level
- **Real-time sync** — changes propagate to all collaborators within milliseconds

---

## Features

| Feature | Description |
|---|---|
| Piano Roll Editor | 8-track × 300s vertical timeline, notes as colored circles |
| Fast Mode | Click grid → note placed instantly with optimistic UI |
| Popup Mode | Form with title, description, color picker, track, time |
| Duplicate Prevention | `UNIQUE (song_id, track, time)` DB constraint + 409 conflict toast |
| Real-time Collaboration | Socket.io rooms per song, Redis Pub/Sub for multi-instance broadcast |
| User Presence | Avatars of who is currently editing the song |
| Change History (Ledger) | Every note mutation stored as an immutable event |
| Undo | Compensating event reverts last action, broadcasts to all tabs |
| Role-based Views | Composer / Developer / QA views of the same data |
| AI Note Suggester | Claude API suggests next notes as ghost overlays (accept/dismiss) |
| 10,000-note Performance | Virtualized DOM rendering + time-window chunked API fetching |

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript | Concurrent rendering, fast HMR |
| State | TanStack Query + Zustand | Server state cache + lightweight client state |
| Styling | TailwindCSS + CSS variables | Dark editor surface + light app surface |
| Real-time | Socket.io-client | Room-based WebSocket, matches server |
| Rendering | @tanstack/virtual | Virtualized Y-axis for 10,000 notes |
| Backend | NestJS + TypeScript | Modular structure maps to domain modules |
| Database | PostgreSQL 15 + Prisma | ACID, unique constraints, JSONB for ledger |
| Cache/Pub-Sub | Redis 7 | WebSocket broadcast across API instances |
| Auth | Passport.js + Google OAuth + JWT | OIDC/SSO + stateless JWT |
| AI | Anthropic Claude API | Note pattern suggester |
| Monorepo | Turborepo + pnpm | Shared types, incremental builds |
| Infra | Docker Compose + GitHub Actions | Deterministic environments, CI/CD |
| Hosting | Railway (API + DB + Redis) + Vercel (web) | One-click provisioning |

---

## Project Structure

```
ama-midi/
├── apps/
│   ├── web/                        # Vite + React 18 + TypeScript
│   │   └── src/
│   │       ├── features/           # auth, songs, editor, notes, collaboration, history
│   │       ├── hooks/              # useSocket, useNotes, useUndo
│   │       ├── store/              # Zustand (editor mode, presence, view mode)
│   │       └── styles/globals.css  # CSS variables + keyframe animations
│   │
│   └── api/                        # NestJS + TypeScript
│       └── src/
│           └── modules/
│               ├── auth/           # Google OAuth + JWT + guards
│               ├── songs/          # Song CRUD
│               ├── notes/          # Note CRUD + conflict handling
│               ├── ledger/         # note_events + undo
│               ├── realtime/       # Socket.io gateway + Redis adapter
│               └── ai/             # Claude API note suggester
│
├── packages/
│   └── shared/                     # Zero-dependency shared TypeScript types
│       └── src/
│           ├── types.ts            # Note, Song, NoteEvent, AuthUser, NoteSuggestion
│           ├── colors.ts           # LAYER_COLORS, NOTE_PRESET_COLORS, STATUS_COLORS
│           └── constants.ts        # TRACK_MIN/MAX, TIME_MIN/MAX, SNAP_RESOLUTION
│
├── docker-compose.yml              # Full stack: postgres + redis + api + web
├── turbo.json
├── pnpm-workspace.yaml
└── .env.example
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- PostgreSQL 15 (local dev)
- Redis 7 (local dev)
- Docker + Docker Compose (for full stack / CI)

### Local Development

```bash
# 1. Clone and install
git clone git@github.com:3xhvy/ama-midi.git
cd ama-midi
pnpm install

# 2. Configure environment
cp .env.example .env
# Fill in: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET, ANTHROPIC_API_KEY

# 3. Run migrations (after Day 1 — Prisma schema added)
cd apps/api && npx prisma migrate dev

# 4. Start both apps
cd ../..
pnpm dev
```

- **Web:** http://localhost:3000
- **API:** http://localhost:3001
- **Health check:** http://localhost:3001/health

### Full Docker Stack

```bash
# Build and start all 4 services (postgres + redis + api + web)
docker-compose up --build

# Verify
curl http://localhost:3001/health
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ama_midi

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=<min 32 chars, generate with: openssl rand -hex 32>
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback

# AI
ANTHROPIC_API_KEY=<from console.anthropic.com>

# CORS
FRONTEND_URL=http://localhost:3000
```

---

## Key Architecture Decisions

### Modular Monolith over Microservices
The project scope (3-day build, single team) doesn't justify microservices overhead. NestJS modules give clean boundaries between auth, songs, notes, collaboration, history, and AI — without the deployment and networking complexity of separate services.

### PostgreSQL unique constraint as the source of truth for integrity
Application-level duplicate checks are race conditions. The `UNIQUE (song_id, track, time)` partial index (where `deleted_at IS NULL`) is the only guard that works under concurrent writes. The API catches Prisma error code `P2002` and returns HTTP 409 — never 500.

### Event sourcing for the ledger
Every note mutation writes an immutable `NoteEvent` record (`NOTE_CREATED`, `NOTE_UPDATED`, `NOTE_DELETED`) with `before_state` and `after_state` JSONB. Undo emits a compensating event. This gives a complete audit trail without version branching complexity.

### DOM virtualization before Canvas
`@tanstack/virtual` virtualizes the Y-axis (time axis) so only viewport-visible notes are mounted as DOM elements. 10,000 notes → ~80 DOM nodes in view at once. Canvas would improve raw throughput but makes click/hover/select interactions significantly harder to implement correctly.

### Redis Pub/Sub for WebSocket broadcast
Each API instance publishes note events to a Redis channel. The Socket.io Redis adapter delivers them to all instances' rooms. This means real-time sync works whether the app is running on one server or many.

### Optimistic UI with rollback
Notes appear instantly on click. The API call happens in the background. On conflict (409) or error, the ghost note is removed and a toast explains why. This keeps the editor feeling instant even on high-latency connections.

---

## Data Model

Core tables and their key constraint:

```sql
notes (
  id          UUID PRIMARY KEY,
  song_id     UUID REFERENCES songs(id),
  track       INT  CHECK (track BETWEEN 1 AND 8),
  time        NUMERIC(6,2) CHECK (time BETWEEN 0 AND 300),
  title       VARCHAR(200),
  description TEXT,
  color       VARCHAR(20),
  created_by  UUID REFERENCES users(id),
  version     INT DEFAULT 1,
  deleted_at  TIMESTAMPTZ
);

-- THE core integrity constraint
CREATE UNIQUE INDEX uq_notes_song_track_time_active
ON notes (song_id, track, time)
WHERE deleted_at IS NULL;

note_events (
  id           UUID PRIMARY KEY,
  song_id      UUID,
  note_id      UUID,
  event_type   VARCHAR(50),   -- NOTE_CREATED | NOTE_UPDATED | NOTE_DELETED
  actor_id     UUID,
  before_data  JSONB,
  after_data   JSONB,
  created_at   TIMESTAMPTZ
);
```

---

## API Overview

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /auth/google | — | Google OAuth login, returns JWT |
| GET | /auth/me | JWT | Current user |
| GET | /songs | JWT | List songs |
| POST | /songs | JWT | Create song |
| GET | /songs/:id | JWT | Song detail |
| GET | /songs/:id/notes | JWT | List notes (time-windowed) |
| POST | /songs/:id/notes | JWT | Create note — 409 on duplicate |
| PATCH | /notes/:id | JWT | Update note |
| DELETE | /notes/:id | JWT | Soft delete note |
| GET | /songs/:id/events | JWT | Change history (paginated) |
| POST | /songs/:id/suggest-notes | JWT, COMPOSER | AI note suggestions |

---

## WebSocket Events

```
Client → Server:
  join-song     { songId }        Join song room
  leave-song    { songId }        Leave song room

Server → Client:
  note-created  { note }          New note from any collaborator
  note-updated  { note }          Note updated
  note-deleted  { noteId }        Note deleted
  note-conflict { error }         Duplicate position rejected
  user-joined   { user }          Collaborator entered song
  user-left     { userId }        Collaborator left song
```

---

## Testing

```bash
# Unit tests (NoteService: constraint, boundary, event writes)
cd apps/api && pnpm test

# Integration tests (real PostgreSQL test DB)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ama_midi_test pnpm test

# Load test (100 VUs, 30s — requires k6)
k6 run --vus 100 --duration 30s scripts/load-test.js
```

---

## Delivery Timeline

| Phase | Scope |
|---|---|
| Pre-Day ✅ | Monorepo, Docker, design system, shared types |
| Day 1 | Prisma schema, Auth, Song CRUD, Note CRUD, Piano Roll UI |
| Day 2 | WebSocket collaboration, Ledger, History panel, Security |
| Day 3 | 10k-note performance, AI suggester, DevOps, CI/CD |
