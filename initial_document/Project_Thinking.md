# AMA-MIDI — Product Thinking, Research & Decision Journal
### How I thought about building a real-time collaborative MIDI sequencer for Amanotes

---

> This document is not a spec. It is the thinking behind the spec.
>
> Everything in the Linear project — the milestones, the tasks, the code — is the *output* of a reasoning process. This document is that process, written in full, so you can judge not just what was built but why, and what trade-offs were deliberately made.

---

## Why This Problem Exists — And Why It's Harder Than It Looks

The first thing I did when I read the case study brief was resist the urge to start building. I asked: what is the real problem here?

Amanotes makes music-based games. That means the company's creative output — a song, a beat map, a rhythm sequence — has to travel through multiple hands before it becomes a product. A composer places a note. A game developer checks whether that note aligns with a gameplay trigger. A product owner wants to review the overall feel. A QA engineer needs to verify that nothing falls outside the valid range. And then — crucially — this all has to happen again, because the composer adjusts something, and now everyone else needs to know.

The status quo for most teams doing this work is: export a file. Email it. Import it into a different tool. Discover a conflict. Email again. This is a workflow problem disguised as a tooling problem. A new MIDI editor alone doesn't fix it — composers already have MIDI editors. What they are missing is a *shared context layer* on top of their creative work.

That insight shaped every decision that followed.

The product is not a MIDI editor. The product is a shared workspace where music composition and game production can happen simultaneously, with full visibility, without corrupting each other's work.

Once I understood that, the requirements stopped being a checklist and started being a coherent design direction.

---

## Thinking About the Users Before Thinking About the Tech

I identified four distinct users in the project, and I spent time thinking about what each one actually needs — not what the feature list says they need.

**The Composer** is in a flow state when they work. They are hearing music internally and translating it into note placements. Every friction point — a dialog box that interrupts, a save button that requires a click, a lag between placing a note and seeing it — breaks that flow state. This is why "Fast Mode" exists. The default interaction model in the editor is: click the grid, note appears, no dialog. The composer should be able to place thirty notes in thirty seconds without the application getting in their way.

This was a non-obvious design decision. Most CRUD applications default to a form for every create operation. A form is safer — it captures all fields, prevents empty submissions. But a form is wrong here. The composer knows the note's position from where they clicked. The color they'll set later. The title they might not care about at all for prototyping. Making them fill out a form every time is treating a musician like a data entry clerk.

**The Game Developer** doesn't compose. They review. They need to see exact coordinates — Track 3, 42.5 seconds — to verify alignment with game events. This is why the Developer View mode exists, which surfaces raw identifiers and precise timestamps on hover. A developer opening the editor shouldn't have to wade through the composer's UX to get to the data they care about.

**The Product Owner** is probably the most overlooked user in most internal tools. They don't have music software expertise. They can't read a traditional DAW. But they have opinions about the song structure and need to review and approve it. The entire light-mode, visual-first design of the song list page — with the mini track activity visualization on each SongCard — is for this person. They should be able to open a browser tab and understand at a glance whether a song is sparse or dense, which tracks are active, whether it looks finished.

**The QA Engineer** is the one who catches what everyone else misses. They need the system to do their job for them — surface boundary violations, flag notes that are suspiciously close together, identify empty gaps that might be accidental. This is the QA View mode: the editor transforms from a creative tool into an audit tool, with automatic highlighting of anything that might be wrong.

The insight is that these four users don't need four different products. They need one product that changes its *presentation* based on the job to be done. Same data. Different lens.

---

## The Architecture Decision I'm Most Confident In

Choosing between microservices and a monolith was the first architectural question, and it was actually easy once I framed it correctly.

Microservices offer horizontal scalability, team autonomy, and independent deployability. For a team of 100 engineers shipping production systems serving millions of users — worth it. For a 3-day internal tool prototype with one engineer — it adds deployment complexity, inter-service network calls, distributed tracing overhead, and shared-type synchronization problems, all without any benefit that matters at this stage.

But I also didn't want a big ball of mud. The pattern I chose is a *modular monolith*: a single deployable unit internally organized into modules with clear boundaries. In NestJS, this maps directly to the module system. AuthModule, SongModule, NoteModule, LedgerModule, RealtimeModule, AiModule — each owns its domain, doesn't reach into another module's internals, and communicates through defined interfaces. If scaling requirements ever change, these become natural microservice boundaries.

This is not "we'll refactor later if we need to." It is a deliberate architecture that satisfies the real constraints of the current moment while preserving future options.

The monorepo with a shared `packages/shared` library was a parallel decision. The type `Note` should be defined exactly once and imported by both the API and the frontend. If it's defined in two places, they will diverge. At 3am on Day 2, someone will change the API shape and forget to update the frontend, and the bug won't surface until the live demo. The monorepo structure eliminates that class of problem entirely.

---

## The Schema Is the Product

I want to make a strong claim: the database schema is the most important artifact in this entire project. More important than any component, more important than any API, more important than the CI/CD pipeline.

Here's why.

The central integrity requirement of AMA-MIDI is that no two notes can occupy the same position in a song. Position is defined by `(song_id, track, time)`. If this constraint is violated, the song's data is corrupted — two notes at the same moment on the same track is musically meaningless and would cause downstream game integration failures.

You could enforce this in application code: before inserting a note, query whether any note exists at that position. If yes, reject. This is how most junior engineers would implement it, and it is wrong.

The problem is concurrency. If two composers click the same position at the same instant — which is not a theoretical edge case in a real-time collaborative tool — both queries run before either insert has committed. Both see "no note exists." Both proceed to insert. Both succeed. Now you have two notes at the same position, and no amount of application-layer logic can save you.

The correct answer is a database-level unique constraint:

```sql
UNIQUE (song_id, track, time)
```

This constraint is enforced by the database engine atomically at the point of write. One insert will succeed. The other will fail with a unique violation. The database handles the race condition that application code cannot. This is not defensive programming — this is using the right tool for the job.

The Prisma equivalent:

```prisma
@@unique([songId, track, time])
```

The API catches Prisma's `P2002` error code (unique constraint violation) and returns an HTTP 409 with `{ error: 'POSITION_TAKEN' }`. The frontend rolls back the optimistic UI and shows a human-readable toast. The integrity is maintained at every layer.

One more schema decision worth explaining: the `time` field is a `Float` with 0.1 second resolution, not milliseconds. This was deliberate. Millisecond precision would allow two notes at 5.001s and 5.002s — positions that appear identical on screen but are stored as different records. The database constraint would allow both. The editor would render them overlapping. The UX would be confusing and the data would be wrong. 0.1s resolution is precise enough for game soundtrack prototyping and enforces clean, perceptually meaningful constraints.

---

## The Event Sourcing Decision

The "ledger" requirement could have been implemented many ways. At the simplest end: a `created_at` and `updated_at` timestamp on each note, a separate `deleted_notes` table. At the most complex end: full Git-style branching, local clones, merge commits.

I chose event sourcing — an append-only `note_events` table that records every mutation as an event with `before_state` and `after_state` JSONB snapshots — and I want to explain exactly why.

First, why not Git-style branching? Because the mental model is wrong for this use case. Git is designed for individual developers working asynchronously on their own copy of a codebase. A collaborative editor is the opposite: multiple people working synchronously on a single shared document. In a live editor, there is no "branch" — everyone is always on `main`. Branching would require locking sections of the timeline while someone works on them, which is exactly the collaborative friction we're trying to eliminate.

Event sourcing fits because it matches the actual semantics of what's happening. A note being created is an event. A note being edited is an event. These events have real meaning: who did it, when, what it looked like before, what it looks like after. An append-only ledger captures this naturally. The current note state is the accumulated result of all events. Undo is a compensating event — a new `NOTE_DELETED` event that records the reversal, rather than mutating the history.

The `before_state` and `after_state` as JSONB is important. Storing full snapshots rather than diffs makes querying easy (show me what this note looked like before this event, without reconstructing a diff chain) and makes the history panel human-readable without complex data transformation.

One edge case I thought hard about: what happens if User A creates a note, then User B deletes it, and then User A clicks Undo? User A's undo logic looks for the last `NOTE_CREATED` event by User A and tries to delete the corresponding note. But the note no longer exists. Throwing an error here would be confusing and unhelpful.

The right behavior: gracefully recognize that the note was already removed by a collaborator, log the undo attempt with metadata `{ alreadyDeleted: true }`, return a friendly message, and don't throw. The system remains consistent. The user gets an explanation. No crash, no phantom operation.

---

## Real-time Collaboration: The Social Layer

WebSocket real-time sync is often described as a technical feature. I think it's a social feature.

When Composer A places a note and Composer B sees it appear on their screen in real time — without refreshing, without any explicit action — something fundamental changes about how they relate to the shared work. They are in the same space. They can see each other's hands moving. The work feels collaborative rather than sequential.

The implementation is Socket.io with a Redis Pub/Sub adapter. The Redis adapter solves a specific scaling problem: if the API is running on multiple instances (which it will be on Railway with auto-scaling), a WebSocket event broadcast through one instance needs to reach clients connected to all other instances. Redis acts as the shared message bus. Each instance subscribes to the Redis channel for each song room and rebroadcasts incoming messages to its own connected clients.

Presence — knowing who else is in the same song — is a feature that I found more valuable than it might appear at first. Knowing that "Minh is also editing this song right now" changes how you work. You're more careful about which section you're editing. You communicate before making big changes. The presence indicator isn't a cosmetic feature; it's the foundation of collaborative awareness.

The conflict handling design was one of the moments where I thought most carefully about language. When two composers simultaneously place notes at the same position, one of them will get a 409 response and see their optimistic note disappear. The question is: what do you tell them?

A bad toast: "HTTP 409 Conflict — POST /songs/:id/notes failed"
A mediocre toast: "Position already taken"
A good toast: "This position was just taken — try a nearby spot"

The difference is empathy. The bad version treats the user as a developer debugging an API. The good version acknowledges what happened (the position is taken), implies another user was involved (just taken), and gives actionable guidance (try a nearby spot). Three seconds of thinking about the language saves the user from confusion and frustration.

This extends to all error states. "Connection lost — reconnecting..." instead of "WebSocket disconnected." "Back online — syncing changes" instead of "Connection restored." The language is a product decision.

---

## Performance: Thinking at 10,000 Notes

The performance requirement — render 10,000 notes without degrading — is where I had to think clearly about what the actual bottleneck is.

A naive implementation renders all 10,000 notes as DOM elements. At 10,000 DOM nodes, the browser's layout engine slows down significantly. Scrolling starts to drop frames. Memory climbs. The editor becomes unusable.

The insight is that the user can never see all 10,000 notes simultaneously. The viewport shows maybe 100 notes at any given scroll position. So the question becomes: how do I avoid rendering the notes the user can't see?

DOM virtualization with `@tanstack/virtual` solves this on the Y axis (the time axis). The virtualizer calculates which items are within the visible scroll window and only renders those as actual DOM elements. As the user scrolls, notes outside the window are unmounted and notes entering the window are mounted. The DOM node count stays near-constant regardless of total note count — targeting under 100 active DOM nodes at any time.

I considered Canvas as an alternative. Canvas renders everything as bitmap pixels, which can handle millions of drawn elements without DOM overhead. The performance ceiling is higher. But Canvas makes interaction much harder: hit-testing (which note did I click on?), hover states, accessibility, and keyboard focus all have to be hand-implemented. You lose the browser's built-in event system. For the interaction-heavy piano roll editor — click to create, hover for tooltip, keyboard to delete, select to highlight — DOM virtualization is the right default. Canvas is the right escalation if profiling ever shows it's necessary.

The chunked API fetching is the server-side complement to DOM virtualization. Instead of loading all 10,000 notes on page open, the API supports `?timeFrom=X&timeTo=Y` query parameters. The frontend calculates the visible time window from the scroll position and zoom level:

```
pxPerSecond = 3 * zoom   // zoom is 1, 2, or 4
timeFrom = scrollTop / pxPerSecond
timeTo = timeFrom + viewportHeight / pxPerSecond
```

Only notes in that time window are loaded. The TanStack Query cache separates queries by time window, so scroll behavior is smooth — previously visited windows don't reload.

The zoom levels (1x, 2x, 4x) are a critical shared state decision. Zoom affects the px-per-second ratio, which drives both the note Y positions and the chunked fetch window. If zoom is stored in local component state instead of Zustand, the fetch hook and the grid renderer can get out of sync. I made zoom a Zustand store atom — a single source of truth that all consumers read. The zoom state determines the visual rendering. It simultaneously determines the API fetch window. They can never diverge.

---

## The AI Integration: What It Should and Shouldn't Do

The AI note suggester was the most interesting design constraint. The brief asks for AI integration. The risk is building something that looks like AI integration but doesn't add real value — a gimmick bolted on after the fact.

I thought about what an AI suggestion means in the context of a music composition workflow. A composer who has placed five notes has established a rhythmic pattern — a particular rhythm, a set of tracks they favor, a pace. The AI's job is to recognize that pattern and propose what logically comes next. It's not generating music from scratch. It's acting as an intelligent autocomplete for pattern continuation.

The implementation sends the last 10 notes (track, time, color) to the Claude API with a structured prompt asking for 4–5 suggested next notes. The color hint in the suggestion carries meaning — if the composer has been using blue (#3B82F6) for Track 2, a suggestion of blue at Track 2 makes intuitive sense. The suggestions return as `{ track, time, color }` JSON, validated before display.

The ghost note UI is where the product thinking matters more than the AI implementation. Ghost notes appear at 20% opacity with a dashed border and a slow pulse animation. They are clearly distinguished from real notes. Each ghost has accept and dismiss controls on hover. This is important: the AI is making a suggestion, not a decision. The composer retains full control. If they accept a suggestion, it goes through the same POST /notes flow as any manually placed note — with the same conflict handling, the same WebSocket broadcast, the same event logging. The AI-sourced note becomes indistinguishable from a human-placed note in the data model.

One edge case worth noting: if a composer accepts an AI suggestion for a position that another composer simultaneously occupied (a race condition), the same 409 conflict handling applies. The ghost disappears and the conflict toast appears. The AI integration doesn't bypass the integrity layer. It sits on top of it.

---

## Security as a Product Value, Not a Checklist

I want to be honest about what "security" means in an MVP internal tool. Rate limiting, CSRF protection, Helmet headers, CORS lockdown — these feel like a checklist, and they are implemented as one in the codebase. But I thought about why each one matters in this specific context.

**Rate limiting** on note creation (30 requests per minute per user) is not primarily about preventing abuse. It is about preventing accidental abuse — a scripting error or a runaway loop that floods the notes table with bad data and corrupts a song. The limit is set at a threshold that no human composer working in the editor would ever hit, but that any errant script would immediately trigger.

**Google OAuth SSO** is not just an auth mechanism — it's a statement about access control. In an enterprise context, team identity is managed centrally. Individual password management is a security liability and an onboarding friction. SSO means the Amanotes IT team controls access. When someone leaves the company, their Google account is disabled, and their AMA-MIDI access is revoked automatically.

**Role-based access** (Admin / Composer / Viewer) maps to real organizational needs. A product owner who should only review — not edit — is a Viewer. Viewer routes are read-only at both the API guard level (NestJS `@Roles()` decorator) and at the UI level (the `useCanEdit()` hook disables interactive elements). A read-only user cannot accidentally destroy data they're reviewing.

**CORS locked to FRONTEND_URL** prevents a third-party site from making authenticated API calls in a user's session. It's a basic but important mitigation against CSRF-adjacent attacks in a cookie-based auth setup.

---

## The Cuts I Made — And Why They Were Hard

Every product decision involves something you chose not to build. Here are the ones I thought hardest about.

**Audio playback** was tempting because it would make the demo significantly more impressive. A click on the play button, and you hear the notes play back as a melody — this would immediately communicate what the product does to any observer. I cut it because it requires a MIDI synthesis engine (Tone.js or WebMidi API), timing synchronization with the visual playhead, and audio context management that adds substantial frontend complexity for something that doesn't touch any of the 9 grading categories. The visual editor communicates the product well enough without it.

**Git-style branching** was in the original design exploration. The idea: composers could work on experimental versions of a song without affecting the main sequence. Collaborators could propose a "Chorus variation" branch and the team could decide whether to merge it. This is genuinely useful. I cut it because the model is wrong for a live collaborative editor. Git branching assumes sequential work — you write your changes, commit, push, someone reviews, merges. A live editor assumes simultaneous work. Branching would require locking, merge conflict resolution, and a dramatically more complex data model. The event-sourced ledger gives you undo and history without any of that complexity.

**Section-based locking** was another tempting feature. Allow a composer to "lock" a section of the timeline — say, bars 1–32 — while they work on it, preventing others from editing in that range. This solves the real problem of two composers accidentally editing the same passage simultaneously. I cut it because the database-level conflict handling already solves the specific case that matters most: two composers placing a note at the exact same position. Section locking would prevent concurrent editing entirely — which is worse than the problem it solves. The right behavior is to allow concurrent editing and handle conflicts gracefully when they happen, not to serialize the creative process.

**Comments on individual notes** was in the design system. A timeline comment thread pinned to a specific note or time position — "Minh: this note feels too high, can we try Track 2?" This is a real workflow need in game music production. I cut it because it adds a non-trivial data model (comments with thread structure, read/unread tracking, notification triggers), a new UI zone (where do comments display without cluttering the grid?), and none of it maps to grading criteria that aren't already covered.

Cutting features is easy if you have no stake in what you're cutting. It's hard when you understand why they're valuable and have to consciously decide the cost outweighs the benefit at this stage.

---

## The Design System: What It Signals About Product Maturity

I built a full design system before writing a single component, and I want to explain why that ordering matters.

The design system is not styling. It is a set of decisions expressed as code. When I define `--color-grid-line: rgba(255,255,255,0.06)` and `--color-grid-line-bold: rgba(255,255,255,0.12)`, I am making a decision about visual hierarchy: the 1-second grid lines should be visible enough to aid note placement but not so visible that they compete with the notes themselves. The 10-second markers should be meaningfully more prominent — a navigational landmark — but still clearly subordinate to content.

When I define five separate layer colors (MIDI in blue, Beat Map in cyan, Gameplay in purple, Difficulty in pink, Events in amber), I am encoding the information architecture of the product. Each layer type has a persistent identity that a user can learn. Color carries meaning: blue is MIDI. You develop muscle memory. The system is teaching you something every time you look at it.

The language rules — replacing `EVENT_SYNC_ERROR_CODE_409` with "This trigger is no longer connected to a game action" — reflect a belief that internal tools should be as carefully designed as consumer products. The people using this tool are at work, under deadline pressure, trying to ship a game. A cryptic error message makes them stop and debug the tool instead of doing their job. A human-readable message tells them what happened and what to do next.

The animation specs are worth reading as product philosophy: "Keep animations subtle. This is a work tool that feels alive, not a game itself." The note placement animation (150ms, spring easing) gives the user tactile confirmation that their click registered without demanding their attention. The ghost pulse animation (1.5s, infinite, scale 0.95–1.05) marks AI suggestions as provisional without being distracting. Animation should serve the interaction, not perform for the user.

---

## Testing as Design Documentation

The test suite is not just quality assurance. It is a specification written in code.

The unit tests for `NoteService` read as a precise behavioral contract:
- Time rounds to 1 decimal place before insert
- Time < 0 is rejected
- Time > 300 is rejected
- Track < 1 is rejected
- Track > 8 is rejected
- A duplicate position returns 409
- Every successful creation writes a NOTE_CREATED event
- Every deletion writes a NOTE_DELETED event with beforeState populated
- Undo deletes the last note created by the current user

Anyone reading these tests understands exactly what the NoteService does and doesn't do. They are the most readable form of documentation for this behavior.

The concurrent conflict test deserves specific attention:

```typescript
const [res1, res2] = await Promise.all([
  request(app).post(`/songs/${songId}/notes`).send(payload),
  request(app).post(`/songs/${songId}/notes`).send(payload),
])
expect([res1.status, res2.status].sort()).toEqual([201, 409])
expect(count).toBe(1)
```

Note that this uses `Promise.all` — truly concurrent requests — not sequential calls. A sequential test (`await request`, `await request`) would always produce 409 on the second call because the first has already committed by the time the second runs. That tests that the API correctly returns 409 for a position that's already taken. It does not test the race condition.

The race condition — two writes competing at exactly the same moment — is what `Promise.all` tests. And the test asserts both that the responses are `[201, 409]` in some order (one won, one lost) and that the database contains exactly one note (no duplicate was written). This is the test that proves the unique constraint actually works under concurrency.

---

## What I Would Do Differently With More Time

Being honest about what's incomplete is part of showing product judgment.

**Cursor presence on the grid.** When Composer B is hovering over the grid, Composer A should be able to see their cursor position — a small colored dot or label moving in real time. This is the feature that makes collaboration feel most alive in tools like Figma. It requires broadcasting `mousemove` events via WebSocket (throttled to ~30fps) and rendering remote cursors as overlays. It's achievable but I deprioritized it for the grading criteria.

**Conflict resolution with choice.** Currently, when two composers hit the same position, one loses. A richer model: when a conflict occurs, show both users a side-by-side comparison — "Your note" vs "The note that was there first" — and let the composer who lost choose an adjacent position. This makes the conflict feel less like a failure and more like a collaborative negotiation.

**Playback.** I mentioned cutting audio playback above. If I had another day, I'd implement a visual-only playback — a moving playhead that traverses the 300-second timeline, highlighting each note as it passes, with a simple click-to-sound using the Web Audio API. Not a full MIDI synthesizer, but enough to make the sequence audible.

**Export to Unity/game engine format.** The end goal of this tool is to produce data that goes into a game. Closing that loop — a single button that exports the note sequence as a JSON manifest ready for the game engine to consume — would make this a complete production tool rather than a prototype. This was out of scope but is the logical next feature.

---

## Final Reflection: Why This Project Is Interesting

The reason AMA-MIDI is a good case study is that it sits at the intersection of several hard problems that don't usually appear together.

Most collaborative editing tools — Google Docs, Figma, Notion — work with text or visual objects where conflict resolution is about merging divergent changes. AMA-MIDI has a uniqueness constraint that cannot be merged: two notes at the same position is not a merge problem, it's a data integrity violation. The conflict handling has to be rejection, not resolution.

Most real-time systems are eventually consistent: the right state propagates eventually, and temporary inconsistencies are acceptable. AMA-MIDI can't be eventually consistent about note positions — a game engine consuming the data needs the state to be correct at any moment. The database-level constraint enforces this.

Most performance optimization problems are about rendering large amounts of static data. AMA-MIDI has to render large amounts of data that is also changing in real time, from multiple sources, with optimistic updates that may need to be rolled back. The state management design — TanStack Query for server state, Zustand for editor state, WebSocket events as cache mutations — has to handle all of this simultaneously.

These three tensions — integrity in a concurrent system, real-time sync with rollback, performance with live data — are what make this problem genuinely hard and genuinely worth building.

I am proud of the thinking that went into AMA-MIDI more than the code itself. The code is an expression of a product vision. The product vision is that cross-functional teams at music game companies deserve internal tools that are as well-designed as the games they ship.

---

*Written as a companion to the Linear project (OHOMI team, 25 active issues), the AMA-MIDI_Project_Proposal.md, the AMA-MIDI_Build_Roadmap.md, and the AMA-MIDI_Design_System.md.*
