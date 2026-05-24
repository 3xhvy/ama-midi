# Key Trade-offs

← [README](../../README.md) · [← Workflows](./06-workflows.md) · [Project Structure →](./08-project-structure.md)

---

Every architectural decision is a trade-off. This table makes the trade-offs explicit — what was gained, what was given up, and why the balance was right for this context.

---

## Decision Summary Table


| Decision                   | Chose                      | Rejected              | What Was Gained                                         | What Was Given Up                                              |
| -------------------------- | -------------------------- | --------------------- | ------------------------------------------------------- | -------------------------------------------------------------- |
| **Deployment topology**    | Modular monolith           | Microservices         | Fast build, single deploy unit, clean module boundaries | Independent service scaling, team autonomy at scale            |
| **Conflict enforcement**   | DB unique constraint       | App-level pre-check   | Atomic race condition safety                            | Richer pre-validation error messages                           |
| **Change history model**   | Event sourcing (ledger)    | Git-style branching   | Simple undo, full audit trail, no locking               | Branch-based experimental versions                             |
| **Note rendering**         | DOM virtualization         | Canvas                | Browser event model, accessibility, hover/click         | Raw rendering ceiling (canvas handles more elements)           |
| **UI feedback model**      | Optimistic UI              | Server-wait           | Instant feel, composer flow state preserved             | More complex rollback state management                         |
| **Time resolution**        | 0.1s snap                  | Millisecond precision | Perceptually clean constraints, no overlapping notes    | Ultra-fine timing (not needed for game soundtrack prototyping) |
| **State management split** | TanStack Query + Zustand   | Redux / single store  | Server state and client state managed by best-fit tool  | Single store mental model, one devtools view                   |
| **Auth strategy**          | Google OAuth SSO           | Username/password     | IT-controlled access, no password management liability  | Dependency on Google Workspace availability                    |
| **Shared types**           | `packages/shared` monorepo | Duplicated types      | Compile-time sync between API and frontend types        | Extra build pipeline step for the shared package               |
| **Zoom as global state**   | Zustand atom               | Component-local state | Note positions and fetch window always in sync          | Slightly more state lifted than strictly necessary             |


---

## The Three Hardest Trade-offs

### 1. Event Sourcing Undo vs Per-User Isolation

My undo model logs a compensating event against the current user's last action. Edge case: User A creates a note, User B deletes it, User A clicks Undo.

User A's undo logic finds the last `NOTE_CREATED` event by User A and tries to delete the note — but it no longer exists. Throwing an error here would be confusing.

The decision: gracefully detect `{ alreadyDeleted: true }`, log the undo attempt to the ledger, show a friendly message ("That note was already removed by a collaborator"), and do nothing. The system remains consistent. No crash, no phantom operation.

A more sophisticated model would track undo stacks per user with awareness of concurrent mutations. The simpler model is correct for MVP and honest about its limitations.

### 2. Optimistic UI Rollback Visibility

Optimistic UI makes the editor feel instant. But when rollback happens — note disappears, toast appears — the visual change is jarring if it happens 500ms after placement. The composer has already moved their mental focus to the next note.

The decision: keep the optimistic model because flow-state interruption from server latency is worse than occasional visual rollback. Toast language makes the rollback feel like a collaboration event ("position just taken") rather than an error. The trade-off is noticeable UX friction on conflict, which is rare in practice.

### 3. Single VPS vs Managed Cloud

Railway and Vercel offer zero-ops deployment. The decision to deploy on a personal VPS with Docker Compose and GitHub Actions adds operational complexity — Nginx configuration, GHCR image management, SSH deploy keys, manual volume management.

The reason: the VPS already runs other apps (`ohomi`, `task`) behind the same Nginx and TLS configuration. Adding AMA-MIDI to the same VPS avoids provisioning new infrastructure and reuses existing wildcard TLS (`hvy-dev.uk`). Cost is also a factor — a VPS is fixed monthly cost regardless of project count.

The operational complexity is manageable because the deploy pipeline is fully automated (push → GitHub Actions → SSH → `docker compose pull && up`). Manual steps are limited to first-time VPS setup.

---

*→ Next: [Project Structure](./08-project-structure.md)*