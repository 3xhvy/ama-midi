# AMA-MIDI

**A real-time collaborative MIDI sequencer for Amanotes internal teams.**

Composers, game developers, and QA open the same song simultaneously, place notes on an 8-track × 300-second piano roll, and see each other's changes in under a second — with zero data corruption. The editor handles 10,000 notes without freezing, enforces duplicate-free positioning at the database layer, and logs every mutation for instant undo and full audit history.

> This is not a CRUD application. It is an internal creative tool that bridges music composition and game production for teams that need to iterate fast and ship with confidence.

---

## Live Demo

| Service | URL |
|---|---|
| Web app | https://ama-midi.hvy-dev.uk |
| API health | https://ama-midi.hvy-dev.uk/api/health |

---

## Project Documentation

Full project documentation is organized as a narrative — problem first, decisions second, implementation third.

| Doc | What It Covers |
|---|---|
| [01 · Problem & Vision](docs/project/01-problem-and-vision.md) | Why this exists. The workflow gap. Why it's technically hard. |
| [02 · Actors & Use Cases](docs/project/02-actors-and-use-cases.md) | 4 actors, their real needs, the non-obvious UX decisions behind each. |
| [03 · Feature Hierarchy](docs/project/03-features.md) | P0 → P1 → P2 priority tiers with rationale. What was cut and why. |
| [04 · Design Thinking](docs/project/04-design-thinking.md) | 6 key architectural decisions. Strongest opposing argument first. |
| [05 · Architecture & System Design](docs/project/05-architecture.md) | Stack choices, module map, data model, real-time topology. |
| [06 · Major Feature Workflows](docs/project/06-workflows.md) | Note creation (happy + conflict path), real-time collaboration, AI suggester. |
| [07 · Key Trade-offs](docs/project/07-trade-offs.md) | Decision table: what was chosen, what was rejected, what was gained and lost. |
| [08 · Project Structure](docs/project/08-project-structure.md) | Annotated monorepo folder tree. Why each boundary exists. |
| [09 · Deploy Pipeline](docs/project/09-deploy.md) | VPS topology, Docker Compose services, Nginx config, GitHub Actions CI/CD. |
| [10 · Retrospective](docs/project/10-retrospective.md) | What I'd do differently. Why this problem is genuinely hard. |

---

## Quick Start

```bash
# Clone and install
git clone git@github.com:3xhvy/ama-midi.git
cd ama-midi
pnpm install

# Configure environment
cp .env.example .env
# Fill in: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET (min 32 chars)
# AI_PROVIDER=anthropic|openai|deepseek + the matching API key

# Run DB migrations
cd apps/api && npx prisma migrate dev

# Seed 10,000 notes for local performance testing (optional)
pnpm seed

# Seed notes on your own chart (for k6 — use a chart your login can edit)
CHART_ID="<chart-id-from-editor-url>" pnpm seed
# or
SONG_ID="<song-id-from-editor-url>" pnpm seed

# Start both apps (web :3000 / api :3001)
cd ../.. && pnpm dev
```

**Full Docker stack:**

```bash
docker-compose up --build
curl http://localhost:3001/health
```

---

## Key Capabilities

| Capability | How It Works |
|---|---|
| **Piano Roll Editor** | 8-track × 300s vertical timeline. Notes as colored circles at precise (track, time) positions. |
| **Fast Mode** | Click grid → note placed instantly (optimistic UI). No form interruption. |
| **Duplicate Prevention** | `UNIQUE (song_id, track, time) WHERE deleted_at IS NULL` — enforced atomically at DB layer, not application layer. |
| **Real-time Collaboration** | Socket.io rooms per song. Redis Pub/Sub fans events to all API instances. All collaborators see changes in < 1s. |
| **Change Ledger** | Every mutation writes an immutable `NoteEvent` with `before_state` / `after_state` JSONB. Undo = compensating event. |
| **10,000-note Performance** | Two-layer windowing: API returns only the visible time window; client clamps to viewport. ~60–120 active DOM nodes regardless of total count. |
| **AI Note Suggester** | Sends last 10 notes to a configurable AI provider (Anthropic Claude / OpenAI / DeepSeek) → receives 3–5 pattern-continuation suggestions → renders as ghost overlays (accept/dismiss per note). |
| **Role-based Access** | Admin / Composer / Developer / Viewer enforced at NestJS route guards and React UI layer. |

---

## Architecture (Summary)

**Turborepo monorepo.** `apps/web` (React 18 + Vite) · `apps/api` (NestJS) · `packages/shared` (zero-dep TypeScript types).

**Why modular monolith:** Clean NestJS module boundaries without microservices overhead. `AuthModule`, `SongModule`, `NoteModule`, `LedgerModule`, `RealtimeModule`, `AiModule` — each owns its domain, communicates through defined interfaces. Natural microservice cut points if scale demands it.

**Why DB-level unique constraint:** App-level pre-checks are race conditions. Two concurrent writes both pass the check before either commits. The partial unique index is atomic — one insert wins, one gets `P2002` → HTTP 409 → optimistic rollback + toast.

**Why event sourcing:** Every note mutation is an immutable event. Undo = compensating event (new `NOTE_DELETED`). No history mutation, no branching complexity. Full audit trail with before/after state.

→ Full architecture detail: [Architecture & System Design](docs/project/05-architecture.md)

---

## Testing

```bash
# Unit tests (NoteService: 6 behavioral contracts)
cd apps/api && pnpm test

# Integration tests (real DB — requires ama_midi_test database)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ama_midi_test pnpm test

# Load test (requires k6 + running API)
k6 run scripts/load-test.js
```

**Critical test — concurrent conflict:**

```bash
# Two simultaneous POSTs to the same (song_id, track, time).
# Expected: [201, 409] in some order. DB contains exactly 1 note.
# Promise.all — not sequential — is what tests the race condition.
```

See [Performance & Correctness Testing Plan](docs/performance-testing-plan.md) for full procedures.

---

## Environment Variables

See `.env.example`. Required:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Min 32 chars. Generate: `openssl rand -hex 32` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | OAuth redirect URI |
| `AI_PROVIDER` | `anthropic` \| `openai` \| `deepseek` — selects AI backend |
| `ANTHROPIC_API_KEY` | Required when `AI_PROVIDER=anthropic` |
| `OPENAI_API_KEY` | Required when `AI_PROVIDER=openai` |
| `DEEPSEEK_API_KEY` | Required when `AI_PROVIDER=deepseek` |
| `FRONTEND_URL` | Used for CORS and OAuth redirect validation |

---

## Deploy

Two separated VPS with Docker Compose 1 for Postgre DB other for Application. Host Nginx handles TLS and reverse proxy. GitHub Actions builds images → pushes to GHCR → SSHs to VPS → `docker compose pull && up`.

→ Full deploy guide: [Deploy Pipeline](docs/project/09-deploy.md)

---

## Commands

```bash
pnpm install          # Install all workspaces
pnpm dev              # Start web (:3000) and api (:3001)
pnpm build            # Build all
pnpm lint             # Lint all
pnpm test             # Test all
cd apps/api && pnpm test                        # API tests only
cd apps/api && npx prisma migrate dev           # Run DB migrations
docker-compose up --build                       # Full Docker stack
```
