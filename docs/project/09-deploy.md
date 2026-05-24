# Deploy Pipeline

← [README](../../README.md) · [← Project Structure](./08-project-structure.md) · [Retrospective →](./10-retrospective.md)

---

## Topology Overview

AMA-MIDI runs entirely on a single VPS alongside other projects (`ohomi`, `task`). Everything is containerized. PostgreSQL and Redis never expose ports to the internet.

```
Internet
  │
  ▼ :443 / :80
┌──────────────────────────────────────────────────────┐
│  VPS (hvy-dev.uk)                                    │
│                                                      │
│  Host Nginx — TLS termination + WebSocket upgrade    │
│    ama-midi.hvy-dev.uk /      → 127.0.0.1:8080 (web) │
│    ama-midi.hvy-dev.uk /api   → 127.0.0.1:3001 (api) │
│    ama-midi.hvy-dev.uk /ws    → 127.0.0.1:3001 (WS)  │
│                                                      │
│  Docker network: ama-midi (internal only)            │
│    ama-midi-web       Nginx SPA    → 127.0.0.1:8080  │
│    ama-midi-api       NestJS       → 127.0.0.1:3001  │
│    ama-midi-postgres  PostgreSQL   → NOT on host     │
│    ama-midi-redis     Redis        → NOT on host     │
│                                                      │
│  Persistent volumes: postgres_data, redis_data       │
└──────────────────────────────────────────────────────┘
```

**Why single VPS:** The VPS already runs other projects under the same Nginx and TLS wildcard (`hvy-dev.uk`). Adding AMA-MIDI reuses existing infrastructure and TLS certificates rather than provisioning new managed services.

**Why PostgreSQL in Docker, not managed:** Cost and simplicity at this scale. A persistent named volume (`postgres_data`) survives container restarts. Backups are a `pg_dump` cron job on the host. If the project grows, migrating to a managed instance is a connection-string change.

---

## Docker Compose Services

Four services in one network. No cross-internet traffic between them.

```
services:
  postgres    — PostgreSQL 15, port 5432 (internal only)
  redis       — Redis 7 Alpine, port 6379 (internal only)
  api         — NestJS, binds to 127.0.0.1:3001
  web         — Nginx serving React SPA, binds to 127.0.0.1:8080
```

The `api` container connects to `postgres` and `redis` via Docker DNS (hostnames `postgres` and `redis`). No ports are published to `0.0.0.0`.

**Multi-stage Dockerfiles:**
- `api`: `node:20-alpine` build stage compiles TypeScript → `node:20-alpine` runtime stage copies dist only. No devDependencies in production image.
- `web`: `node:20-alpine` build stage runs `vite build` → `nginx:alpine` runtime stage serves static files. Final image is ~20MB.

---

## Nginx Configuration

The VPS already has a `default` Nginx site serving other apps. AMA-MIDI appends upstream blocks and a server block to the same file — no new site file, no new `certbot` run.

```nginx
upstream ama_midi_web {
    server 127.0.0.1:8080;
}

upstream ama_midi_api {
    server 127.0.0.1:3001;
}

server {
    listen 443 ssl;
    server_name ama-midi.hvy-dev.uk;

    # TLS — reuse existing wildcard cert
    ssl_certificate     /etc/letsencrypt/live/hvy-dev.uk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hvy-dev.uk/privkey.pem;

    # API routes
    location ~ ^/(auth|songs|notes|users|ai|health) {
        proxy_pass http://ama_midi_api;
    }

    # WebSocket upgrade
    location /socket.io/ {
        proxy_pass http://ama_midi_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # SPA — all other paths go to the React app
    location / {
        proxy_pass http://ama_midi_web;
    }
}
```

HTTP → HTTPS redirect is handled by the existing global `listen 80` block already on the VPS.

---

## GitHub Actions CI/CD Pipeline

Push to `main` triggers the full pipeline. No manual deploy steps after first-time VPS setup.

### Pipeline: `.github/workflows/deploy.yml`

```
Push to main
    │
    ▼
[Job: ci]
  ├─ pnpm install
  ├─ pnpm lint (all workspaces)
  ├─ pnpm test (api unit + integration tests)
  └─ pnpm build (type-check all)
    │
    ▼ (only if ci passes)
[Job: build-and-push]
  ├─ docker buildx build apps/api → ghcr.io/<owner>/ama-midi-api:latest
  ├─ docker buildx build apps/web → ghcr.io/<owner>/ama-midi-web:latest
  └─ docker push both images to GHCR
    │
    ▼ (only if build passes)
[Job: deploy]
  ├─ SSH into VPS using deploy key (GitHub Secret: VPS_SSH_KEY)
  ├─ cd /opt/ama-midi
  ├─ echo $GHCR_TOKEN | docker login ghcr.io
  ├─ docker compose -f docker-compose.prod.yml pull
  ├─ docker compose -f docker-compose.prod.yml up -d --remove-orphans
  └─ docker image prune -f
```

### Secrets Required (GitHub repository settings)

| Secret | Value |
|---|---|
| `VPS_HOST` | VPS IP address |
| `VPS_USER` | Deploy user (e.g., `deploy`) |
| `VPS_SSH_KEY` | Private key for the deploy user |
| `GHCR_TOKEN` | GitHub personal access token with `read:packages` |

### Environment Variables on VPS

Sensitive values live in `/opt/ama-midi/.env.prod` (permissions `600`). The `docker-compose.prod.yml` loads them via `env_file`. They are never in the repository.

```
DATABASE_URL=postgresql://postgres:<pass>@postgres:5432/ama_midi
REDIS_URL=redis://redis:6379
JWT_SECRET=<min 32 chars, generated with openssl rand -hex 32>
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
GOOGLE_CALLBACK_URL=https://ama-midi.hvy-dev.uk/auth/google/callback
AI_PROVIDER=anthropic                        # anthropic | openai | deepseek
ANTHROPIC_API_KEY=<from Anthropic console>   # required if AI_PROVIDER=anthropic
OPENAI_API_KEY=<from OpenAI console>         # required if AI_PROVIDER=openai
DEEPSEEK_API_KEY=<from DeepSeek console>     # required if AI_PROVIDER=deepseek
FRONTEND_URL=https://ama-midi.hvy-dev.uk
```

---

## Rollback

If a deploy produces a broken build, rollback is a re-tag and re-deploy:

```bash
# On VPS — pull a specific previous image tag and restart
docker compose -f docker-compose.prod.yml stop api
docker pull ghcr.io/<owner>/ama-midi-api:<previous-sha>
# update docker-compose.prod.yml image tag to previous-sha
docker compose -f docker-compose.prod.yml up -d api
```

Zero-downtime is not guaranteed on the current single-VPS setup — there's a brief gap during container restart. For the current scale this is acceptable. A load balancer with blue/green containers would be the upgrade path.

---

## First-Time VPS Setup (One-Time Steps)

1. Create `/opt/ama-midi` directory, set ownership to deploy user.
2. Copy `docker-compose.prod.yml` and `.env.prod` to `/opt/ama-midi`.
3. Add GHCR credentials to `~/.docker/config.json` on the VPS.
4. Add AMA-MIDI Nginx blocks to `/etc/nginx/sites-enabled/default`.
5. Add DNS A record: `ama-midi.hvy-dev.uk` → VPS IP.
6. `sudo nginx -t && sudo systemctl reload nginx`.
7. First deploy: run the GitHub Actions workflow manually from the Actions tab.

After this, every push to `main` deploys automatically.

---

*→ Next: [Retrospective](./10-retrospective.md)*
