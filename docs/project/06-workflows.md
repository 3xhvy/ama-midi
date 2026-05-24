# Major Feature Workflows

← [README](../../README.md) · [← Architecture](./05-architecture.md) · [Trade-offs →](./07-trade-offs.md)

---

## 1. Note Creation — Happy Path & Conflict Path

This workflow is the heart of the product. Every other feature wraps around it.

### Happy Path

1. Composer clicks a position on the piano roll grid.
2. The editor calculates `(track, time)` from the click coordinates using the zoom-aware coordinate engine. `time = scrollTop / (3 * zoom)`, snapped to 0.1s.
3. A ghost note (optimistic) renders immediately at that position. The composer sees instant feedback.
4. The frontend fires `POST /songs/:songId/notes` in the background.
5. The API validates: `track` must be 1–8, `time` must be 0–300. Invalid → 422, no DB write.
6. The API opens a transaction: inserts the note, writes a `NOTE_CREATED` event to the ledger.
7. On commit, the API emits `note.created` to the Redis channel for this song.
8. The Redis adapter fans the event out to all API instances. Every instance broadcasts to clients in that song's WebSocket room.
9. All other collaborators in the song receive the event. Their TanStack Query caches update. The new note appears on their grids — no refresh, no polling.
10. The originating client receives the 201 response. The optimistic ghost is replaced by the confirmed note.

### Conflict Path

Steps 1–4 are identical. At step 6, the database `INSERT` violates the unique index because another note already exists at `(song_id, track, time_seconds)` where `deleted_at IS NULL`.

- Database raises a unique constraint violation.
- Prisma surfaces it as error code `P2002`.
- The API catches `P2002` → returns HTTP 409 with `{ error: 'POSITION_TAKEN', conflictingUser: '...' }`.
- The frontend receives 409. The optimistic note is removed from the grid.
- A toast appears: *"This position was just taken — try a nearby spot."*
- No event is written to the ledger. Nothing corrupt is persisted.

The conflict path is indistinguishable from the happy path from a data integrity perspective: the database is always consistent.

---

## 2. Real-Time Collaboration

### The Scenario

Two composers — Minh and Lan — are both in the same song at the same time. Minh is working on Track 2, Lan on Track 5. This is the normal operating mode for the product.

### Presence Establishment

When Minh opens the editor, the frontend emits `song.join` with the song ID. The Socket.io gateway adds Minh to the room for that song and broadcasts `user.joined` to all room members. Lan's presence bar updates: Minh's avatar appears.

### Live Note Sync

Every time Lan creates, updates, or deletes a note:

1. The write goes through the normal note creation flow (above).
2. On successful commit, the API publishes `note.created` / `note.updated` / `note.deleted` to Redis.
3. Redis delivers the event to all API instances subscribed to this song's channel.
4. Each instance broadcasts the event to all Socket.io clients in the song room.
5. Minh's client receives the event. The `useNotes` hook merges it into the TanStack Query cache — the note appears, updates, or disappears on Minh's grid instantly.

Minh never refreshes. Minh never polls. The grid reflects the live shared state at all times.

### Multi-Instance Safety

The Redis adapter ensures correctness even when Minh and Lan are connected to different API instances (which happens automatically in a load-balanced deployment). Without Redis, instance 1 would broadcast only to its own connected clients — Lan's note change would never reach Minh if they're on different instances. Redis is the shared message bus that makes horizontal scaling transparent.

---

## 3. AI Note Suggestion

### The Product Intent

The AI suggester is not generating music from scratch. It's acting as intelligent autocomplete for pattern continuation. A composer who has placed five notes has established a rhythmic pattern. The AI's job is to recognize that pattern and propose what logically comes next.

### Trigger & Request

After a composer places at least 5 notes, a "Suggest next notes" button appears. Clicking it:

1. The frontend collects the last 10 notes (track, time, color) from the current song state.
2. These are sent to `POST /ai/suggest` with the song ID and note context.
3. The API forwards a structured prompt to the configured AI provider (Anthropic Claude, OpenAI, or DeepSeek — selected via `AI_PROVIDER` env var):
  - System: "You are a MIDI note pattern assistant. Return only valid JSON."
  - User: "Here are notes placed so far: [...]. Suggest 4 next notes that continue this rhythmic pattern. Return JSON array: `[{track, time, color}]`"

The provider is swappable at deploy time — same prompt contract, different underlying model. DeepSeek is the low-cost default for non-production; Anthropic Claude or OpenAI GPT-4o for production quality.

### Response & Ghost UI

The AI provider returns 3–5 suggested notes as JSON. The API validates each suggestion (track 1–8, time 0–300) before sending to the client.

On the frontend, suggested notes render as **ghost notes**: 20% opacity, dashed border, slow pulse animation. They are visually distinct from real notes. Each ghost has accept and dismiss controls on hover.

The color hint in suggestions carries meaning — if the composer has been using blue for Track 2, a suggestion of blue at Track 2 is more intuitive than an arbitrary color.

### Accept / Dismiss

- **Accept:** The ghost note goes through the same `POST /songs/:songId/notes` flow as any manually placed note. Same validation, same WebSocket broadcast, same ledger event. An AI-sourced note is indistinguishable from a human note in the data model once accepted.
- **Dismiss:** The ghost is removed from the UI. No server interaction.

### Edge Case: Race Conflict on Accept

If a composer accepts a suggestion for a position that another composer has simultaneously taken, the same 409 conflict path triggers. The ghost disappears, a conflict toast appears. The AI integration does not bypass the integrity layer — it sits on top of it.

---

*→ Next: [Key Trade-offs](./07-trade-offs.md)*