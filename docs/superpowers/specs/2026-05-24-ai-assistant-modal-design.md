# AI Assistant Modal Design

## Goal

Replace the fragmented AI editor UX (dropdown menu, separate modals, toast-only loading, floating continue-pattern action) with one popup-driven **AI Assistant**. The assistant opens from the toolbar, shows a wizard-style feature picker (icon + title + description, like Create Song), runs each AI action in its own sub-flow, and displays a **step-by-step progress tree** while work is in progress. Suggestion-based features also gain **global chart understanding** (sections, density segments, chart totals) so the model calibrates locally to the whole chart, not just a narrow playhead window.

## Product Decisions

1. **One modal, many flows** — Single `AiAssistantModal` with internal navigation: picker → configure → processing → result.
2. **Toolbar AI button** — Clicking **AI** opens the modal on the feature picker. The current dropdown and separate `AiGenerateChartModal` / `AiScaleChartModal` are removed.
3. **Improve pattern** replaces **Continue pattern** — Multi-select bar deep-links into the Improve flow (skips picker). Inside Improve, user chooses **Extend** or **Refine** before running.
4. **Progress in the modal** — No toast-only loading for AI runs. A vertical step tree is driven by **server-sent progress events** (SSE) as each phase completes on the backend.
5. **Preview models unchanged** — Generate and Scale still use `ChartPreviewState` + `ChartPreviewBar`. Fill track and Improve still use ghost suggestions on the grid via `AiSuggestions`.
6. **Backend scope** — Extend `suggestNotes` with global context and a new `refine_pattern` mode. Add streaming variants for all four AI actions (generate, scale, suggest). Non-streaming POST endpoints may remain for backward compatibility but the modal uses streaming only.

## Entry Points

| Trigger | Opens modal at |
|---|---|
| Toolbar **AI** button | Feature picker |
| Multi-select bar **Improve pattern** (≥2 notes) | Improve flow → sub-mode choice (Extend / Refine), selection pre-filled |
| (Future) Keyboard shortcut | Picker |

Cards on the picker are disabled with tooltip when prerequisites fail:

| Feature | Requires |
|---|---|
| Generate chart | Always (composer role) |
| Scale difficulty | Chart has ≥1 note |
| Fill track | Chart has ≥5 notes (existing guard) |
| Improve pattern | ≥2 notes selected |

When Improve is disabled on the picker but selection exists, show helper text: “Select 2+ notes on the chart first.”

## Feature Picker UI

Mirror `StartStep` from Create Song Wizard: 2×2 grid, Radix icon, title, one-line description, selected/hover border states.

| Feature | Title | Description |
|---|---|---|
| Generate chart | Generate chart | Build a full chart from a description |
| Scale difficulty | Scale difficulty | Preview an easier or harder replacement chart |
| Fill track | Fill track | Add notes on one lane near the playhead |
| Improve pattern | Improve pattern | Extend or refine a selected note pattern |

Picker footer: **Cancel** only (no primary action until a feature is chosen — clicking a card navigates forward).

## Per-Flow Screens

### Shared navigation

Each flow has:

- **Header** — Feature title + back arrow (returns to picker unless deep-linked from multi-select; then back closes modal).
- **Body** — Flow-specific form.
- **Footer** — Cancel + primary action (`Generate preview`, `Get suggestions`, etc.).

### Generate chart

Reuse fields from current `AiGenerateChartModal`:

- Description (required)
- Target tier hint (optional)
- Replace existing checkbox when `noteCount > 0`

Primary: **Generate preview** → processing tree → on success: set `chartPreview`, close modal, `ChartPreviewBar` appears.

### Scale difficulty

Reuse fields from current `AiScaleChartModal`:

- Target tier (required)
- Optional instruction
- Amber warning: replace mode on accept

Requires `noteCount > 0`. Primary: **Generate preview**.

### Fill track

1. Track picker — 8-lane grid (from current fill sub-menu).
2. Optional instruction — short textarea, e.g. “match hi-hat groove in chorus”.
3. Context hint — “Uses playhead position and full chart structure.”

Primary: **Get suggestions** → processing → ghost notes on grid → modal result step: “4 suggestions ready on chart” + **Done**.

### Improve pattern

**Step A — Sub-mode** (always shown unless deep-linked with remembered choice):

| Sub-mode | Title | Description |
|---|---|---|
| Extend | Extend forward | Add ~4 notes continuing the rhythm after the selection |
| Refine | Refine selection | Rewrite the selected notes — fix spacing, density, or lane choices |

**Step B — Configure**

- Read-only summary: “N notes selected · time range X–Y s · section: Chorus” (when section exists).
- Optional instruction — e.g. “add doubles”, “simplify”, “keep same lanes”.

Primary: **Get suggestions**.

**Extend** — Same backend semantics as today’s `continue_pattern`: suggestions after last selected time, preserve interval feel.

**Refine** — New `refine_pattern` mode: model returns up to N suggestions (same count as selection, max 8) that **replace or adjust** the selected pattern. Times may shift slightly within the selection window; post-process must not collide with occupied slots outside the replacement set.

## Progress Tree UI

Shared component: `AiProgressTree`.

Vertical list with states: `pending` | `active` | `done` | `error`.

```
✓ Prepare chart data
✓ Analyze structure
● Generate with AI        ← active (spinner)
○ Normalize results
○ Ready to preview
```

### Step definitions per feature

**Generate chart**

1. Prepare request
2. Generate with AI
3. Normalize chart
4. Ready to preview

**Scale difficulty**

1. Load chart & analysis
2. Build scale prompt
3. Generate with AI
4. Normalize chart
5. Ready to preview

**Fill track / Improve (Extend or Refine)**

1. Load chart context
2. Analyze sections & density
3. Generate suggestions
4. Validate placements
5. Ready — view on chart

### Progress timing — server-driven SSE

Version 1 uses **real streaming progress** from the API. The modal does not simulate steps on a timer.

Each AI run opens a **POST** request that returns `Content-Type: text/event-stream`. The server emits one SSE `data:` line per event as work advances. The final event is either `result` (success) or `error`, then the stream closes.

**Why POST + fetch (not `EventSource`)** — JWT auth lives in the `Authorization` header; `EventSource` cannot set custom headers. The web client uses `fetch` + `ReadableStream` to parse SSE lines (same pattern as many NestJS streaming APIs).

**Why not token streaming** — Progress events reflect **pipeline phases** (load data, analyze, call LLM, normalize). LLM output remains non-streaming through `LLMAdapter.complete()` in v1; the “Generate with AI” step stays active until the full model response returns. Token-level streaming can be added later inside that step without changing the modal UI.

On error, the server emits `{ type: 'error', ... }`, marks the active step failed if applicable, and closes the stream. The modal shows **Try again** / **Back**.

Closing the modal **aborts** the fetch (`AbortController`) so the client stops reading; the server may still finish the LLM call but the client ignores late events via `runId`.

## Streaming API

### Unified stream endpoint

One entry point keeps auth, CORS, and client parsing in one place:

```
POST /songs/:songId/ai/stream
Authorization: Bearer …
Content-Type: application/json
Accept: text/event-stream
```

Request body:

```ts
type AiStreamRequest =
  | { action: 'generate-chart'; description: string; snapMode: SnapMode; targetTier?: SongDifficulty }
  | { action: 'scale-chart'; chartId: string; targetTier: SongDifficulty; instruction?: string; snapMode: SnapMode }
  | { action: 'suggest-notes'; chartId: string; mode: SuggestNotesMode; playheadTime: number; snapMode: SnapMode; targetTrack?: number; selectedNotes?: Array<{ track: number; time: number }>; instruction?: string }
```

Each variant reuses existing DTO validation rules from `GenerateChartDto`, `ScaleChartDto`, and `SuggestNotesDto`.

### Event protocol

Shared types in `packages/shared`:

```ts
export type AiStreamStepStatus = 'active' | 'done' | 'error'

export type AiStreamEvent =
  | { type: 'run'; runId: string; action: AiStreamRequest['action'] }
  | { type: 'step'; runId: string; stepId: string; label: string; status: AiStreamStepStatus; detail?: string }
  | { type: 'result'; runId: string; action: 'generate-chart'; payload: GenerateChartResponse }
  | { type: 'result'; runId: string; action: 'scale-chart'; payload: GenerateChartResponse }
  | { type: 'result'; runId: string; action: 'suggest-notes'; payload: SuggestNotesResponse }
  | { type: 'error'; runId: string; message: string; stepId?: string; code?: string }
```

Wire format (standard SSE):

```
data: {"type":"run","runId":"…","action":"scale-chart"}

data: {"type":"step","runId":"…","stepId":"load_chart","label":"Load chart & analysis","status":"active"}

data: {"type":"step","runId":"…","stepId":"load_chart","label":"Load chart & analysis","status":"done"}

…

data: {"type":"result","runId":"…","action":"scale-chart","payload":{"notes":[…],"sections":[…]}}

```

Controller sets:

- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `Connection: keep-alive`
- Flush after each `data:` line (`res.flush()` where available)

### Step catalogs (server emits these `stepId`s)

**`generate-chart`**

| stepId | Label |
|---|---|
| `prepare` | Prepare request |
| `generate` | Generate with AI |
| `normalize` | Normalize chart |
| `ready` | Ready to preview |

**`scale-chart`**

| stepId | Label |
|---|---|
| `load_chart` | Load chart & analysis |
| `build_prompt` | Build scale prompt |
| `generate` | Generate with AI |
| `normalize` | Normalize chart |
| `ready` | Ready to preview |

**`suggest-notes`** (fill track, improve extend, improve refine)

| stepId | Label |
|---|---|
| `load_context` | Load chart context |
| `analyze` | Analyze sections & density |
| `generate` | Generate suggestions |
| `validate` | Validate placements |
| `ready` | Ready — view on chart |

Services accept an optional progress callback:

```ts
type AiProgressEmitter = (event: Omit<AiStreamStepEvent, 'runId'>) => void

// Example inside scaleChart:
onProgress?.({ type: 'step', stepId: 'load_chart', label: '…', status: 'active' })
// … prisma fetches …
onProgress?.({ type: 'step', stepId: 'load_chart', label: '…', status: 'done' })
```

`AiController.streamAi()` validates body, generates `runId`, wraps the matching service call, emits events, sends `result`, closes stream. Errors map to `{ type: 'error' }` without throwing after headers are sent (catch inside stream handler).

### NestJS implementation notes

- Use `@Res({ passthrough: false })` or manual `Response` write for the stream route; do not return JSON from the same handler.
- Keep existing `POST generate-chart`, `scale-chart`, `suggest-notes` for tests/scripts; modal uses `/ai/stream` only.
- Jest tests for stream handler: collect parsed events from a mock `Response` write mock and assert step order + final result.

## Result States

| Feature | Modal result | Editor effect |
|---|---|---|
| Generate | “Preview ready — N notes” + Done | `setChartPreview({ replaceExisting })` |
| Scale | Same | `setChartPreview({ replaceExisting: true })` |
| Fill track | “N suggestions on chart” + Done | `AiSuggestions` state updated |
| Improve | Same | `AiSuggestions` state updated |

Modal closes on **Done** (or auto-close after Done with 1s delay — prefer explicit Done button in v1).

## Backend: Global Chart Context for Suggestions

Extend `AiService.suggestNotes` parallel fetches (same pattern as `scaleChart`):

```ts
const [allNotes, sections, persistedSegments] = await Promise.all([
  prisma.note.findMany(...),
  prisma.sectionMarker.findMany({ where: { songId } }),
  prisma.chartDifficultySegment.findMany({ where: { chartId } }),
])
```

If `persistedSegments` is empty, compute via shared `analyzeChart()` (same fallback as scaler).

Thread into `buildContext` / `buildPrompt`:

- **Current section** — last section marker at or before playhead (or before selection start for Improve).
- **All sections** — compact `{ time, label }[]`.
- **Density profile** — segments as `{ start, end, nps, level }[]` (cap JSON size if needed).
- **Chart totals** — note count, time span of notes.

Existing fields kept: occupied positions, local context window, target track notes, selected pattern.

## Backend: Refine Pattern Mode

Add to shared types:

```ts
export type SuggestNotesMode =
  | 'continue_pattern'   // keep for API compat; UI labels "Extend"
  | 'refine_pattern'     // new
  | 'fill_track'
```

`refine_pattern` request: same as continue — requires `selectedNotes` (≥2).

Prompt differences:

- Task: **REFINE PATTERN** — return exactly N suggestions (N = selected count, max 8) that improve the selected pattern.
- Preserve overall musical intent; adjust timing/lanes within and near the selection window.
- Do not duplicate occupied slots outside the refinement set.
- Return same JSON array shape `{ track, time }[]`.

Post-process:

- Snap times, enforce track bounds, dedupe against `occupied` (excluding selected slots being replaced).
- For refine, allow overwriting selected positions (remove selected keys from occupied before collision check).

`continue_pattern` prompt also receives global context blocks (sections, density, totals).

## Frontend Architecture

```
apps/web/src/features/editor/components/ai-assistant/
  AiAssistantModal.tsx       # shell: open, phase, feature, navigation
  AiFeaturePicker.tsx        # 2×2 grid
  AiProgressTree.tsx         # step list UI
  flows/
    GenerateChartFlow.tsx
    ScaleDifficultyFlow.tsx
    FillTrackFlow.tsx
    ImprovePatternFlow.tsx   # sub-mode + configure
  ai-assistant.types.ts      # AiFeature, AiPhase, ProgressStep, AiStreamEvent
  useAiStreamRun.ts          # fetch SSE parser + AbortController + step state
```

**State placement**

- `editor.store.ts`: `aiAssistant: { open, feature, phase, entry: 'toolbar' | 'selection' } | null`
- Or local state in `EditorPage` + callback — prefer store so `MultiSelectBar` and `Toolbar` can open without prop drilling.

**Removed / deprecated**

- `AiSuggestMenu` dropdown + nested fill popover
- `AiGenerateChartModal.tsx`, `AiScaleChartModal.tsx` (logic moves into flows)
- `triggerAiSuggest` store callback — replaced by modal-driven `handleSuggest` inside assistant or direct API from `useAiAssistantRun`
- `AiSuggestions` remains for rendering ghosts; receives suggestions via store `aiSuggestions: NoteSuggestion[]` instead of internal fetch registration

**Toolbar**

- Replace `AiSuggestMenu` with `AiAssistantTrigger` button → `setAiAssistant({ open: true, feature: null, phase: 'picker' })`

**MultiSelectBar**

- Rename button to **Improve pattern**
- `onImprovePattern` → open modal `{ feature: 'improve-pattern', phase: 'configure', entry: 'selection' }`
- Update onboarding tour string

## Data Flow

```
User picks feature → configure form → useAiStreamRun.start(body)
  → POST /songs/:id/ai/stream (Accept: text/event-stream)
  → for each SSE event:
      run   → store runId
      step  → update AiProgressTree (active / done / error)
      result→ apply payload (chartPreview | aiSuggestions) → result screen
      error → mark step, show Try again
  → AbortController on modal close / cancel
```

`suggest-notes` stream body includes optional `instruction?: string` (max 2000) for fill and improve flows.

### Web stream client

`useAiStreamRun` responsibilities:

1. Build `AiStreamRequest` from active flow + form values.
2. `fetch(url, { method: 'POST', headers: { Authorization, Accept: 'text/event-stream' }, body, signal })`.
3. Read `response.body` with `TextDecoder`, buffer incomplete lines, parse `data: ` JSON payloads.
4. Maintain `steps: Record<stepId, AiStreamStepStatus>` for `AiProgressTree`.
5. Ignore events whose `runId` ≠ current run (stale stream guard).
6. On `result`, resolve promise with typed payload; on `error`, reject with message.

Add `streamAi()` helper beside `apiClient` in `apps/web/src/features/auth/api.ts` (or dedicated `ai-stream.ts`) — do not reuse JSON-only `apiClient` for SSE bodies.

## Error Handling

| Case | UX |
|---|---|
| 403 VIEWER | Toast + close modal |
| 400 validation | Inline error on form |
| Empty suggestions | Result step: “No suggestions — try different instruction” + Back |
| 409 on accept (ghost) | Existing toast on individual accept |
| Network / stream parse error | Progress tree error + Try again |
| Stream ends without `result` | Treat as error (“Connection closed early”) |
| 403 before stream opens | JSON error response (non-SSE) → toast + close |

Disable primary buttons while `processing`. Closing modal aborts the in-flight stream (`AbortController`).

## Testing

**API**

- Stream handler emits steps in order and terminates with `result` for each action (mock LLM + mock `Response`).
- Validation errors before stream start return normal HTTP 400 JSON (no SSE body).
- `suggestNotes` includes section + segment lines in prompt when data exists.
- `refine_pattern` rejects <2 selected notes.
- Refine post-process allows replacement at selected times.

**Web**

- Picker disables Scale when noteCount=0.
- Deep-link from multi-select opens Improve without picker.
- `useAiStreamRun` parses multi-event SSE fixture and updates tree states.
- Aborting fetch clears processing state without applying stale `result`.
- Generate flow still sets chartPreview from stream `result` event.

## Out of Scope (v1)

- LLM token streaming inside the “Generate with AI” step (phase streaming only)
- Region-only scale or generate
- Saving AI output as a new chart variant
- Improve pattern without selection (picker-only entry requires selection)
- Replacing `ChartPreviewBar` with in-modal apply
- WebSocket-based progress (SSE over POST is sufficient)

## Migration Checklist

1. Add shared `AiStreamEvent` types + step ID constants.
2. Add `POST /songs/:songId/ai/stream` controller + progress emitters in `AiService` / `AiChartService`.
3. Add backend global context + `refine_pattern` + optional `instruction` on suggest DTO.
4. Add `useAiStreamRun` + SSE fetch helper on web.
5. Build `AiAssistantModal` shell + picker + `AiProgressTree` wired to stream events.
6. Port generate/scale/fill/improve forms into flows (all use stream endpoint).
7. Replace toolbar + multi-select entry points; delete old modals/menu.
8. Update tour copy and tests (stream fixtures for API + web).
