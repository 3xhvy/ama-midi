# AMA-MIDI

A real-time collaborative MIDI sequencer I built for Amanotes-style internal teams — composers, game devs, and QA editing the same song on an 8-track × 300-second piano roll, with duplicate-safe positioning at the database layer, a change ledger for undo, and enough performance to stay usable at 10,000 notes.

Live demo: [ama-midi.hvy-dev.uk](https://ama-midi.hvy-dev.uk) · API health: [/api/health](https://ama-midi.hvy-dev.uk/api/health)

> I treated this as a creative workflow tool, not a CRUD demo — the hard part is shared context under concurrency, not storing rows.

---

## Live Demo


| Service    | URL                                                                              |
| ---------- | -------------------------------------------------------------------------------- |
| Web app    | [https://ama-midi.hvy-dev.uk](https://ama-midi.hvy-dev.uk)                       |
| API health | [https://ama-midi.hvy-dev.uk/api/health](https://ama-midi.hvy-dev.uk/api/health) |


---

## Project Documentation

I wrote these in order — problem first, then decisions, then how I built it. Each file is meant to be read standalone if you're grading one slice of the work.


| Doc                                                                  | What It Covers                                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [01 · Problem & Vision](docs/project/01-problem-and-vision.md)       | Why I think this problem exists and what makes it hard.                         |
| [02 · Actors & Use Cases](docs/project/02-actors-and-use-cases.md)   | The four roles and the UX calls I made for each.                                |
| [03 · Feature Hierarchy](docs/project/03-features.md)                | What I shipped P0/P1/P2 and what I cut.                                         |
| [04 · Design Thinking](docs/project/04-design-thinking.md)           | Six architecture decisions — opposing argument first, then my choice.           |
| [05 · Architecture & System Design](docs/project/05-architecture.md) | Stack, modules, data model, realtime topology.                                  |
| [06 · Major Feature Workflows](docs/project/06-workflows.md)         | Note create (happy + conflict), collaboration, AI suggester.                    |
| [07 · Key Trade-offs](docs/project/07-trade-offs.md)                 | What I gained and gave up per decision.                                         |
| [08 · Project Structure](docs/project/08-project-structure.md)       | Monorepo layout and why the boundaries are where they are.                      |
| [09 · Deploy Pipeline](docs/project/09-deploy.md)                    | How I deploy to VPS (Docker, Nginx, GitHub Actions).                            |
| [10 · Performance & Correctness Testing](docs/project/10-performance-testing.md) | How I verified conflicts, boundaries, load, 10k UI, and collaboration. |
| [11 · Load Testing (k6)](docs/project/11-load-testing.md)            | How I run k6 locally — seed, probe, smoke, full 100 VU.                         |
| [12 · k6 Test Report](docs/project/12-k6-test-report.md)             | My load-test narrative — first attempt, diagnosis, fix, second attempt.         |
| [13 · Retrospective](docs/project/13-retrospective.md)               | What I'd do differently and why the problem is genuinely difficult.             |


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


| Capability                  | How It Works                                                                                                                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Piano Roll Editor**       | 8-track × 300s vertical timeline. Notes as colored circles at precise (track, time) positions.                                                                                                  |
| **Fast Mode**               | Click grid → note placed instantly (optimistic UI). No form interruption.                                                                                                                       |
| **Duplicate Prevention**    | `UNIQUE (song_id, track, time) WHERE deleted_at IS NULL` — enforced atomically at DB layer, not application layer.                                                                              |
| **Real-time Collaboration** | Socket.io rooms per song. Redis Pub/Sub fans events to all API instances. All collaborators see changes in < 1s.                                                                                |
| **Change Ledger**           | Every mutation writes an immutable `NoteEvent` with `before_state` / `after_state` JSONB. Undo = compensating event.                                                                            |
| **10,000-note Performance** | Two-layer windowing: API returns only the visible time window; client clamps to viewport. ~60–120 active DOM nodes regardless of total count.                                                   |
| **AI Note Suggester**       | Sends last 10 notes to a configurable AI provider (Anthropic Claude / OpenAI / DeepSeek) → receives 3–5 pattern-continuation suggestions → renders as ghost overlays (accept/dismiss per note). |
| **Role-based Access**       | Admin / Composer / Developer / Viewer enforced at NestJS route guards and React UI layer.                                                                                                       |


---

## Architecture (Summary)

Monorepo: `apps/web` (React 18 + Vite), `apps/api` (NestJS), `packages/shared` (shared types).

I chose a **modular monolith** — NestJS modules with clear boundaries (`Auth`, `Song`, `Note`, `Ledger`, `Realtime`, `Ai`) without microservices overhead for a solo build. A **DB unique constraint** on `(chart, track, time)` handles duplicate races atomically (one 201, one 409; never rely on app pre-check alone). **Event sourcing** via an immutable ledger: undo is a compensating event, full audit trail.

→ Details: [Architecture & System Design](docs/project/05-architecture.md)

---

## Testing

I kept automated tests focused on behavioural contracts in the API (`cd apps/api && pnpm test`). Integration tests need a real `ama_midi_test` database:

```bash
cd apps/api && pnpm test
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ama_midi_test pnpm test
```

### Load test (k6)

How I run it: **[Load Testing (k6)](docs/project/11-load-testing.md)**. What I found: **[k6 Test Report](docs/project/12-k6-test-report.md)**. Broader checks (conflicts, boundaries, 10k UI, collaboration): **[Performance & Correctness Testing](docs/project/10-performance-testing.md)**.

Requires k6, a running API, JWT, and a chart I can edit.

```bash
# 1. Seed 10k notes on your chart (optional, for UI + dense chart)
CHART_ID="<chart-id-from-editor>" pnpm seed

# 2. Single request probe (expect 201 or 409)
curl -s -w "\nHTTP %{http_code}\n" \
  -X POST "http://localhost:3001/charts/$CHART_ID/notes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"track":1,"time":200.0,"title":"probe"}'

# 3. Smoke test (under rate limit — should pass all thresholds)
BASE_URL=http://localhost:3001 CHART_ID="$CHART_ID" TOKEN="$TOKEN" \
  VUS=1 DURATION=60s SLEEP=2 k6 run scripts/load-test.js

# 4. Full 100 VU test — raise THROTTLE_* in apps/api/.env first (see guide)
BASE_URL=http://localhost:3001 CHART_ID="$CHART_ID" TOKEN="$TOKEN" \
  k6 run scripts/load-test.js
```

**Concurrent conflict** (two POSTs to the same `(track, time)` → one 201, one 409, exactly one DB row):

```bash
# Two simultaneous POSTs to the same (track, time).
# Expected: [201, 409] in some order. DB contains exactly 1 note.
```

---

## Environment Variables

See `.env.example`. Required:


| Variable               | Purpose                                                  |
| ---------------------- | -------------------------------------------------------- |
| `DATABASE_URL`         | PostgreSQL connection string                             |
| `REDIS_URL`            | Redis connection string                                  |
| `JWT_SECRET`           | Min 32 chars. Generate: `openssl rand -hex 32`           |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID                                   |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret                               |
| `GOOGLE_CALLBACK_URL`  | OAuth redirect URI                                       |
| `AI_PROVIDER`          | `anthropic` | `openai` | `deepseek` — selects AI backend |
| `ANTHROPIC_API_KEY`    | Required when `AI_PROVIDER=anthropic`                    |
| `OPENAI_API_KEY`       | Required when `AI_PROVIDER=openai`                       |
| `DEEPSEEK_API_KEY`     | Required when `AI_PROVIDER=deepseek`                     |
| `FRONTEND_URL`         | Used for CORS and OAuth redirect validation              |


---

## Deploy

I run Postgres on one VPS and the app stack on another, with host Nginx for TLS and reverse proxy. CI builds images → GHCR → SSH deploy.

→ [Deploy Pipeline](docs/project/09-deploy.md)

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

