# Actors & Use Cases

← [README](../../README.md) · [← Problem & Vision](./01-problem-and-vision.md) · [Features →](./03-features.md)

---

## The Four Actors

I identified four distinct users before writing a single line of code. The non-obvious insight is that all four of them need the *same data* presented through a *different lens*. One product, four views.

---

### Composer / Sound Designer

**Core need:** Place and adjust notes quickly, without the tool interrupting their flow state.

A composer is translating internal music into note placements. Every friction point — a dialog box that interrupts, a save button, a lag between placing a note and seeing it — breaks the creative state. This is why **Fast Mode** is the default interaction model: click the grid, note appears instantly, no dialog. The composer places thirty notes in thirty seconds without the application getting in the way.

Making a form the default would treat a musician like a data entry clerk. The composer knows the note's position from where they clicked. Color and title can wait.

**Key use cases:**
- Click grid to place note at exact (track, time) position
- Toggle to Popup Mode for full note metadata when needed
- See other collaborators' notes appear in real time
- Undo the last action via compensating event
- Accept or dismiss AI-suggested ghost notes

---

### Game Developer

**Core need:** Verify exact timing alignment before integrating the note sequence into the game engine.

The game developer doesn't compose. They review. They need precise coordinates — Track 3, 42.5 seconds — to verify alignment with game trigger events. This is why **Developer View** surfaces raw identifiers and precise timestamps on hover. A developer opening the editor shouldn't wade through the composer's UX to reach the data they need.

**Key use cases:**
- Inspect note coordinates (track, time, ID) at a glance
- Browse the event ledger to see what changed and when
- Verify no boundary violations exist before integration
- Read-only presence in a session without disrupting composers

---

### Product Owner / Game Producer

**Core need:** Review song structure and give feedback without needing music software expertise.

The product owner is the most overlooked user in most internal tools. They can't read a traditional DAW. They have opinions about song structure but no technical vocabulary to express them in existing tools. AMA-MIDI's song list page — with mini track activity visualizations on each card — is designed for this person. They open a browser tab and understand at a glance whether a song is sparse or dense, which tracks are active, whether it looks finished.

**Key use cases:**
- Browse all songs and see high-level activity summaries
- Open the editor in read-only mode to review note layout
- Understand song density and track distribution visually
- Leave timeline comments at specific positions (P2 feature)

---

### QA / Game Tester

**Core need:** Catch boundary violations, duplicates, and structural errors systematically.

QA needs the system to do their job for them — surface boundary violations, flag notes suspiciously close together, identify empty gaps that might be accidental. **QA View** transforms the editor from a creative tool into an audit tool, automatically highlighting anything outside valid ranges.

**Key use cases:**
- Scan all notes for boundary violations (track > 8, time > 300s)
- Flag positions with near-duplicate notes (within 0.1s on the same track)
- Browse the change history to trace who did what
- Verify the unique constraint is enforced under concurrent write tests

---

## Permission Matrix

| Action | Admin | Composer | Developer | Reviewer | Viewer |
|---|:---:|:---:|:---:|:---:|:---:|
| Create / edit song | ✓ | ✓ | — | — | — |
| Archive song | ✓ | Owner only | — | — | — |
| View song | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create / edit note | ✓ | ✓ | — | — | — |
| Delete note | ✓ | ✓ | — | — | — |
| View change history | ✓ | ✓ | ✓ | ✓ | — |
| Manage users | ✓ | — | — | — | — |

Viewer routes enforce read-only at both the API guard level (`@Roles()` decorator on NestJS controllers) and the UI level (`useCanEdit()` hook disables interactive elements). A read-only user cannot accidentally destroy data they're reviewing.

---

*→ Next: [Feature Hierarchy](./03-features.md)*
