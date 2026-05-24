# Design Thinking

← [README](../../README.md) · [← Features](./03-features.md) · [Architecture →](./05-architecture.md)

---

This document is the reasoning behind the architecture — not the architecture itself. For each decision, I'll present the strongest opposing argument first, then explain why I still chose what I chose.

---

## Modular Monolith vs Microservices

**The case for microservices:** Independent deployability. Team autonomy. Services can scale independently. No shared deployment blast radius.

**Why I chose a modular monolith instead:** Those benefits only materialize at scale — when multiple teams own different services, when specific services see 10× more load than others, when independent release cycles are a real operational need. For a single-engineer three-day build, microservices add inter-service network calls, distributed tracing, shared-type synchronization, and container orchestration complexity — all cost, no benefit.

A *modular monolith* gives me clean domain boundaries without any of that overhead. In NestJS, this maps directly to the module system: `AuthModule`, `SongModule`, `NoteModule`, `LedgerModule`, `RealtimeModule`, `AiModule`. Each owns its domain, doesn't reach into another module's internals, and communicates through defined interfaces. If scaling requirements ever change, these boundaries become natural microservice cut points.

This is not "we'll fix it later." It's a deliberate architecture that satisfies the real constraints of the current moment while preserving future options.

---

## Database Constraint vs Application-Level Check

**The case for application-level checks:** Easier to read. Logic lives in the service layer. Can give richer error messages. Avoids relying on database-specific behavior.

**Why this is wrong:** Concurrency. Two composers click the same position at the same instant. Both requests hit the application layer simultaneously. Both query "does a note exist at this position?" — both see `false`, because neither insert has committed yet. Both proceed. Both succeed. Both write. Now you have a corrupted song.

The database-level unique constraint is enforced atomically at the point of write. One insert succeeds. The other fails with a unique constraint violation — deterministically, regardless of timing. The database handles the race condition that application code structurally cannot.

```sql
CREATE UNIQUE INDEX uq_notes_song_track_time_active
ON notes (song_id, track, time_seconds)
WHERE deleted_at IS NULL;
```

The API catches Prisma's `P2002` code → HTTP 409 → frontend rolls back the optimistic note → human-readable toast. Integrity is maintained at every layer. Application-level pre-checks are additive (better error messages), never a replacement.

---

## Event Sourcing vs Git-Style Branching {#event-sourcing-vs-git-branching}

**The case for Git-style branching:** Familiar mental model. Composers could work on experimental versions without affecting the main sequence. Built-in conflict resolution at merge time.

**Why the mental model is wrong here:** Git is designed for asynchronous individual work — you write your changes, commit, push, someone reviews, merges. A collaborative editor is the opposite: multiple people working *synchronously* on a single shared document. In a live editor, there is no "branch" — everyone is always on `main`.

Git-style branching would require locking sections of the timeline while someone works on them, which re-introduces exactly the collaborative friction AMA-MIDI exists to eliminate.

Event sourcing matches the actual semantics of what's happening. A note being created is an event. An event has real meaning: who did it, when, what it looked like before, what it looks like after. An append-only ledger captures this naturally. The current note state is the accumulated result of all events. Undo is a *compensating event* — a new `NOTE_DELETED` event that records the reversal, rather than mutating history.

---

## DOM Virtualization vs Canvas

**The case for Canvas:** Higher performance ceiling. Renders millions of elements as pixels without DOM overhead. Immune to layout recalculations.

**Why I started with DOM virtualization:** Canvas forces you to hand-implement everything the browser gives you for free — hit-testing (which note did I click?), hover states, keyboard focus, accessibility, tooltips. For an interaction-heavy piano roll editor where users click, hover, select, and use keyboard shortcuts on individual notes, losing the browser's event model is a significant cost.

DOM virtualization via `@tanstack/virtual` keeps only ~80 DOM nodes in view at any time, regardless of total note count. Scrolling through 10,000 notes stays smooth. If profiling ever shows Canvas is necessary, it's an optimization path, not the starting point.

---

## Optimistic UI vs Server-Wait

**The case for server-wait:** Simpler state management. No rollback logic. What the user sees is always what the server confirmed.

**Why optimistic UI is right here:** Composers work in flow states. A 200ms lag between clicking a position and seeing a note appear breaks creative rhythm. At 30+ notes per minute in fast mode, that latency compounds. The optimistic model — note appears instantly on click, API call in background, rollback on conflict — makes the editor feel instant on any connection speed.

The rollback path is well-defined: the server returns 409, the frontend removes the ghost note and shows a toast. The user gets an explanation, not a freeze. The server remains the authority on what actually exists.

---

## 0.1s Snap Resolution vs Millisecond Precision

**The case for milliseconds:** More precise. Closer to how professional MIDI software works. Allows notes at 5.001s and 5.002s.

**Why this is wrong for this context:** Millisecond precision allows two notes at 5.001s and 5.002s — positions that appear visually identical on screen but are stored as different records. The unique constraint would allow both. The editor would render them overlapping. The UX would be confusing, and the data would be wrong.

0.1s resolution is precise enough for game soundtrack prototyping and enforces clean, perceptually meaningful constraints. Two notes at 5.0s and 5.1s are visually distinct and musically separate. The snap grid reinforces what the constraint guarantees.

---

## The Language of Error Messages

One decision that doesn't fit a neat "A vs B" frame but shapes the product: error message language.

When two composers simultaneously place a note at the same position, one loses. The question is what you tell them.

- **Bad:** `HTTP 409 Conflict — POST /songs/:id/notes failed`
- **Mediocre:** `Position already taken`
- **Right:** `This position was just taken — try a nearby spot`

The difference is empathy. The bad version treats the user as a developer debugging an API. The right version acknowledges what happened, implies another user was involved, and gives actionable guidance. Three seconds of thinking about language saves the user from confusion and frustration.

This principle extends to all error states. "Connection lost — reconnecting…" instead of "WebSocket disconnected." "Back online — syncing changes" instead of "Connection restored." Language is a product decision.

---

*→ Next: [Architecture & System Design](./05-architecture.md)*
