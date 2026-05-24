# Project Structure

← [README](../../README.md) · [← Trade-offs](./07-trade-offs.md) · [Deploy Pipeline →](./09-deploy.md)

---

## Repository Layout

```
ama-midi/                          ← Turborepo monorepo root
├── apps/
│   ├── web/                       ← React 18 + Vite + TypeScript (Vercel / Docker)
│   │   └── src/
│   │       ├── features/          ← Domain-scoped feature modules
│   │       │   ├── auth/          ← Login, callback, route guards
│   │       │   ├── songs/         ← Song list, project cards, quick-create
│   │       │   ├── editor/        ← Piano roll, transport, panels, AI assistant
│   │       │   │   └── components/
│   │       │   │       ├── PianoRoll/        ← Grid + note virtualization
│   │       │   │       ├── TransportBar/     ← Zoom, mode toggle, playback controls
│   │       │   │       ├── HistoryPanel/     ← Ledger event sidebar
│   │       │   │       ├── MultiSelectBar/   ← Bulk note operations
│   │       │   │       └── ai-assistant/     ← Ghost overlay + suggestion flows
│   │       │   ├── analysis/      ← StatCards, FactorBreakdown, WarningsTable
│   │       │   ├── collaboration/ ← SessionPresenceMenu (who's in this song)
│   │       │   ├── projects/      ← ProjectDashboardPage, ProjectCard
│   │       │   ├── charts/        ← ChartSwitcher
│   │       │   └── onboarding/    ← TourOverlay, product tour flow
│   │       ├── hooks/             ← Cross-feature React hooks
│   │       │   ├── useSocket.ts   ← Socket.io connection lifecycle
│   │       │   ├── useNotes.ts    ← TanStack Query + WS event merge
│   │       │   └── useUndo.ts     ← Compensating event trigger
│   │       ├── store/             ← Zustand atoms (zoom, editor mode, presence)
│   │       ├── pages/             ← Route-level components
│   │       │   ├── EditorPage.tsx
│   │       │   ├── LoginPage.tsx
│   │       │   └── AuthCallbackPage.tsx
│   │       └── styles/
│   │           └── globals.css    ← Design tokens, Tailwind base
│   │
│   └── api/                       ← NestJS + TypeScript (Railway / Docker)
│       └── src/
│           └── modules/
│               ├── auth/          ← Google OAuth (Passport), JWT guards, CSRF
│               ├── users/         ← User profile, role assignment
│               ├── songs/         ← Song CRUD, ownership
│               ├── notes/         ← Note commands (create/update/delete)
│               │   ├── note.service.ts        ← Writes + conflict handling
│               │   └── note.query.service.ts  ← Reads + viewport windowing
│               ├── ledger/        ← NoteEvent writes, history queries, undo
│               ├── realtime/      ← Socket.io gateway + Redis Pub/Sub adapter
│               └── ai/            ← Multi-provider AI (Anthropic / OpenAI / DeepSeek), suggestion endpoint
│                   └── __tests__/
│                       └── chart-context.prompt.spec.ts
│
├── packages/
│   └── shared/                    ← Zero-dep shared TypeScript library
│       └── src/
│           ├── types.ts           ← Note, Song, NoteEvent, AuthUser, NoteSuggestion
│           ├── colors.ts          ← LAYER_COLORS, NOTE_PRESET_COLORS, STATUS_COLORS
│           └── constants.ts       ← TRACK_MIN/MAX (1-8), TIME_MIN/MAX (0-300s), SNAP_RESOLUTION
│
├── docs/
│   ├── project/                   ← This document set (you are here)
│   ├── superpowers/               ← Architecture specs, plans, design docs
│   └── DEPLOYMENT_PLAN.md        ← Full VPS + CI/CD deployment guide
│
├── deploy/
│   └── nginx/
│       └── ama-midi.conf          ← Nginx upstream + server block for VPS
│
├── docker-compose.yml             ← Local dev: postgres + redis + api + web
├── docker-compose.prod.yml        ← Production: same services, prod env
├── turbo.json                     ← Turborepo pipeline config
├── pnpm-workspace.yaml            ← pnpm monorepo workspaces
└── .github/
    └── workflows/
        └── deploy.yml             ← GitHub Actions CI/CD pipeline
```

---

## Key Structural Decisions

**`features/` over `components/`:** Each domain owns its components, hooks, and types. Cross-feature code goes in `hooks/` or `store/`. Nothing in `editor/` reaches into `songs/` internals.

**`note.service.ts` + `note.query.service.ts` split:** Writes care about integrity (transactions, constraints, events). Reads care about performance (time-window pagination, track summaries). Mixing them in one file conflates optimization targets. Both share `PrismaService` — no separate database.

**`packages/shared` as a true zero-dep library:** No runtime dependencies. Just TypeScript types, constants, and pure functions. Importable in both NestJS (Node.js) and React (browser) without bundler complications.

**`deploy/nginx/` checked into the repo:** The Nginx configuration for the VPS lives in version control. Changes to routing or upstream config go through the same PR process as code changes.

---

*→ Next: [Deploy Pipeline](./09-deploy.md)*
