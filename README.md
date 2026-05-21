# AMA-MIDI

Real-time collaborative MIDI sequencer for Amanotes — piano roll editor, WebSocket collaboration, event-sourced ledger, AI note suggestions.

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose

### Local Development

```bash
# 1. Install
git clone <repo> && cd ama-midi
pnpm install

# 2. Configure
cp .env.example .env
# Edit .env with your Google OAuth and Anthropic credentials

# 3. Run apps (with local Postgres + Redis)
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001

### Full Docker Stack (CI / grading)

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
│   └── shared/       # Shared TypeScript types + constants
├── docker-compose.yml
└── turbo.json
```

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | React 18, TypeScript, TailwindCSS, TanStack Query, Zustand, Socket.io-client |
| Backend | NestJS, PostgreSQL, Prisma, Redis, Socket.io |
| AI | Anthropic Claude API |
| Infra | Docker, Turborepo, pnpm, GitHub Actions, Railway, Vercel |
