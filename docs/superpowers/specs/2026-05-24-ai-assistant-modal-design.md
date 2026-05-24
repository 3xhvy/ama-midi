# AI Assistant Modal Design

## Goal

Replace the fragmented AI editor UX (dropdown menu, separate modals, toast-only loading, floating continue-pattern action) with one popup-driven **AI Assistant**. The assistant opens from the toolbar, shows a wizard-style feature picker (icon + title + description, like Create Song), runs each AI action in its own sub-flow, and displays a **step-by-step progress tree** while work is in progress. Suggestion-based features also gain **global chart understanding** (sections, density segments, chart totals) so the model calibrates locally to the whole chart, not just a narrow playhead window.

## Product Decisions

1. **One modal, many flows** — Single `AiAssistantModal` with internal navigation: picker → configure → processing → result.
2. **Toolbar AI button** — Clicking **AI** opens the modal on the feature picker. The current dropdown and separate `AiGenerateChartModal` / `AiScaleChartModal` are removed.
3. **Improve pattern** replaces **Continue pattern** — Multi-select bar deep-links into the Improve flow (skips picker). Inside Improve, user chooses **Extend** or **Refine** before running.
4. **Progress in the modal** — No toast-only loading for AI runs. A vertical step tree shows current phase until preview/suggestions are ready.
5. **Preview models unchanged** — Generate and Scale still use `ChartPreviewState` + `ChartPreviewBar`. Fill track and Improve still use ghost suggestions on the grid via `AiSuggestions`.
6. **Backend scope** — Extend `suggestNotes` with global context and a new `refine_pattern` mode. Generate and Scale endpoints unchanged (already chart-aware).

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

### Progress timing

Version 1 uses **client-orchestrated steps** around a single API call:

- Steps 1–2 advance immediately when the request starts (reflect server-side work conceptually).
- Step 3 stays **active** until the HTTP response returns.
- Steps 4–5 advance on response; then transition to result state.

No SSE or streaming in v1. Step labels set user expectations during the 2–15s LLM wait.

On error, mark current step `error`, show message + **Try again** / **Back**.

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
  ai-assistant.types.ts      # AiFeature, AiPhase, ProgressStep
  useAiAssistantRun.ts       # shared hook: run API + advance steps
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
User picks feature → configure form → useAiAssistantRun.start()
  → advance steps 1–2 (immediate)
  → POST /songs/:id/generate-chart | scale-chart | suggest-notes
  → advance steps 4–5
  → branch:
      generate/scale → setChartPreview → close modal
      fill/improve   → setAiSuggestions → show result step → Done → close
```

`suggest-notes` body includes new optional `instruction?: string` (max 2000) for fill and improve flows.

## Error Handling

| Case | UX |
|---|---|
| 403 VIEWER | Toast + close modal |
| 400 validation | Inline error on form |
| Empty suggestions | Result step: “No suggestions — try different instruction” + Back |
| 409 on accept (ghost) | Existing toast on individual accept |
| Network / 5xx | Progress tree error state + Try again |

Disable primary buttons while `processing`. Closing modal during processing cancels UI state only (request may still complete; ignore stale response via run id).

## Testing

**API**

- `suggestNotes` includes section + segment lines in prompt when data exists (mock prisma + fake LLM).
- `refine_pattern` rejects <2 selected notes.
- Refine post-process allows replacement at selected times.

**Web**

- Picker disables Scale when noteCount=0.
- Deep-link from multi-select opens Improve without picker.
- Progress tree advances through done on mocked fast API.
- Generate flow still sets chartPreview.

## Out of Scope (v1)

- Server-sent progress events / streaming
- Region-only scale or generate
- Saving AI output as a new chart variant
- Improve pattern without selection (picker-only entry requires selection)
- Replacing `ChartPreviewBar` with in-modal apply

## Migration Checklist

1. Add backend global context + `refine_pattern` + optional `instruction` on suggest DTO.
2. Build `AiAssistantModal` shell + picker + progress tree.
3. Port generate/scale forms into flows.
4. Port fill track + improve flows; wire `AiSuggestions` to store.
5. Replace toolbar + multi-select entry points; delete old modals/menu.
6. Update tour copy and tests.
