# Feature Hierarchy

← [README](../../README.md) · [← Actors & Use Cases](./02-actors-and-use-cases.md) · [Design Thinking →](./04-design-thinking.md)

---

Features are organized by priority tier. Each tier reflects a deliberate scope decision, not a "nice to have someday" list. P0 ships or the product doesn't work. P1 ships or collaboration is incomplete. P2 is real value that didn't fit the three-day build window.

---

## P0 — Must Ship (Core Product Works)

| Feature | Why This Tier |
|---|---|
| **Google OAuth + JWT auth** | No anonymous edits on shared data. Enterprise requirement — SSO means IT controls access. |
| **Song CRUD** | Container for everything. No songs = nothing to edit. |
| **Piano Roll Grid** | 8 tracks × 0–300s vertical timeline. The product's entire visual identity. |
| **Note CRUD** | Create, read, update, delete. The core action loop. |
| **DB-level duplicate prevention** | `UNIQUE (song_id, track, time)` — not application-level. Race condition safety. |
| **Real-time note sync** | WebSocket broadcast via Socket.io + Redis. Multi-user without this is just a shared Google Sheet. |
| **Optimistic UI** | Note appears on click, rolls back on 409. Without this, the editor feels laggy for composers. |
| **Conflict handling** | Toast with human-readable message when position is taken. Integrity visible to the user. |
| **Role-based access control** | Admin / Composer / Viewer enforced at API guards and UI level. |

---

## P1 — Should Ship (Collaboration Is Complete)

| Feature | Why This Tier |
|---|---|
| **Change history (ledger)** | Event-sourced `note_events` table. Every mutation recorded with before/after state. |
| **Undo via compensating event** | Revert last action without mutating history — append a new compensating event. |
| **User presence** | Avatars of who's currently in the same song. Makes collaboration feel real, not invisible. |
| **Snap-to-grid (0.1s resolution)** | Prevents perceptually-identical-but-different note positions. Clean constraint enforcement. |
| **Viewport zoom (1x / 2x / 4x)** | Essential for detailed editing in a 300-second timeline. |
| **10,000-note rendering** | DOM virtualization via `@tanstack/virtual`. ~80 active DOM nodes regardless of total count. |
| **Chunked API fetch** | Load only the visible time window; prefetch adjacent. Server-side complement to virtualization. |
| **AI note suggester** | Ghost overlay of 3–5 suggested next notes from a configurable AI provider (Anthropic Claude, OpenAI, or DeepSeek). Accept/dismiss per suggestion. |
| **Rate limiting** | 30 note creates per minute per user. Protects data from scripting errors, not just abuse. |
| **CSRF protection** | Double-submit cookie pattern. Required for cookie-based auth in enterprise context. |

---

## P2 — Nice to Have (Real Value, Deliberate Cut)

| Feature | Why Cut (Not Why Unimportant) |
|---|---|
| **Cursor presence on grid** | Broadcast `mousemove` at ~30fps per collaborator. Real value (Figma-style), but outside grading criteria. |
| **Conflict negotiation UI** | Show loser a "your note vs what's there" comparison, suggest nearby position. Richer than a toast. |
| **Timeline comments** | Review comments pinned to (time, track). Real workflow need; adds non-trivial data model. |
| **Approval workflow** | Composer submits → Product Owner approves. Valuable for production; out of MVP scope. |
| **Song version snapshots** | Named point-in-time saves. Useful for review checkpoints. |
| **Export to game engine format** | JSON manifest for Unity/game engine import. The logical final step that closes the production loop. |

---

## Explicitly Out of Scope

These are documented as deliberate non-decisions, not forgotten features:

- **Audio playback** — requires MIDI synthesis engine (Tone.js), timing sync with playhead, audio context management. Impressive in a demo but touches none of the nine grading categories.
- **MIDI file import/export** — binary format parsing. Correct next feature after MVP.
- **Git-style branching** — wrong mental model for live collaborative editing. Everyone is always on `main`. See [Design Thinking](./04-design-thinking.md#event-sourcing-vs-git-branching) for the full argument.
- **Mobile editing** — complex touch interaction on a grid tool. Explicitly deferred.
- **Waveform rendering** — no audio engine, so no waveform data to render.

---

*→ Next: [Design Thinking](./04-design-thinking.md)*
