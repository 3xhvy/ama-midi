# AMA-MIDI — VPS Deployment Plan

Complete deployment guide for running AMA-MIDI on a **single VPS** using Docker Compose (PostgreSQL + Redis + API + Web), host Nginx, and GitHub Actions CI/CD (GHCR → SSH deploy).

Modeled on the [Owen backend](https://github.com/3xhvy/owen-backend) deployment pattern: build images in GitHub Actions, push to GHCR, SSH to VPS, `docker compose pull && up`.

---

## Executive Summary


| Component                  | Where it runs                                        |
| -------------------------- | ---------------------------------------------------- |
| **React SPA**              | `ama-midi-web` container → `127.0.0.1:8080`          |
| **NestJS API + Socket.io** | `ama-midi-api` container → `127.0.0.1:3001`          |
| **PostgreSQL 15**          | `ama-midi-postgres` container (Docker internal only) |
| **Redis 7**                | `ama-midi-redis` container (Docker internal only)    |
| **TLS + reverse proxy**    | Host Nginx on VPS (ports 80/443)                     |
| **CI/CD**                  | GitHub Actions → GHCR → SSH deploy                   |


Everything runs on **one VPS**. Postgres is in Docker with a persistent volume — not exposed to the internet.

---

## Architecture

```txt
Internet
  │
  ▼ :443 / :80
┌──────────────────────────────────────────────────────────────┐
│  VPS                                                         │
│                                                              │
│  Host Nginx (TLS termination, WebSocket upgrade)             │
│    /                          → 127.0.0.1:8080  (web)        │
│    /auth, /songs, /users…     → 127.0.0.1:3001  (api)        │
│    /socket.io/                → 127.0.0.1:3001  (WebSocket)  │
│                                                              │
│  Docker network (ama-midi) — internal only                   │
│    ama-midi-api       NestJS     :3001  → 127.0.0.1 only     │
│    ama-midi-web       nginx      :80    → 127.0.0.1:8080     │
│    ama-midi-postgres  Postgres  :5432  → NOT on host        │
│    ama-midi-redis     Redis      :6379  → NOT on host        │
│                                                              │
│  Volumes: postgres_data, redis_data                          │
└──────────────────────────────────────────────────────────────┘
```

**Important:** Do not publish Postgres or Redis ports to the host. The API connects via Docker DNS (`postgres`, `redis`).

---

## Existing multi-app VPS (shared `default` nginx)

Use this path when the VPS already runs other apps (ohomi, task, etc.) behind `/etc/nginx/sites-enabled/default` with TLS on `hvy-dev.uk`.

### Port map (no conflicts with ohomi `:8888` or task `:9000`)

| Service | Docker bind | Nginx upstream |
|---|---|---|
| AMA-MIDI web | `127.0.0.1:8080` | `ama_midi_web` |
| AMA-MIDI API | `127.0.0.1:3001` | `ama_midi_api` |
| Redis | Docker internal only | — |
| PostgreSQL | External (your DB host) | — |

### 1. Append nginx block to `default`

Copy the snippet from `deploy/nginx/ama-midi.conf` into `/etc/nginx/sites-enabled/default` (after the existing `upstream` blocks, before or after the `task.hvy-dev.uk` server block):

```bash
# On VPS — paste deploy/nginx/ama-midi.conf contents into default, then:
sudo nginx -t && sudo systemctl reload nginx
```

No separate site file, no new certbot run — reuse `/etc/letsencrypt/live/hvy-dev.uk/` like `task.hvy-dev.uk`. Ensure DNS has an **A record** for `ama-midi.hvy-dev.uk` → VPS IP.

HTTP → HTTPS is already handled by your global `listen 80` redirect block.

### 2. App directory and env

```bash
sudo mkdir -p /opt/ama-midi
sudo chown -R $USER:$USER /opt/ama-midi
cd /opt/ama-midi

# Only need these files on the VPS (not the full monorepo):
#   docker-compose.prod.yml
#   .env.prod
```

```bash
cp .env.prod.example .env.prod   # or create manually
nano .env.prod
chmod 600 .env.prod
```

Production values for `ama-midi.hvy-dev.uk`:

```env
GITHUB_OWNER=3xhvy
IMAGE_TAG=latest
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://ama-midi.hvy-dev.uk

# External Postgres — use a host reachable FROM INSIDE the api container
# (often the VPS public/private IP, not localhost)
DATABASE_URL=postgresql://USER:PASS@DB_HOST:5432/DB_NAME?schema=public

REDIS_URL=redis://redis:6379
JWT_SECRET=<openssl rand -hex 32>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://ama-midi.hvy-dev.uk/auth/google/callback
ANTHROPIC_API_KEY=...   # optional
```

Google OAuth console:

| Setting | Value |
|---|---|
| Authorized JavaScript origins | `https://ama-midi.hvy-dev.uk` |
| Authorized redirect URIs | `https://ama-midi.hvy-dev.uk/auth/google/callback` |

GitHub Actions `APP_URL` variable: `https://ama-midi.hvy-dev.uk`

### 3. GHCR login and start containers

```bash
echo "ghp_YOUR_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

cd /opt/ama-midi
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
```

If Postgres is **external**, remove the `postgres` entry from `depends_on` in `docker-compose.prod.yml` (only `redis` is required). Migrations run automatically on API start (`prisma migrate deploy`).

### 4. Verify

```bash
curl -s http://127.0.0.1:3001/health          # API direct
curl -sI http://127.0.0.1:8080/               # web direct
curl -s https://ama-midi.hvy-dev.uk/health    # through nginx
```

Browser: login → song list → editor → WebSocket (`/socket.io`) → create note.

### 5. Deploy updates

Manual (same as GitHub Actions deploy step):

```bash
cd /opt/ama-midi
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Or push to `main` after configuring the `AMA-MIDI` GitHub environment (SSH key + `VM_*` vars).

### Checklist (existing nginx VPS)

```txt
[ ] DNS: ama-midi.hvy-dev.uk → VPS IP
[ ] /opt/ama-midi: docker-compose.prod.yml + .env.prod (chmod 600)
[ ] .env.prod: DATABASE_URL points to external Postgres (reachable from container)
[ ] default nginx: ama_midi_web + ama_midi_api upstreams + server block added
[ ] sudo nginx -t && reload
[ ] GHCR login on VPS
[ ] docker compose up -d → api healthy, web running
[ ] curl https://ama-midi.hvy-dev.uk/health
[ ] Google OAuth console updated
[ ] Browser smoke test passed
```

---

## Repository Files


| File                            | Purpose                                                         |
| ------------------------------- | --------------------------------------------------------------- |
| `apps/api/Dockerfile`           | Multi-stage API build; runs `prisma generate`, migrate on start |
| `apps/api/docker-entrypoint.sh` | `prisma migrate deploy` then `node dist/main`                   |
| `apps/web/Dockerfile`           | Multi-stage Vite build → nginx static server                    |
| `apps/web/nginx.conf`           | SPA `try_files` fallback inside web container                   |
| `docker-compose.prod.yml`       | Production compose (postgres + redis + api + web)               |
| `.env.prod.example`             | Template for VPS secrets                                        |
| `deploy/nginx/ama-midi.conf`    | Snippet to append to shared `/etc/nginx/sites-enabled/default` |
| `.github/workflows/deploy.yml`  | GHCR build + SSH deploy on `main` push                          |
| `.github/workflows/ci.yml`      | PR/main test + build                                            |


---

## Phase 1 — VPS base setup

### 1.1 Install Docker and Nginx

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

sudo apt install -y docker-compose-plugin ufw nginx certbot python3-certbot-nginx git
```

### 1.2 Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp        # or your custom SSH port (Owen uses 24700)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

Do **not** open 3001, 8080, 5432, or 6379 publicly.

### 1.3 Create app directory

```bash
sudo mkdir -p /opt/ama-midi
sudo chown -R $USER:$USER /opt/ama-midi
cd /opt/ama-midi
```

### 1.4 Copy runtime files to VPS

```bash
scp -P 22 docker-compose.prod.yml .env.prod.example user@YOUR_VPS:/opt/ama-midi/
scp -P 22 deploy/nginx/ama-midi.conf user@YOUR_VPS:/tmp/
```

On VPS:

```bash
cd /opt/ama-midi
cp .env.prod.example .env.prod
nano .env.prod          # fill in all secrets (see Phase 2)
chmod 600 .env.prod

# Option A — shared default file (ohomi/task VPS): append deploy/nginx/ama-midi.conf
#   into /etc/nginx/sites-enabled/default, then nginx -t && reload
# Option B — dedicated site file:
sudo cp /tmp/ama-midi.conf /etc/nginx/sites-available/ama-midi
sudo ln -sf /etc/nginx/sites-available/ama-midi /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 1.5 Login to GHCR on VPS

Create a GitHub fine-grained PAT with `read:packages` (expires monthly — same as Owen).

```bash
echo "ghp_YOUR_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

Or make GHCR packages **public** (Package settings → Change visibility).

---

## Phase 2 — Environment variables

Copy `.env.prod.example` → `.env.prod`. Required values:

```env
GITHUB_OWNER=3xhvy
IMAGE_TAG=latest

NODE_ENV=production
PORT=3001
FRONTEND_URL=https://YOUR_DOMAIN

# Postgres (Docker — must match DATABASE_URL credentials)
POSTGRES_DB=ama_midi
POSTGRES_USER=ama_midi
POSTGRES_PASSWORD=STRONG_PASSWORD_HERE

DATABASE_URL=postgresql://ama_midi:STRONG_PASSWORD_HERE@postgres:5432/ama_midi?schema=public

REDIS_URL=redis://redis:6379

JWT_SECRET=minimum_32_characters_random_string

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://YOUR_DOMAIN/auth/google/callback

ANTHROPIC_API_KEY=...   # optional
```

`POSTGRES_PASSWORD` in `.env.prod` must match the password in `DATABASE_URL`. The hostname is always `postgres` (Docker service name).

### Google OAuth console


| Setting                       | Value                                      |
| ----------------------------- | ------------------------------------------ |
| Authorized JavaScript origins | `https://YOUR_DOMAIN`                      |
| Authorized redirect URIs      | `https://YOUR_DOMAIN/auth/google/callback` |


---

## Phase 3 — GitHub Actions CI/CD

### 3.1 Enable GHCR permissions

Repository → Settings → Actions → General → Workflow permissions → **Read and write permissions**.

### 3.2 Create GitHub Environment: `AMA-MIDI`

**Secrets**

| Name | Description |
| --- | --- |
| `VM_SSH_KEY` | Private SSH key for deploy user (ed25519) |
| `TELEGRAM_BOT_TOKEN` | Bot token for deploy notifications (same as Owen) |
| `TELEGRAM_CHAT_ID` | Chat ID for deploy notifications |


**Variables**


| Name          | Example                       | Description                             |
| ------------- | ----------------------------- | --------------------------------------- |
| `VM_HOST`     | `203.0.113.10`                | VPS IP or hostname                      |
| `VM_USERNAME` | `deploy`                      | SSH user                                |
| `VM_SSH_PORT` | `22` or `24700`               | SSH port                                |
| `APP_URL`     | `https://ama-midi.hvy-dev.uk` | Used as `VITE_WS_URL` at web build time |


### 3.3 Generate deploy SSH key

```bash
ssh-keygen -t ed25519 -C "github-actions-ama-midi" -f ~/.ssh/ama-midi-deploy
cat ~/.ssh/ama-midi-deploy.pub >> ~/.ssh/authorized_keys   # on VPS
# GitHub secret VM_SSH_KEY = private key content
```

### 3.4 Workflow behavior

Workflow file: `.github/workflows/deploy.yml` — **Deploy to VM** (same pattern as Owen).

On every push to `main`:

1. **build-and-push** — builds `ama-midi-api` + `ama-midi-web`, pushes to GHCR, Telegram notify on start/result
2. **deploy** — SSH to `/opt/ama-midi`, `docker compose pull && up -d`, poll `ama-midi-api` health (180s), Telegram notify on start/result

Manual trigger: Actions → **Deploy to VM** → Run workflow.

---

## Phase 4 — First deployment

### 4.1 Start the stack

```bash
cd /opt/ama-midi
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
```

Startup order: `postgres` (healthy) → `redis` (healthy) → `api` (runs migrations) → `web`.

The API entrypoint runs `prisma migrate deploy` automatically on every start.

### 4.2 Verify

```bash
# On VPS
curl -s http://127.0.0.1:3001/health
curl -sI http://127.0.0.1:8080/

# Postgres reachable from api container only
docker compose -f docker-compose.prod.yml exec postgres \
  pg_isready -U ama_midi -d ama_midi

# Through nginx (after DNS points here)
curl -s https://YOUR_DOMAIN/health
```

Browser checks:

- Google OAuth login completes
- Song list loads
- Editor opens
- WebSocket connects (DevTools → Network → WS → `/socket.io`)
- Note create/delete works
- Real-time sync in two tabs

---

## Phase 5 — SSL (Let's Encrypt)

```bash
sudo certbot --nginx -d YOUR_DOMAIN
sudo certbot renew --dry-run
```

After SSL, confirm `.env.prod` uses `https://`:

```env
FRONTEND_URL=https://YOUR_DOMAIN
GOOGLE_CALLBACK_URL=https://YOUR_DOMAIN/auth/google/callback
```

Restart API:

```bash
docker compose -f docker-compose.prod.yml restart api
```

---

## Port reference


| Location        | Port          | Exposed to                                   |
| --------------- | ------------- | -------------------------------------------- |
| VPS public      | 22 (or 24700) | Your IP (SSH)                                |
| VPS public      | 80, 443       | Internet                                     |
| VPS localhost   | 3001          | Host nginx only                              |
| VPS localhost   | 8080          | Host nginx only                              |
| Docker internal | 5432          | api container only (via `postgres` hostname) |
| Docker internal | 6379          | api container only (via `redis` hostname)    |


---

## Nginx routing reference

Host nginx (`deploy/nginx/ama-midi.conf`) routes:


| Path           | Upstream    | Notes                      |
| -------------- | ----------- | -------------------------- |
| `/`            | web `:8080` | React SPA                  |
| `/auth/*`      | api `:3001` | OAuth + JWT                |
| `/songs/*`     | api `:3001` | Song/note CRUD             |
| `/users/*`     | api `:3001` | User profile               |
| `/patterns/*`  | api `:3001` | Note patterns              |
| `/health`      | api `:3001` | Health check               |
| `/projects/*`  | api `:3001` | Future project routes      |
| `/socket.io/*` | api `:3001` | WebSocket upgrade required |


---

## Local vs production compose


| Command                                        | Use case                                         |
| ---------------------------------------------- | ------------------------------------------------ |
| `docker compose up`                            | Local dev (same stack, dev passwords in compose) |
| `docker compose -f docker-compose.prod.yml up` | Production on VPS (GHCR images + `.env.prod`)    |


---

## Database backup

Postgres data lives in the `postgres_data` Docker volume. Back up with `pg_dump` via the container:

```bash
mkdir -p /opt/backups/ama-midi

docker compose -f /opt/ama-midi/docker-compose.prod.yml exec -T postgres \
  pg_dump -U ama_midi ama_midi > /opt/backups/ama-midi/db_$(date +%Y%m%d).sql
```

Cron example (daily at 2am):

```cron
0 2 * * * docker compose -f /opt/ama-midi/docker-compose.prod.yml exec -T postgres pg_dump -U ama_midi ama_midi > /opt/backups/ama-midi/db_$(date +\%Y\%m\%d).sql
```

Restore:

```bash
cat backup.sql | docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U ama_midi -d ama_midi
```

---

## Rollback

```bash
cd /opt/ama-midi

IMAGE_TAG=abc1234 docker compose -f docker-compose.prod.yml pull
IMAGE_TAG=abc1234 docker compose -f docker-compose.prod.yml up -d
```

Or re-run a previous successful GitHub Actions workflow.

**Note:** Rolling back app images does not roll back database migrations. Test migrations in staging before deploying breaking schema changes.

---

## Troubleshooting

### API container unhealthy

```bash
docker compose -f docker-compose.prod.yml logs api
docker compose -f docker-compose.prod.yml logs postgres
# Common causes:
# - POSTGRES_PASSWORD / DATABASE_URL mismatch
# - postgres container not healthy yet (wait or check logs)
# - JWT_SECRET missing or too short
# - Prisma migration failure (P1001 connection, P3009 failed migration)
```

### Postgres not starting

```bash
docker compose -f docker-compose.prod.yml logs postgres
# Check POSTGRES_PASSWORD is set in .env.prod
# If volume is corrupted, backup first then:
# docker compose -f docker-compose.prod.yml down
# docker volume rm ama-midi_postgres_data   # destructive — only if no data to keep
```

### 502 Bad Gateway from nginx

```bash
docker compose -f docker-compose.prod.yml ps
curl http://127.0.0.1:3001/health
curl http://127.0.0.1:8080/
sudo tail -f /var/log/nginx/ama-midi-error.log
```

### WebSocket not connecting

- Confirm nginx `/socket.io/` block has `Upgrade` and `Connection` headers
- Confirm `APP_URL` GitHub variable matches your HTTPS domain
- Check browser DevTools for mixed-content errors (`wss://` required on HTTPS pages)

### GHCR pull denied

```bash
docker login ghcr.io
# Or make packages public in GitHub Package settings
```

---

## Security checklist

- `.env.prod` is `chmod 600` and never committed
- Postgres and Redis **not** published to host (no `ports:` on those services)
- VPS does not expose 3001/8080/5432/6379 publicly
- UFW allows only 22, 80, 443
- SSH key-only auth (disable password login)
- `POSTGRES_PASSWORD` and `JWT_SECRET` are strong random values
- HTTPS enabled with valid cert
- Google OAuth redirect URIs match production domain exactly
- Daily `pg_dump` backups configured

---

## Maintenance

```bash
# Logs
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f postgres

# Restart one service
docker compose -f docker-compose.prod.yml restart api

# Update after push to main (automatic via Actions, or manual):
cd /opt/ama-midi
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

---

## One-hit deployment checklist

```txt
[ ] VPS: Docker + nginx + ufw configured (22, 80, 443 only)
[ ] VPS: /opt/ama-midi with docker-compose.prod.yml + .env.prod
[ ] .env.prod: POSTGRES_PASSWORD matches DATABASE_URL, JWT_SECRET set
[ ] VPS: GHCR login working
[ ] VPS: host nginx site enabled, domain in server_name
[ ] DNS A record → VPS IP
[ ] Google OAuth console updated for production domain
[ ] GitHub Environment AMA-MIDI: VM_SSH_KEY + VM_* vars + APP_URL
[ ] GHCR packages visible (public or PAT on VPS)
[ ] certbot SSL installed
[ ] docker compose up -d → all 4 containers healthy
[ ] Push to main → Actions green → curl https://YOUR_DOMAIN/health
[ ] Browser: login, editor, WebSocket, note CRUD verified
[ ] pg_dump backup cron configured
```

---

## Comparison with Owen backend


| Aspect      | Owen                  | AMA-MIDI                                            |
| ----------- | --------------------- | --------------------------------------------------- |
| Images      | 1 (`owen-backend`)    | 2 (`ama-midi-api`, `ama-midi-web`)                  |
| Database    | External MySQL (RDBS) | PostgreSQL in Docker on same VPS                    |
| Nginx       | Host nginx → `:8888`  | Host nginx → `:8080` + `:3001`                      |
| WebSocket   | No                    | Yes — `/socket.io/` proxy block                     |
| Migrations  | On app startup        | `docker-entrypoint.sh` runs `prisma migrate deploy` |
| SSH port    | 24700                 | Configurable via `VM_SSH_PORT`                      |
| Deploy path | `/opt/owen-backend`   | `/opt/ama-midi`                                     |


