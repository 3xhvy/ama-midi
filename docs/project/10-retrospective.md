# Retrospective

← [README](../../README.md) · [← Deploy Pipeline](./09-deploy.md)

---

## What I'd Do Differently With More Time

Being honest about what's incomplete is part of showing engineering judgment. These aren't failures — they're deliberate scope decisions. Each one has a clear implementation path if priorities change.

---

### Cursor Presence on the Grid

When Composer B is hovering over the grid, Composer A should see their cursor — a small labeled dot moving in real time, like Figma's collaboration mode. This is the feature that makes collaboration feel most *alive*.

It requires broadcasting `mousemove` events via WebSocket, throttled to ~30fps to avoid flooding. The backend is trivially simple. The frontend renders remote cursors as absolutely-positioned overlays outside the virtualized note list. I deprioritized it because it sits outside the nine grading categories, not because it's technically hard.

---

### Conflict Negotiation Instead of Silent Rejection

The current conflict handling: position is taken → note disappears → toast. The composer loses.

A richer model: when a conflict occurs, show the losing composer a side-by-side comparison — "your note" vs "the note already there" — and suggest adjacent positions automatically. The conflict becomes a collaboration negotiation rather than a silent rejection.

This is a meaningful product improvement. It requires a dedicated conflict resolution UI component and a backend endpoint that returns nearby available positions given a (track, time) coordinate.

---

### Visual-Only Playback

I cut audio playback because a full MIDI synthesis engine (Tone.js) is substantial work that doesn't touch any grading criteria. But a *visual-only* playback — a moving playhead that traverses the 300-second timeline, highlighting each note as it passes — would make the product significantly more communicative in a demo. No audio context, no synthesis, no timing complexity beyond `requestAnimationFrame`. The oversight was treating "audio playback" as an all-or-nothing feature when a visual-only version would deliver most of the value.

---

### Export to Game Engine Format

The end goal of AMA-MIDI is to produce data that goes into a game. The logical final step — a button that exports the note sequence as a structured JSON manifest ready for the game engine — closes the production loop. Without it, the tool is a collaboration workspace with a manual final step.

This is a single endpoint (`GET /songs/:id/export`) and a download trigger in the UI. It's the next feature after MVP, and it would make AMA-MIDI a complete production tool rather than a prototype.

---

## Why This Problem Is Genuinely Hard

Most system design problems are hard in one dimension — performance, scale, or consistency. AMA-MIDI is hard in three dimensions simultaneously, and they interact.

**Integrity without merge.** Google Docs and Figma resolve conflicts by merging divergent changes. AMA-MIDI cannot — two notes at the same position is a data integrity violation, not a divergence to reconcile. Conflict handling must be *rejection at the database level*, enforced atomically, with no possibility of both writes succeeding. This is fundamentally different from operational transformation or CRDT-based conflict resolution.

**Real-time with no eventual consistency.** Most real-time systems (social feeds, analytics dashboards, notification streams) tolerate brief inconsistency — the right state propagates eventually. AMA-MIDI cannot. A game developer reading the note sequence at any moment needs it to be authoritative. The database constraint, the WebSocket broadcast, and the optimistic rollback all exist to maintain this property continuously, not eventually.

**Performance with live, rollback-capable state.** Rendering 10,000 static notes is a solved problem. Rendering 10,000 notes that are simultaneously changing from multiple concurrent sources, with local optimistic additions that may need to be removed, using a state model that merges server responses and WebSocket events without double-rendering — that requires careful coordination between TanStack Query's cache, Zustand's editor state, and the Socket.io event stream. None of the three can be designed independently.

These three tensions — uniqueness without merge, strict consistency in real-time, performance with mutable live data — are what make AMA-MIDI a genuinely interesting system design problem, not a CRUD application with a WebSocket bolted on.

---

## Closing Statement

I'm more proud of the thinking that went into AMA-MIDI than the code itself. The code is an expression of a product vision. The product vision is that cross-functional teams at music game companies deserve internal tools as well-designed as the games they ship.

Every decision in this project — the database-level constraint instead of an application check, the event-sourced ledger instead of a version table, the modular monolith instead of microservices, the optimistic UI instead of server-wait — was made by understanding the problem before reaching for a solution.

That's the practice I bring to every system I build.
