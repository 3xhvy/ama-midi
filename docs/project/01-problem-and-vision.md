# Problem & Vision

← [README](../../README.md) · [Next: Actors & Use Cases →](./02-actors-and-use-cases.md)

---

## Why This Problem Exists

Amanotes builds music-based games. Their creative output — a song, a beat map, a rhythm sequence — travels through multiple hands before it becomes a product. A composer places a note. A game developer checks whether that note aligns with a gameplay trigger. A product owner reviews the overall feel. A QA engineer verifies nothing falls outside valid ranges. Then the composer adjusts something, and the whole cycle repeats.

The status quo for most teams doing this work: export a file, email it, import it into a different tool, discover a conflict, email again.

This is a **workflow problem disguised as a tooling problem.** A new MIDI editor alone doesn't fix it — composers already have MIDI editors. What they are missing is a *shared context layer* on top of their creative work.

When I read the case study brief, my first instinct was to resist building immediately. I asked: *what is the real problem here?* The answer changed everything about how I designed the system.

The real problem is missing shared context. When a composer places a note at Track 3, Time 42.5s, no one else on the team can see it, review it, or react to it in real time. The result is slow iteration cycles, timing conflicts discovered late, and no audit trail when something goes wrong.

---

## What Makes This Hard

Three forces make this problem technically difficult in ways that don't usually appear together:

**1. Uniqueness without merge.** Most collaborative editing tools — Figma, Google Docs, Notion — handle conflicts by merging divergent changes. AMA-MIDI cannot. Two notes at the same position is not a merge problem; it's a data integrity violation. The conflict resolution has to be *rejection*, not reconciliation.

**2. Real-time with strict consistency.** Most real-time systems tolerate eventual consistency — the right state propagates eventually, and brief inconsistencies are acceptable. AMA-MIDI can't afford that. A game engine consuming the note data needs the state to be correct at any moment. The database-level unique constraint enforces this; no amount of application-layer logic can replace it.

**3. Performance with live data.** Rendering large static datasets is a solved problem. Rendering large datasets that are also changing in real time, from multiple concurrent sources, with optimistic updates that may need rollback — that's a different problem. State management has to simultaneously handle server sync, WebSocket events, and local optimistic state.

---

## Product Vision

> AMA-MIDI is a shared visual workspace where music composition and game production happen simultaneously, with full visibility, without corrupting each other's work.

The system is built to be good at three things above everything else:

**Visual clarity** — a 300-second song with 10,000 notes must be scannable, not frozen.

**Data integrity** — no two notes can exist at the same (track, time) position, even under concurrent writes.

**Real-time sync** — when one composer changes a note, every other collaborator in the same song sees it within milliseconds.

Every engineering decision in this project — from the database schema to the state management architecture to the deploy topology — traces back to one of these three properties.

---

*→ Next: [Actors & Use Cases](./02-actors-and-use-cases.md)*
