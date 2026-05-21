# AMA-MIDI — Project Proposal
### Enterprise MIDI Sequencing & Collaboration Suite for Amanotes

---

## 1. Problem Statement

Amanotes builds music-based games where timing, rhythm, and note placement are core to player experience. Today, composers and game developers prototype MIDI sequences using disconnected tools or raw data files — neither of which allows teams to collaborate, review visually, or catch timing errors before game integration.

The real problem is not missing software. It is missing shared context. When a composer places a note at Track 3, Time 42.5s, no one else on the team can see it, review it, or react to it in real time. The result is slow iteration cycles, timing conflicts discovered late, and no audit trail when something goes wrong.

AMA-MIDI solves this by giving cross-functional teams — composers, game developers, product owners, QA — a single shared workspace where note sequences are visual, collaborative, and safe.

---

## 2. Target Users

| User | Core Need | Key Pain Today |
|---|---|---|
| Composer / Sound Designer | Place and adjust notes quickly with visual timing feedback | Working blind in disconnected tools |
| Game Developer | Verify timing alignment before game integration | Discovering conflicts late in the cycle |
| Product Owner / Game Producer | Review song structure and give feedback | Cannot review without music software expertise |
| QA / Game Tester | Catch boundary violations, duplicates, and track errors | No systematic validation tool |

---

## 3. Product Vision

> AMA-MIDI is a shared visual board for music sequences. Open a song, see all notes on a timeline, place or edit notes in real time, and collaborate with your team — without corrupting shared data.

The system must be good at three things above everything else:

**Visual clarity** — a 300-second song with 10,000 notes must be scannable, not frozen.

**Data integrity** — no two notes can exist at the same (track, time) position, even under concurrent writes.

**Real-time sync** — when one composer changes a note, every other composer in the same song sees it within milliseconds.

---

## 4. Core Features (MVP Scope)

### 4.1 Song Management
- Create, rename, and delete songs
- List songs with metadata (name, last modified, active collaborators)
- Open a song into the MIDI editor

### 4.2 Piano Roll Editor
- Vertical timeline: 0s at top → 300s at bottom
- Horizontal axis: 8 tracks (columns)
- Notes rendered as colored circular points at precise (track, time) coordinates
- **Two interaction modes:**
  - **Fast mode (default):** click the grid to instantly create a note at that position. Snap-to-grid at 0.1s resolution. Use keyboard shortcuts (E to open edit popup, Delete/Backspace to remove selected note)
  - **Popup mode (toggleable):** clicking opens a form popup to fill in all 5 note properties before saving
- Note properties: Title, Description, Track (1–8), Time (0–300s, 0.1s resolution), Color
- Select, edit, and delete notes
- Visual snap-to-grid lines every 1s with major markers every 10s
- Viewport zoom: 1x (full 300s visible), 2x, 4x for detailed editing

### 4.3 Sequence Integrity
- Database-level unique constraint on `(song_id, track, time)` — no duplicate positions ever
- When a conflict occurs (position already taken), the UI shows a toast with the conflicting user's name and the note disappears gracefully
- Boundary validation: time must be 0–300s, track must be 1–8

### 4.4 Real-time Collaboration
- WebSocket room per song (Socket.io)
- Presence indicator: avatars of who is currently in the same song
- When any user adds, updates, or deletes a note, all collaborators see it instantly without refreshing
- Redis Pub/Sub between API instances ensures broadcast works at scale

### 4.5 Change History (Ledger)
- Every note mutation is stored as an event in a `note_events` table, not just the final state
- Event types: `NOTE_CREATED`, `NOTE_UPDATED`, `NOTE_DELETED`
- Each event stores: event type, note_id, song_id, user_id, timestamp, before_state, after_state
- History panel: users can open a sidebar showing all events for the current song in reverse chronological order
- Undo: emit a compensating event that reverts the last action by the current user

### 4.6 Performance (10,000+ Notes)
- Virtualized rendering: only notes within the current viewport are mounted as DOM elements
- As the user scrolls, notes outside the visible window are unmounted
- Canvas fallback considered if DOM virtualization is not sufficient at 10,000 nodes
- Notes are fetched in time-bounded chunks from the API (e.g., load notes for the visible time window, prefetch adjacent windows)

### 4.7 AI Note Suggester
- After a composer has placed at least 5 notes, a "Suggest next notes" button appears
- Sends the last 10 notes (track, time, color) as context to the Claude API
- Receives 3–5 suggested next notes following the rhythmic pattern
- Suggestions appear as ghost/translucent notes on the grid
- Composer can accept (solidifies the note) or dismiss each suggestion individually

### 4.8 Auth & Security
- JWT-based authentication
- SSO via Google OAuth (OIDC) as the enterprise auth requirement
- Rate limiting on all API endpoints (express-rate-limit or NestJS Throttler)
- CSRF protection via double-submit cookie pattern
- Role-based: Admin can manage songs and users, Composer can create/edit notes, Viewer can only read

---

## 5. Out of Scope for MVP

These are documented as future improvements, not cut as unimportant:

- Real audio playback
- MIDI file import/export
- Comments on individual notes
- Multi-version branching (Git-style — explored in design but too complex for 3 days)
- Advanced permission system per song
- Mobile-responsive editor (complex touch interaction for a grid-based tool)
- Waveform rendering
- AI melody generation from scratch

---

## 6. Technical Architecture

### 6.1 Architecture Choice: Modular Monolith

A microservices architecture would look over-engineered for a 3-day build and would add operational complexity without benefit at this scale. A modular monolith keeps clear module boundaries while being fast to build, test, and deploy as a single unit.

### 6.2 Repository Structure

```
ama-midi/
├── apps/
│   ├── web/          # React 18 + TypeScript frontend
│   └── api/          # NestJS + TypeScript backend
├── packages/
│   └── shared/       # Shared TypeScript types (Note, Song, NoteEvent...)
├── docker-compose.yml
├── .github/
│   └── workflows/    # CI/CD pipeline
└── README.md
```

### 6.3 Frontend Stack

| Choice | Reason |
|---|---|
| React 18 + TypeScript | Required by case study; concurrent rendering helps with real-time updates |
| TanStack Query (React Query) | Server state management, caching, background refetch |
| Zustand | Lightweight client state (editor mode, selected note, presence) |
| TailwindCSS | Fast dark-mode studio UI without fighting CSS specificity |
| Socket.io-client | Real-time WebSocket communication |
| @tanstack/virtual | Virtualized rendering for 10,000+ notes |
| Vite | Fast dev server and optimized production builds |

### 6.4 Backend Stack

| Choice | Reason |
|---|---|
| NestJS + TypeScript | Modular structure maps cleanly to domain modules |
| PostgreSQL | ACID transactions, unique constraints, jsonb for before/after state in ledger |
| Prisma | Type-safe DB access, readable migrations, good TypeScript integration |
| Redis | Pub/Sub for broadcasting WebSocket events across API instances |
| Socket.io | WebSocket rooms per song, built-in Redis adapter |
| Passport.js + Google OAuth | OIDC/SSO auth requirement |
| @nestjs/throttler | Rate limiting |

### 6.5 Infrastructure

| Component | Tool |
|---|---|
| Containerization | Docker + docker-compose (postgres, redis, api, web) |
| CI/CD | GitHub Actions (lint → test → build → deploy) |
| Hosting | Railway (API + DB + Redis) + Vercel (frontend) |
| Error tracking | Sentry |

### 6.6 Database Schema (Core Tables)

```sql
-- Songs
songs (id, name, created_by, created_at, updated_at)

-- Notes (current state)
notes (
  id, song_id, track, time, title, description, color,
  created_by, created_at, updated_at,
  UNIQUE (song_id, track, time)   -- core integrity constraint
)

-- Note events (ledger / change history)
note_events (
  id, song_id, note_id, event_type,
  user_id, timestamp,
  before_state JSONB,
  after_state  JSONB
)

-- Users
users (id, email, name, avatar_url, role, created_at)
```

### 6.7 Key Engineering Decisions and Trade-offs

**Snap resolution: 0.1s**
Finer than 0.1s (e.g. milliseconds) would make the unique constraint harder to enforce perceptually — two notes at 5.001s and 5.002s would appear identical on screen but be different records. 0.1s is precise enough for game soundtrack prototyping and enforces clean constraints.

**Event sourcing for the ledger, not Git branching**
A Git-style branching model requires local clones. In a live collaborative editor, everyone is on the same document simultaneously — there is nothing to clone. Instead, every mutation is recorded as an immutable event. The current note state is the latest snapshot. Undo emits a compensating event. This is the pattern the case study's "Ledger Logic" requirement is pointing at.

**DOM virtualization before Canvas**
Canvas gives better performance at extreme note counts but makes note interaction (click, hover, select) much harder to implement correctly. Starting with DOM virtualization via @tanstack/virtual handles 10,000 notes acceptably and keeps the interaction model simple. If profiling shows canvas is necessary, that becomes a follow-up.

**Optimistic UI for note creation**
In fast mode, the note appears on the grid immediately on click. The API call happens in the background. If the server returns a conflict error, the note is removed and a toast explains why. This makes the editor feel instant even on slow connections.

---

## 7. Module Breakdown

### Backend Modules (NestJS)

```
AuthModule       — Google OAuth, JWT, session
UserModule       — User profile, roles
SongModule       — Song CRUD, song listing
NoteModule       — Note CRUD, unique constraint handling, pagination
LedgerModule     — NoteEvent creation, history query, undo logic
RealtimeModule   — Socket.io gateway, room management, Redis Pub/Sub
AiModule         — Note suggester endpoint (calls Claude API)
```

### Frontend Modules

```
pages/
  SongListPage     — list and create songs
  EditorPage       — the main MIDI editor

components/
  PianoRoll/       — grid, note rendering, virtualization
  NotePopup/       — create/edit form
  PresenceBar/     — active collaborators in current song
  HistoryPanel/    — ledger/event sidebar
  AiSuggester/     — ghost note overlay + accept/dismiss

hooks/
  useNotes         — TanStack Query + WebSocket merge
  useSocket        — Socket.io connection management
  useUndo          — compensating event trigger
```

---

## 8. Real-time Flow (Detailed)

```
Composer A clicks grid at Track 2, Time 15.0s
  → Optimistic: note appears immediately on A's grid
  → POST /songs/:id/notes { track: 2, time: 15.0 }
  → API: INSERT INTO notes ... ON CONFLICT (song_id, track, time) DO NOTHING
    → Success: note saved, event written to note_events
    → API emits NOTE_CREATED to Redis channel for song_123
    → Redis broadcasts to all API instances
    → All Socket.io rooms for song_123 receive NOTE_CREATED
    → Composer B's grid receives the event and renders the new note
    → Conflict: API returns 409, A's optimistic note is removed, toast shown
```

---

## 9. AI Note Suggester (Detailed)

```
Trigger: user clicks "Suggest" after placing 5+ notes

Request to Claude API:
  system: "You are a MIDI note pattern assistant. Return only valid JSON."
  user: "Here are notes placed so far: [{track:2,time:1.0},{track:4,time:2.0},
         {track:2,time:3.0},{track:5,time:4.0},{track:2,time:5.0}].
         Suggest 4 next notes that continue this rhythmic pattern.
         Return JSON array: [{track, time, color}]"

Response: [{track:4,time:6.0,color:"#A78BFA"}, ...]

UI: suggested notes render as ghost circles (50% opacity, dashed border)
    Accept button per note → solidifies it → POST /notes
    Dismiss button per note → removes ghost
```

---

## 10. Performance Testing Plan

This directly addresses the grading requirement for a "step-by-step testing plan."

**Step 1 — Seed data**
Write a script that inserts 10,000 notes across 8 tracks and 300 seconds for a single song.

**Step 2 — Frontend rendering benchmark**
Open the editor with 10,000 notes. Record:
- Time from page load to first visible note (Chrome DevTools Performance tab)
- Scroll FPS (should stay above 50fps)
- Memory usage before and after opening (should not grow unbounded on scroll)

**Step 3 — Virtualization verification**
Open DevTools → Elements. Count mounted note DOM nodes while viewing the top of the song. Scroll to the middle. Count again. The number should stay approximately the same (only viewport notes mounted), not grow to 10,000.

**Step 4 — API load test with k6**
```javascript
// k6 script: 100 concurrent note creations
import http from 'k6/http';
export default function () {
  http.post('https://api.ama-midi.com/songs/1/notes', JSON.stringify({
    track: Math.ceil(Math.random() * 8),
    time: (Math.random() * 300).toFixed(1),
    title: 'Load test note',
    color: '#6366F1'
  }), { headers: { 'Content-Type': 'application/json' } });
}
// k6 run --vus 100 --duration 30s script.js
```
Expected: p95 response time < 200ms. Conflict responses (409) handled gracefully.

**Step 5 — Concurrent conflict test**
Send two identical POST requests to the same `(song_id, track, time)` simultaneously. Only one should succeed. Database unique constraint + atomic transaction ensures no duplicate is written.

---

## 11. 3-Day Milestone Plan

### Day 1 — Foundation + Core Editor

**Goal:** A working editor where one user can create, view, and delete notes.

Morning:
- [ ] Monorepo setup (apps/web, apps/api, packages/shared)
- [ ] Docker-compose: PostgreSQL + Redis + API + Web
- [ ] Prisma schema: songs, notes, users, note_events
- [ ] NestJS: AuthModule (Google OAuth + JWT), SongModule (CRUD), NoteModule (CRUD with unique constraint)

Afternoon:
- [ ] React app scaffold with TailwindCSS dark mode
- [ ] SongListPage: create and open songs
- [ ] PianoRoll grid: vertical 0–300s timeline, 8 track columns, snap-to-grid at 0.1s
- [ ] Fast mode note creation (click → instant note → POST API)
- [ ] Note rendering as colored circles

Evening:
- [ ] Note delete (select + Backspace)
- [ ] NotePopup mode (toggle, form with 5 fields)
- [ ] Boundary validation (track 1–8, time 0–300s)
- [ ] Basic unit tests: unique constraint, boundary validation

**Day 1 Done = one user can compose a song.**

---

### Day 2 — Collaboration + Ledger + Auth

**Goal:** Multiple users can edit the same song simultaneously. Every change is recorded.

Morning:
- [ ] Socket.io gateway (NestJS) with Redis Pub/Sub adapter
- [ ] Socket.io-client in React (useSocket hook)
- [ ] Real-time note broadcast: NOTE_CREATED, NOTE_UPDATED, NOTE_DELETED
- [ ] Presence indicator (who else is in this song)
- [ ] Conflict handling: optimistic UI rollback + toast

Afternoon:
- [ ] LedgerModule: write note_events on every mutation
- [ ] HistoryPanel UI: sidebar showing event log for current song
- [ ] Undo: compensating event for last current-user action
- [ ] Google OAuth SSO integration (Passport.js)
- [ ] Role-based guards (Admin, Composer, Viewer)

Evening:
- [ ] Rate limiting (@nestjs/throttler)
- [ ] CSRF protection
- [ ] Integration test: give-note flow end-to-end
- [ ] Conflict test: simultaneous writes to same position

**Day 2 Done = real-time collaboration works safely.**

---

### Day 3 — Performance + AI + DevOps + Polish

**Goal:** 10,000 notes render smoothly. AI suggester works. System is deployed.

Morning:
- [ ] @tanstack/virtual integration for note rendering
- [ ] Time-window chunked API fetching (load visible range, prefetch adjacent)
- [ ] Seed script: 10,000 notes
- [ ] Performance benchmark (Chrome DevTools + k6 script)

Afternoon:
- [ ] AiModule: Claude API integration for note suggester
- [ ] Ghost note UI: translucent suggested notes with accept/dismiss
- [ ] UI polish: dark mode, zoom controls (1x/2x/4x), loading states
- [ ] README: setup instructions, architecture diagram, trade-offs, .env.example

Evening:
- [ ] GitHub Actions CI/CD pipeline (lint → test → build → deploy)
- [ ] Deploy to Railway (API + DB + Redis) + Vercel (frontend)
- [ ] Sentry error tracking integration
- [ ] Final end-to-end walkthrough and demo recording

**Day 3 Done = system is live, performs well, and is presentable.**

---

## 12. Test Strategy Summary

| Test Type | What It Covers |
|---|---|
| Unit | Unique constraint logic, boundary validation (0–300s, 1–8 track), point budget resets |
| Integration | Note creation flow (API → DB → event), conflict response (409), undo compensation |
| Conflict | Simultaneous writes to same (song_id, track, time) — only one succeeds |
| Boundary | Note at 301s rejected, note at track 9 rejected |
| Performance | 10,000 notes seed + k6 burst test + Chrome DevTools FPS measurement |

---

## 13. Grading Coverage Map

| Category | Points | How This Proposal Covers It |
|---|---|---|
| Foundation | 20 | Song + Note CRUD, PostgreSQL persistence, functional UI |
| Architecture | 10 | Clean NestJS modules, TypeScript throughout, Prisma relational schema |
| Visualization & Integrity | 10 | Accurate piano roll grid, unique constraint, atomic transactions, test suite |
| Security & Auth | 10 | Google OAuth SSO, rate limiting, CSRF, JWT, RBAC |
| UI/UX Excellence | 10 | Dark mode studio UI, snap-to-grid, zoom, loading states, optimistic UI |
| Advanced Backend | 10 | Socket.io + Redis Pub/Sub real-time, presence, conflict broadcast |
| DevOps & Cloud | 10 | Docker-compose, GitHub Actions CI/CD, Railway + Vercel hosting |
| Performance | 10 | Virtualized rendering, chunked API fetch, k6 test plan, benchmark steps |
| AI Innovation | 10 | Claude API note suggester with ghost UI, accept/dismiss |
| **Total** | **100** | |

---

## 14. Project Positioning

> AMA-MIDI is not a CRUD application. It is an internal creative tool that bridges music composition and game implementation for Amanotes teams. Every engineering decision — virtualized rendering, event-sourced ledger, real-time WebSocket rooms, database-level conflict prevention — exists to serve one goal: let composers and game developers work together on rhythm sequences faster, more safely, and with full visibility into what changed and why.

**GitHub README headline:**
> **AMA-MIDI — A real-time collaborative MIDI sequencer for Amanotes. Piano roll editor with 10,000-note performance, event-sourced change history, WebSocket collaboration, and AI note suggestions.**
