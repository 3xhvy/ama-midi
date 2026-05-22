# AMA-MIDI VPS Production Infrastructure and Scaling Plan

**Date:** 2026-05-22  
**Scope:** Production deployment, CI/CD, operations, and later scaling path  
**Context:** Based on `initial_document/`, `README.md`, and the Linear-derived architecture notes in `docs/superpowers/specs/2026-05-22-architecture-design.md`.

---

## 1. Recommendation

Use a VPS-first production setup with Docker Compose, Caddy, PostgreSQL, Redis, and GitHub Actions over SSH.

This is the best fit for AMA-MIDI right now because the product is a modular monolith:

- `apps/web`: React + Vite frontend
- `apps/api`: NestJS API
- PostgreSQL: source of truth for notes, ledger, users, and songs
- Redis: Socket.io pub/sub and later multi-instance realtime fanout
- Prisma: migrations and database access

Do not start with Kubernetes, microservices, or a cloud-heavy platform. They add operational weight before the product needs it. The right production path is simple now, with clear upgrade points later.

---

## 2. Production V1 Architecture

```text
Cloudflare DNS
  |
  v
VPS
  |
  +-- Caddy / Nginx
  |     +-- https://ama-midi.example.com      -> web
  |     +-- https://api.ama-midi.example.com  -> api
  |
  +-- Docker Compose
        +-- web        React/Vite static app
        +-- api        NestJS API
        +-- postgres   PostgreSQL 15
        +-- redis      Redis 7
```

Use **Caddy** unless there is already an Nginx standard. Caddy keeps the setup smaller because HTTPS certificates and renewal are automatic.

### Minimum VPS Size

For MVP and small internal usage:

```text
2 vCPU
4 GB RAM
40 GB SSD
Ubuntu 22.04 or 24.04
Docker + Docker Compose plugin
```

For heavier collaboration testing:

```text
4 vCPU
8 GB RAM
80 GB SSD
```

---

## 3. Production Services

### Web

The web app is built once and served as static files.

```text
Source: apps/web
Build: pnpm --filter @ama-midi/web build
Output: apps/web/dist
Runtime: static server container behind Caddy
```

### API

The API runs as a NestJS production process.

```text
Source: apps/api
Build: pnpm --filter @ama-midi/api build
Runtime: node dist/main
Port: 3001 internally
Health check: GET /health
```

The API remains the authority for all note mutations. The database unique constraint continues to enforce one active note per `(songId, track, time)` under concurrent writes.

### PostgreSQL

PostgreSQL can start on the same VPS for cost and speed, but it is the first component to move out when the system becomes production-critical.

Initial:

```text
postgres container
named Docker volume
nightly backups
off-server backup copy
```

Later:

```text
managed Postgres
or separate DB VPS with disk snapshots and backup monitoring
```

### Redis

Redis supports:

- Socket.io pub/sub
- future multi-API realtime fanout
- possible short-lived cache/session use

Keep Redis on the app VPS at first. Move it only when API instances spread across multiple servers or realtime traffic becomes significant.

---

## 4. Environment Variables

Production secrets should live on the VPS, not in GitHub and not in the repository.

Recommended location:

```text
/opt/ama-midi/.env.production
```

Required variables:

```text
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=<at least 32 chars>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://api.ama-midi.example.com/auth/google/callback
ANTHROPIC_API_KEY=...
FRONTEND_URL=https://ama-midi.example.com
NODE_ENV=production
PORT=3001
```

For local development, keep using `.env.example` as the template.

---

## 5. CI/CD Strategy

Use GitHub Actions for verification and deployment.

### Pull Request Pipeline

Every PR should run:

```text
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
prisma validate
docker build check
```

The goal is to catch type errors, broken builds, broken tests, and invalid Prisma schema changes before anything reaches production.

### Main Branch Deployment

On push to `main`:

```text
1. Run the full PR pipeline again
2. SSH into the VPS
3. Pull latest code or pull versioned images
4. Run Prisma migrations with migrate deploy
5. Restart containers
6. Run API health check
```

Initial simple deploy:

```text
GitHub Actions
  -> SSH VPS
  -> cd /opt/ama-midi
  -> git pull origin main
  -> pnpm install --frozen-lockfile
  -> pnpm build
  -> docker compose -f docker-compose.prod.yml build
  -> docker compose -f docker-compose.prod.yml run --rm api pnpm --filter @ama-midi/api prisma migrate deploy
  -> docker compose -f docker-compose.prod.yml up -d
  -> curl https://api.ama-midi.example.com/health
```

This is good enough for the first production deployment.

### Later Deploy Improvement

When VPS builds become slow or rollback matters more, switch to container registry deploys:

```text
GitHub Actions
  -> build Docker images
  -> push images to GHCR
  -> SSH VPS
  -> docker compose pull
  -> prisma migrate deploy
  -> docker compose up -d
```

Use immutable image tags:

```text
ghcr.io/<org>/ama-midi-api:<git-sha>
ghcr.io/<org>/ama-midi-web:<git-sha>
```

Rollback becomes redeploying the previous image tag.

---

## 6. Migration Policy

Production must use:

```bash
prisma migrate deploy
```

Do not use:

```bash
prisma migrate dev
```

Rules:

- Run migrations before restarting the new API container.
- Keep migrations backward-compatible where possible.
- Avoid destructive migrations without a backup.
- Confirm the partial unique index on active notes remains intact:

```sql
CREATE UNIQUE INDEX "uq_notes_active_position"
ON "notes" ("songId", "track", "time")
WHERE "deletedAt" IS NULL;
```

This index is a production invariant, not an optimization.

---

## 7. Backup Plan

If PostgreSQL runs on the VPS, backups are mandatory.

Minimum:

```text
nightly pg_dump
retain 7 daily backups
copy backups off-server
verify restore at least once before launch
```

Recommended off-server storage:

```text
Cloudflare R2
Backblaze B2
AWS S3
```

Backup naming:

```text
ama-midi-prod-YYYY-MM-DD-HHMM.sql.gz
```

Restore testing matters because an untested backup is only a file, not a recovery plan.

---

## 8. Observability

Start small:

```text
Container logs: docker compose logs
API health: GET /health
Uptime check: external HTTP monitor
Error tracking: Sentry or equivalent
Server metrics: CPU, RAM, disk usage
Database metrics: disk usage, connection count, backup status
```

Minimum alerts:

- API health check failing
- VPS disk usage above 80%
- backup failed
- PostgreSQL container restarted unexpectedly
- API error rate spike

---

## 9. Security Baseline

Production baseline:

- SSH key login only
- disable password SSH login
- firewall allows only `22`, `80`, `443`
- keep `.env.production` outside Git
- rotate `JWT_SECRET` if leaked
- CORS locked to `FRONTEND_URL`
- Google OAuth callback locked to production API URL
- rate limiting enabled on API
- database port not exposed publicly
- Redis port not exposed publicly

Cloudflare can sit in front of the VPS for DNS, TLS proxying, and basic DDoS protection.

---

## 10. Scaling Path

Scale in the order that protects data and removes actual bottlenecks.

### Phase 1: Single VPS

```text
VPS:
  - caddy
  - web
  - api
  - postgres
  - redis
```

Use this for MVP, demos, and small internal usage.

### Phase 2: Separate PostgreSQL

```text
VPS App Server:
  - caddy
  - web
  - api
  - redis

Managed Postgres or DB VPS:
  - postgres
  - backups
  - monitoring
```

Move Postgres first because app containers are replaceable and database data is not.

### Phase 3: Registry-Based Deploys

```text
GitHub Actions:
  - build images
  - push to GHCR

VPS:
  - pull image tags
  - migrate
  - restart
```

This improves rollback and makes deployments more reproducible.

### Phase 4: Multiple API Containers

```text
VPS:
  - caddy load balances api-1, api-2, api-3
  - redis supports Socket.io adapter fanout
  - web remains static
```

AMA-MIDI already has the correct realtime direction: Redis adapter for Socket.io. That lets multiple API containers broadcast to the same song rooms.

### Phase 5: Separate Collaboration Service

Extract collaboration only when WebSocket connections become the dominant load.

```text
api:
  - auth
  - songs
  - notes
  - ledger
  - validation

collaboration-service:
  - Socket.io rooms
  - presence
  - realtime fanout
```

Keep `SongModule`, `NoteModule`, and `LedgerModule` together as long as possible because they are transaction-heavy and strongly relational.

### Phase 6: Separate AI Worker

AI should be extracted before core note writes because it has different latency, cost, and failure behavior.

```text
api:
  - accepts suggestion request
  - validates user and song access
  - queues job

queue:
  - pending AI suggestion jobs

ai-worker:
  - calls Anthropic
  - validates returned suggestions
  - stores result or emits event
```

This prevents slow external AI calls from tying up API workers.

---

## 11. What Not To Do Yet

Avoid these until there is a real bottleneck:

- Kubernetes
- microservices from day one
- Kafka
- Terraform-heavy infrastructure
- self-managed multi-node PostgreSQL
- complex blue/green deployments
- separate staging environment before production traffic exists

These are not bad tools. They are wrong starting points for this scope.

---

## 12. Final Target State

The practical path is:

```text
Now:
  single VPS + Docker Compose + Caddy + GitHub Actions SSH deploy

Real production:
  app VPS + separate PostgreSQL + off-server backups + monitoring

Later scale:
  registry-based deploys + multiple API containers + Redis Socket.io adapter

Much later:
  collaboration service + AI worker + outbox worker
```

This keeps AMA-MIDI easy to deploy now while preserving a credible path to production scale.
