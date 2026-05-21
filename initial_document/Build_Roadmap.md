# AMA-MIDI — Complete Build Roadmap
### 3-Day Execution Plan (AI-Assisted Development)

---

## How to Read This Roadmap

Each task has three parts:
- **What to build** — the deliverable
- **What to prompt AI for** — the exact intent to give Cursor/Copilot
- **What to verify yourself** — the thing AI cannot judge for you

The verify step is non-negotiable. AI generates plausible code. You own whether it is correct.

---

## Pre-Day 1 — Setup (2 hours before you start)

Do these before anything else. Every hour of Day 1 depends on them working.

### P1. Create the monorepo structure

```
ama-midi/
├── apps/
│   ├── web/        (Vite + React 18 + TypeScript + TailwindCSS)
│   └── api/        (NestJS + TypeScript)
├── packages/
│   └── shared/     (shared TypeScript types)
├── docker-compose.yml
└── turbo.json
```

Prompt AI: "Create a Turborepo monorepo with two apps: a Vite React TypeScript app and a NestJS TypeScript app. Include a shared packages/shared folder for common types. Add TailwindCSS to the web app with dark mode class strategy."

Verify yourself:
- `cd apps/web && npm run dev` loads a blank React page
- `cd apps/api && npm run start:dev` starts NestJS without errors
- Shared types can be imported in both apps

### P2. Docker-compose

Services needed: postgres, redis, api, web.

```yaml
# docker-compose.yml skeleton
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: ama_midi
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  api:
    build: ./apps/api
    depends_on: [postgres, redis]
    ports: ["3001:3001"]

  web:
    build: ./apps/web
    ports: ["3000:3000"]
```

Verify yourself:
- `docker-compose up` starts all 4 services without errors
- `psql -h localhost -U postgres ama_midi` connects successfully

### P3. Create .env.example

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ama_midi
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret_here
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
ANTHROPIC_API_KEY=your_anthropic_api_key
FRONTEND_URL=http://localhost:3000
```

---

## Day 1 — Foundation + Core Editor

**Goal by end of day:** One user can log in, create a song, open the piano roll editor, place notes, and delete them. Data persists in PostgreSQL.

---

### Block 1 — Database Schema (1.5 hours)

This is the most important block of the entire project. Get it right before writing any application code. Every other decision depends on this.

#### 1.1 Prisma Setup

Prompt AI: "Set up Prisma in a NestJS app connected to PostgreSQL at DATABASE_URL. Generate the prisma client."

#### 1.2 Schema

Prompt AI: "Create a Prisma schema with these models:"

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  avatarUrl String?
  role      Role     @default(COMPOSER)
  createdAt DateTime @default(now())

  songs      Song[]
  notes      Note[]
  noteEvents NoteEvent[]
}

enum Role {
  ADMIN
  COMPOSER
  VIEWER
}

model Song {
  id        String   @id @default(uuid())
  name      String
  createdBy String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  creator    User        @relation(fields: [createdBy], references: [id])
  notes      Note[]
  noteEvents NoteEvent[]
}

model Note {
  id          String   @id @default(uuid())
  songId      String
  track       Int      // 1–8
  time        Float    // 0.0–300.0, 0.1s resolution
  title       String
  description String   @default("")
  color       String   @default("#6366F1")
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  song    Song @relation(fields: [songId], references: [id], onDelete: Cascade)
  creator User @relation(fields: [createdBy], references: [id])

  @@unique([songId, track, time])  // THE core integrity constraint
}

model NoteEvent {
  id          String        @id @default(uuid())
  songId      String
  noteId      String?
  eventType   NoteEventType
  userId      String
  timestamp   DateTime      @default(now())
  beforeState Json?
  afterState  Json?

  song Song @relation(fields: [songId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id])
}

enum NoteEventType {
  NOTE_CREATED
  NOTE_UPDATED
  NOTE_DELETED
}
```

Verify yourself:
- `npx prisma migrate dev --name init` runs without errors
- Open a DB client and confirm all tables exist
- Confirm the unique index exists on notes: `\d notes` in psql shows `UNIQUE (song_id, track, time)`
- **Manually try inserting two notes with the same song_id, track, time in psql — confirm it rejects the second one.** This is the most important verification in the entire project.

---

### Block 2 — Auth Module (1.5 hours)

#### 2.1 JWT + Google OAuth

Prompt AI: "Build a NestJS AuthModule with:
- Google OAuth2 via Passport.js (@nestjs/passport, passport-google-oauth20)
- JWT strategy for protecting routes
- POST /auth/google endpoint that receives Google token, creates or finds user in DB, returns JWT
- JwtAuthGuard that can be applied to any controller
- RolesGuard that checks user.role against a @Roles() decorator"

Verify yourself:
- GET /auth/google redirects to Google login
- After Google login, a JWT is returned
- Calling a protected route without JWT returns 401
- Calling a protected route with JWT returns 200
- A VIEWER role cannot access a COMPOSER-only endpoint

#### 2.2 Shared types for auth

In `packages/shared/src/auth.ts`:
```typescript
export type UserRole = 'ADMIN' | 'COMPOSER' | 'VIEWER'

export interface AuthUser {
  id: string
  email: string
  name: string
  avatarUrl?: string
  role: UserRole
}
```

---

### Block 3 — Song Module (1 hour)

Prompt AI: "Build a NestJS SongModule with:
- GET /songs — list all songs with creator name, note count, updatedAt
- POST /songs — create song (requires auth, name in body)
- GET /songs/:id — get song details
- PATCH /songs/:id — rename song (ADMIN or creator only)
- DELETE /songs/:id — delete song (ADMIN only)
All endpoints protected by JwtAuthGuard."

Verify yourself:
- POST /songs with valid JWT creates a song and returns it
- GET /songs returns the list including the new song
- DELETE /songs/:id without JWT returns 401

---

### Block 4 — Note Module (2 hours)

This is the core business logic. The conflict handling here is what separates a senior submission from a junior one.

Prompt AI: "Build a NestJS NoteModule with:
- GET /songs/:songId/notes — return all notes for a song, ordered by time
- POST /songs/:songId/notes — create note with { track, time, title, description, color }
  - Validate: track must be 1–8, time must be 0–300, time rounded to 1 decimal place
  - On Prisma unique constraint violation (P2002), return HTTP 409 with body { error: 'POSITION_TAKEN', message: 'A note already exists at this position' }
  - On success, write a NoteEvent of type NOTE_CREATED with afterState = the created note
- PATCH /songs/:songId/notes/:noteId — update note properties (not track or time — position is immutable)
  - Write NoteEvent of type NOTE_UPDATED with beforeState and afterState
- DELETE /songs/:songId/notes/:noteId — delete note
  - Write NoteEvent of type NOTE_DELETED with beforeState = the note before deletion
All inside a Prisma transaction: note mutation + event write happen atomically."

Verify yourself:
- POST a note — it appears in GET /songs/:id/notes
- POST the exact same track+time again — confirm you get 409, not 500
- Check the note_events table — confirm a NOTE_CREATED row exists after every note creation
- Delete a note — confirm NOTE_DELETED event written with beforeState populated
- Try time=301 — confirm 400 validation error
- Try track=9 — confirm 400 validation error

---

### Block 5 — Piano Roll Frontend (2.5 hours)

#### 5.1 Song List Page

Prompt AI: "Build a React page at /songs that:
- Fetches GET /songs using TanStack Query
- Shows songs as cards with name, creator, last modified
- Has a 'New Song' button that POSTs to /songs and navigates to /songs/:id
- Dark mode, TailwindCSS, clean studio aesthetic"

#### 5.2 Piano Roll Grid

This is the most complex frontend component. Break it into sub-prompts.

**Sub-prompt 1 — Grid structure:**
"Build a React PianoRoll component that renders:
- A fixed header row with 8 column labels (Track 1–8)
- A scrollable vertical timeline from 0s to 300s
- Time markers every 1s as thin horizontal lines, bolder every 10s
- Time labels (0s, 10s, 20s...) on the left edge
- The grid is 800px wide total, each track column is equal width
- Dark background (#0F0F13), grid lines at 15% opacity white
- The component accepts a notes prop: Note[]"

Verify yourself: The grid renders visibly. You can see 8 columns. You can scroll to the bottom and see the 300s marker.

**Sub-prompt 2 — Note rendering:**
"Add note rendering to the PianoRoll component:
- Each note renders as a circle at position (track, time)
- X position = column center for that track
- Y position = (time / 300) * totalHeight
- Circle radius 8px, filled with note.color
- On hover, show a tooltip with note.title and note.time
- Selected note has a white ring around it"

Verify yourself: Seed 5 notes via the API. Open the editor. Confirm circles appear at the correct positions.

**Sub-prompt 3 — Virtualization:**
"Wrap the note rendering in @tanstack/virtual so that only notes within the current scroll viewport are mounted as DOM elements. The virtualizer should work on the Y axis (time axis). Test with 500 notes — DOM node count should stay under 100 regardless of total note count."

Verify yourself: Open DevTools → Elements. Count note circle elements while viewing the top of the song. Scroll to middle. Count again. Numbers should be similar and small — not 500.

**Sub-prompt 4 — Click to create (Fast Mode):**
"Add click handling to the PianoRoll grid:
- On grid click, calculate track (1–8) from X position and time from Y position
- Round time to 1 decimal place (snap to 0.1s grid)
- Show a ghost circle at the click position immediately (optimistic UI)
- POST to /songs/:songId/notes with the calculated track and time
- If POST succeeds, the ghost becomes a real note (replace with server data)
- If POST returns 409, remove the ghost and show a toast: 'This position is already taken'
- If POST returns any other error, remove the ghost and show a generic error toast"

Verify yourself:
- Click the grid — a note appears instantly
- Click the exact same position again — ghost appears then disappears with toast
- Check DB — confirm only one note exists at that position

**Sub-prompt 5 — Delete:**
"Add note deletion to the PianoRoll:
- Clicking a note circle selects it (highlighted state)
- Pressing Backspace or Delete while a note is selected calls DELETE /songs/:songId/notes/:noteId
- Note disappears optimistically, restored if API call fails"

---

### Block 6 — Note Popup Mode (1 hour)

Prompt AI: "Add a popup mode to the PianoRoll:
- A toggle button in the toolbar switches between Fast Mode and Popup Mode
- In Popup Mode, clicking the grid does NOT immediately create a note
- Instead, a modal opens with a form: Title (required), Description, Color picker (6 preset colors), Track (auto-filled from click, editable), Time (auto-filled, editable)
- Submit calls POST /songs/:songId/notes
- In Fast Mode, pressing E while a note is selected opens the same popup for editing (PATCH)"

Verify yourself: Toggle modes. Both flows create notes. Edit popup pre-fills existing note data correctly.

**Day 1 is complete when:** Login works, songs can be created, piano roll grid shows, notes can be placed and deleted, data persists on page refresh.

---

## Day 2 — Real-time Collaboration + Ledger + Security

**Goal by end of day:** Multiple browser tabs editing the same song stay in sync. Every change is recorded. Auth is production-grade.

---

### Block 7 — WebSocket Gateway (2 hours)

#### 7.1 NestJS Socket.io Gateway with Redis Adapter

Prompt AI: "Build a NestJS WebSocket gateway using @nestjs/websockets and socket.io:
- Install @socket.io/redis-adapter and connect to Redis
- Gateway handles connection with JWT auth in handshake (reject unauthenticated connections)
- Events the server handles:
  - join-song: client joins a room named song:{songId}
  - leave-song: client leaves the room
- Events the server emits to rooms:
  - note-created: { note } — broadcast when a note is created
  - note-updated: { note } — broadcast when a note is updated
  - note-deleted: { noteId } — broadcast when a note is deleted
  - user-joined: { userId, name, avatarUrl } — broadcast when a user joins
  - user-left: { userId } — broadcast when a user leaves
- The NoteModule should call the gateway to emit events after successful DB writes"

Verify yourself:
- Open two browser tabs on the same song
- Create a note in Tab 1
- Confirm the note appears in Tab 2 without refreshing
- Close Tab 1 — confirm user-left event fires in Tab 2

#### 7.2 Frontend WebSocket Integration

Prompt AI: "Build a useSocket React hook that:
- Connects to the Socket.io server with the user's JWT in auth header
- On mount: emits join-song with the current songId
- On unmount: emits leave-song and disconnects
- Listens for note-created: adds the note to TanStack Query cache for this song
- Listens for note-updated: updates the note in cache
- Listens for note-deleted: removes the note from cache
- Listens for user-joined and user-left: maintains a presenceList state
- Returns: { presenceList, isConnected }"

Verify yourself:
- Open two tabs. Create a note in one. It appears in the other instantly — no page refresh.
- Check that TanStack Query cache is updated, not just local state (network tab should show no extra GET /notes call after the WebSocket event)

#### 7.3 Presence Indicator

Prompt AI: "Build a PresenceBar component that:
- Receives presenceList from useSocket
- Shows an avatar circle for each active user (initials if no avatarUrl)
- Tooltip on hover shows the user's name
- Maximum 5 visible, +N badge if more
- Positioned in the editor toolbar"

---

### Block 8 — Conflict UX (30 minutes)

This is a UI copy and toast decision. Fast to implement, high interview value.

Prompt AI: "Build a toast notification system using react-hot-toast or sonner that shows:
- On 409 from POST /notes: 'This position was just taken — try a nearby spot'
- On WebSocket disconnect: 'Connection lost — reconnecting...'
- On reconnect: 'Back online — syncing changes'
- On note-created from another user: subtle 'Minh added a note at Track 3, 42.5s' (optional, configurable)
All toasts in friendly non-technical language."

---

### Block 9 — History Panel / Ledger UI (1.5 hours)

#### 9.1 Backend: History Endpoint

Prompt AI: "Add to NoteModule:
- GET /songs/:songId/events — return all NoteEvents for a song, newest first, paginated (limit 50, cursor-based)
- Each event includes: eventType, timestamp, user name+avatar, beforeState, afterState
- GET /songs/:songId/events/undo — POST endpoint that:
  - Finds the last NOTE_CREATED event by the current user for this song
  - Deletes that note
  - Writes a NOTE_DELETED event with metadata: { undoneEventId }
  - Broadcasts note-deleted via WebSocket"

#### 9.2 Frontend: History Panel

Prompt AI: "Build a HistoryPanel sidebar component that:
- Slides in from the right when user clicks a history icon in the toolbar
- Fetches GET /songs/:songId/events with TanStack Query + infinite scroll
- Each event shows: user avatar, action description in human language, timestamp relative ('2 minutes ago')
- Human language mapping:
  - NOTE_CREATED: '{name} added a note at Track {track}, {time}s'
  - NOTE_UPDATED: '{name} edited a note at Track {track}, {time}s'
  - NOTE_DELETED: '{name} removed a note at Track {track}, {time}s'
- An Undo button at the top calls POST /songs/:songId/events/undo"

Verify yourself:
- Create 3 notes. Open history panel. All 3 appear in correct order.
- Click Undo. The last note disappears from the grid AND from another tab simultaneously.
- History panel shows the NOTE_DELETED event.

---

### Block 10 — Role-Based Views (45 minutes)

From the UX document, this is the highest interview-value idea that costs least to implement.

Prompt AI: "Add a view mode switcher to the editor toolbar with three modes:
- Composer View: shows all 8 tracks, full note detail, fast-mode enabled
- Developer View: shows notes with their IDs and exact timestamps visible on hover, read-only popup with raw data
- QA View: highlights notes that are at boundary positions (time < 0.5s or > 299.5s), duplicate-adjacent notes (two notes within 0.5s on same track), shows a warning count badge
Each view mode stores in Zustand and changes what information is displayed, not what data is fetched."

Verify yourself: Switch between views. QA view correctly highlights boundary notes. Developer view shows raw IDs on hover.

---

### Block 11 — Security Hardening (1 hour)

Prompt AI: "Add to NestJS API:
1. @nestjs/throttler — rate limit all endpoints to 100 req/min per IP, note creation to 30 req/min per user
2. helmet — security headers
3. CORS configured to allow only FRONTEND_URL
4. CSRF protection via csurf middleware for cookie-based flows
5. All user inputs validated with class-validator DTOs — no raw request body access"

Verify yourself:
- Hit POST /notes 31 times in 1 minute — confirm 429 on the 31st
- Check response headers include X-Content-Type-Options, X-Frame-Options

---

## Day 3 — Performance + AI + DevOps + Polish

**Goal by end of day:** 10,000 notes render smoothly. AI suggester works. System is live on a real URL.

---

### Block 12 — Performance (2 hours)

#### 12.1 Seed Script

Prompt AI: "Write a Prisma seed script that inserts 10,000 notes across 8 tracks and 300 seconds for song with id SEED_SONG_ID. Distribute notes randomly but ensure no duplicate (track, time) positions. Use batch inserts of 500 at a time."

Run it: `npx ts-node seed.ts`

Verify: `SELECT COUNT(*) FROM notes WHERE song_id = 'SEED_SONG_ID'` returns 10000.

#### 12.2 Chunked API Fetching

Prompt AI: "Modify GET /songs/:songId/notes to accept query params:
- timeFrom: number (default 0)
- timeTo: number (default 300)
Returns only notes within that time range. Add a DB index on (song_id, time)."

Then in the frontend:

Prompt AI: "Modify useNotes hook to:
- Calculate the visible time range from the current scroll position and zoom level
- Fetch only notes for that time range: GET /notes?timeFrom=X&timeTo=Y
- Prefetch the adjacent range above and below
- Use TanStack Query with the time range as part of the query key so different ranges are cached separately"

#### 12.3 Performance Benchmark

Do this yourself — AI cannot run this for you:

1. Open the editor with the 10,000 note song
2. Open Chrome DevTools → Performance tab
3. Record 5 seconds of scrolling
4. Check: are there any frames below 30fps? Any layout thrashing?
5. Open Elements tab — count note DOM nodes. Should be under 100.
6. Document your findings in the README

#### 12.4 k6 Load Test

Prompt AI: "Write a k6 load test script that:
- Simulates 100 virtual users
- Each VU creates notes with random track (1–8) and random time (0–300, 0.1s resolution) for 30 seconds
- Reports: p95 response time, error rate, conflict rate (409s)
- Includes a conflict test: 10 VUs all try to create a note at Track 1, Time 5.0s simultaneously"

Run: `k6 run --vus 100 --duration 30s load-test.js`

Document results in README.

---

### Block 13 — AI Note Suggester (1.5 hours)

#### 13.1 Backend: AI Endpoint

Prompt AI: "Build a NestJS AiModule with:
- POST /songs/:songId/suggest-notes
- Requires auth, COMPOSER role
- Fetches the last 10 notes for this song ordered by createdAt
- Calls Anthropic API (claude-sonnet-4-20250514) with this system prompt:
  'You are a MIDI note pattern assistant for a music game company. Analyze the given note sequence and suggest what comes next. Return ONLY a JSON array, no explanation.'
- User prompt: 'Here are the last notes placed: {JSON of last 10 notes with track, time, color}. Suggest 4 next notes that continue this rhythmic and track pattern. Each note needs: track (1-8), time (float, must be after the last note, max 300), color (hex string matching the pattern). Return only a JSON array.'
- Parse the response, validate each suggestion (track 1-8, time 0-300, valid hex color)
- Return: { suggestions: [{ track, time, color }] }"

Verify yourself:
- Call the endpoint after placing 5+ notes
- Confirm response is valid JSON array
- Confirm suggested times are all after the last placed note
- Confirm tracks are all 1–8

#### 13.2 Frontend: Ghost Note UI

Prompt AI: "Add AI suggestion UI to the PianoRoll:
- A 'Suggest' button in toolbar, disabled if note count < 5
- On click: calls POST /suggest-notes, shows loading state on button
- Renders suggestions as ghost circles: same size as real notes but 40% opacity, dashed border, no fill
- Each ghost note has two small buttons on hover: ✓ Accept (calls POST /notes with that position) and ✗ Dismiss (removes ghost)
- Accepting a suggestion makes it a real note and broadcasts via WebSocket like any other note creation
- All ghosts are cleared if the user navigates away or clicks 'Clear suggestions'"

Verify yourself:
- Click Suggest — ghost notes appear on the grid
- Accept one — it becomes a real note and appears in the other browser tab via WebSocket
- Dismiss one — it disappears
- Accepting a suggestion that was already taken by another user shows the 409 toast

---

### Block 14 — UI Polish (1 hour)

Prompt AI: "Polish the AMA-MIDI editor UI:
1. Zoom controls: buttons for 1x (full 300s), 2x (150s visible), 4x (75s visible). Zoom changes the px-per-second ratio and recomputes note Y positions.
2. Loading skeleton for the piano roll while notes are fetching
3. Empty state: when a song has 0 notes, show a centered message 'Click anywhere on the grid to place your first note'
4. Track labels at top: clickable to mute/solo that track (visual only — dims notes on that track)
5. Keyboard shortcut legend: small ? button that shows shortcuts (E = edit, Delete = remove, Cmd+Z = undo)"

---

### Block 15 — DevOps (1.5 hours)

#### 15.1 GitHub Actions CI/CD

Prompt AI: "Create a GitHub Actions workflow at .github/workflows/ci.yml that:
- Triggers on push to main and pull requests
- Jobs:
  1. lint: runs eslint on both apps
  2. test: runs unit tests in apps/api
  3. build: builds both apps, fails if TypeScript errors
  4. deploy (main only): deploys api to Railway and web to Vercel using their CLI actions"

#### 15.2 Railway Deployment

- Create Railway project
- Add PostgreSQL and Redis plugins
- Set environment variables from .env.example
- Connect GitHub repo for auto-deploy on main push

#### 15.3 Vercel Deployment

- Import web app from GitHub
- Set VITE_API_URL to Railway API URL
- Set VITE_WS_URL to Railway WebSocket URL

Verify yourself:
- Push a commit to main
- GitHub Actions goes green on all jobs
- Railway shows new deployment
- Live URL loads the app and login works

---

### Block 16 — README + Documentation (1 hour)

This is part of the grading checklist. Do not skip it.

Prompt AI: "Write a professional README.md for AMA-MIDI that includes:
1. One-paragraph project description (product-first, not tech-first)
2. Live URL and demo credentials
3. Setup instructions: prerequisites, clone, npm install, docker-compose up, prisma migrate, seed, npm run dev
4. Architecture section: why NestJS, why PostgreSQL + unique constraint, why Socket.io + Redis, why event sourcing for ledger, why @tanstack/virtual for rendering
5. Trade-offs section: modular monolith vs microservices, DOM virtualization vs Canvas, 0.1s snap resolution decision
6. Performance results: actual numbers from your k6 run and Chrome DevTools
7. Test coverage summary
8. Grading coverage map (table showing which features cover which criteria)"

---

## Test Suite Summary

### Unit Tests (write these on Day 1 and Day 2 as you build)

```
NoteService
  ✓ rounds time to 1 decimal place before insert
  ✓ rejects time < 0
  ✓ rejects time > 300
  ✓ rejects track < 1
  ✓ rejects track > 9
  ✓ returns 409 on duplicate position
  ✓ writes NOTE_CREATED event on successful create
  ✓ writes NOTE_DELETED event with beforeState on delete
  ✓ undo deletes the last note created by current user

SongService
  ✓ only creator or ADMIN can delete a song
```

### Integration Tests

```
POST /songs/:id/notes
  ✓ creates note and returns 201
  ✓ returns 409 on duplicate (song_id, track, time)
  ✓ returns 400 on invalid track
  ✓ returns 400 on invalid time
  ✓ returns 401 without JWT
  ✓ writes note_event record in same transaction

Concurrent conflict test
  ✓ two simultaneous requests for same position — only one succeeds
```

### Performance Tests

```
k6: 100 VUs, 30s
  ✓ p95 response < 200ms
  ✓ conflict (409) responses handled gracefully, not 500
  ✓ no database connection pool exhaustion

Browser: 10,000 notes
  ✓ time-to-first-note-visible < 2s
  ✓ scroll FPS > 50
  ✓ DOM node count stays under 100 while scrolling
```

---

## Scope Decisions for Interview Defense

These are the cuts you made and why. Be ready to say these out loud.

**Kept from the UX document:**
- Role-based views (Composer / Developer / QA) — high interview value, low implementation cost, shows user empathy
- Friendly conflict language — demonstrates product thinking over engineering thinking
- Validation warnings in QA view — maps directly to integrity grading criteria

**Cut with reasons:**
- Section-based locking — adds WebSocket complexity without adding grading points. Covered by database constraint + conflict toast.
- Approval workflow — out of scope for the editor. Documented as Phase 2.
- Comment pins on timeline — no grading impact, high UI complexity.
- Export to Unity — different product domain. Documented as future integration.
- Git-style branching — wrong model for live collaborative editing. Replaced by event sourcing.

---

## Final Checklist Before Submission

### Code
- [ ] Monorepo structure: /apps/web and /apps/api clearly separated
- [ ] .env.example committed with all required variables
- [ ] No hardcoded secrets in code
- [ ] TypeScript strict mode — no `any` types
- [ ] Professional git commit history (feat:, fix:, chore: prefixes)

### Features
- [ ] Song CRUD works
- [ ] Piano roll grid renders with correct layout
- [ ] Fast mode note creation works
- [ ] Popup mode works
- [ ] Real-time sync verified in two browser tabs
- [ ] Presence indicators show active users
- [ ] History panel shows all events
- [ ] Undo works and syncs via WebSocket
- [ ] 409 conflict returns friendly toast
- [ ] Role-based views implemented
- [ ] AI suggester returns ghost notes
- [ ] Accept/dismiss works on ghost notes
- [ ] 10,000 note seed verified in DB

### Security
- [ ] All endpoints require JWT
- [ ] Rate limiting active (verified with 429 test)
- [ ] Google OAuth SSO works end to end
- [ ] CORS locked to frontend URL

### Performance
- [ ] k6 test run with documented results
- [ ] Chrome DevTools scroll FPS documented
- [ ] DOM node count verified under 100 during scroll

### DevOps
- [ ] docker-compose up starts everything
- [ ] GitHub Actions pipeline passes
- [ ] Live URL works
- [ ] README complete with setup, architecture, trade-offs, performance numbers
