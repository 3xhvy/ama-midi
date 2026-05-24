# Repeat / Stamp Notes Design

## Goal

Add a fast deterministic charting workflow for repeating selected notes forward across time. This is a user-facing productivity feature, not an AI feature. It should let a composer select a motif once, choose a repeat count and interval, preview conflicts, and apply all repeated copies in one batch.

## Problem

The editor already has Copy To, but Copy To places one transformed copy of a selection. Building repeated sections still requires manually copying the same selection multiple times and adjusting the destination each time. That is slow for common rhythm-charting work such as measure loops, chorus motifs, repeated pulses, and structured lane patterns.

Repeat / Stamp differs from Copy To by creating multiple placements from one action:

```text
Selected notes: 1.0s, 1.5s, 2.0s
Copy To +4.0s: 5.0s, 5.5s, 6.0s
Repeat count 3, interval 4.0s: 5.0s, 5.5s, 6.0s; 9.0s, 9.5s, 10.0s; 13.0s, 13.5s, 14.0s
```

## Scope

In scope:

- Repeat selected notes directly from the multi-select bar.
- Create repeated copies only. Moving repeated selections is out of scope.
- Support fixed interval repetition in seconds.
- Provide quick interval helpers for one beat, one measure, and selection length.
- Reuse existing conflict preview, conflict resolution, batch apply, realtime events, and chart analysis flow.

Out of scope:

- LLM generation or suggestions.
- Saved-pattern-only repeat workflows.
- Drawing/stamping with pointer drag.
- Per-repeat transformations such as lane rotation, velocity curves, or increasing density.
- Repeating across sections by semantic labels.

## UX

When the user selects two or more notes, the multi-select bar shows a `Repeat` action alongside existing actions.

Clicking `Repeat` opens a focused modal:

- `Copies`: number of repeated copies to create. Default `3`. Minimum `1`.
- `Interval`: time between each repeated copy in seconds.
- Quick actions:
  - `1 beat`: `60 / bpm` seconds.
  - `1 measure`: `measureDuration(bpm, timeSignature)` seconds.
  - `Selection length`: last selected note time minus first selected note time, snapped to one decimal.
- Summary text: `Creates X notes over Y repeats`.

The primary button is `Validate`. Validation creates a normal `NoteCopyPreview` and routes into the same preview/apply state used by Copy To. When conflicts exist, the existing conflict review modal shows conflict choices. When there are no conflicts, the preview state can apply immediately through the existing confirmation path. Existing notes are preserved by default; users can choose to replace conflicting notes using the current conflict UI.

After successful apply, show a toast such as:

```text
Repeated 24 notes, replaced 0, skipped 2
```

Selection should clear after apply, matching Copy To behavior.

## Architecture

Implement Repeat / Stamp by extending the existing note copy pipeline rather than creating a separate backend service.

Shared types:

- Add `REPEAT_INTERVAL` to `NoteCopyTransformMode`.
- Add optional request fields to `NoteCopyPreviewRequest`:
  - `repeatCount?: number`
  - `repeatInterval?: number`

Backend:

- Extend `NoteCopyPreviewDto` and `NoteCopyApplyDto` validation for `REPEAT_INTERVAL`.
- Extend `NoteCopyService.computeTransformedSlots()` to expand each selected note into repeated destination slots.
- For repeat `i`, where `i` is 1-based:
  - `destination.time = snapTime(source.time + repeatInterval * i)`
  - `destination.track = source.track`
- Keep `operation` fixed to `COPY` for the frontend Repeat entry point. The backend should reject `MOVE + REPEAT_INTERVAL` unless there is a clear future product requirement.
- Include `repeatCount` and `repeatInterval` in `buildSelectionVersion()` so stale previews are detected correctly.
- Reuse `classifySlots()` for internal collisions and existing-note conflicts.
- Reuse the existing transaction, event emission, and `ChartAnalyzeService.run()` after apply.

Frontend:

- Add `onRepeat` to `MultiSelectBar` props and render a `Repeat` button for editable charts.
- Add a dedicated `RepeatModal` rather than expanding `CopyToModal`. This keeps Copy To focused and avoids making a dense modal harder to understand.
- Reuse `usePreviewNoteCopy()` and `useApplyNoteCopy()`.
- Reuse the existing `NoteCopyPreview`, conflict resolution state, and `ConflictReviewModal` path in `EditorPage`.
- Add `repeat-transform.ts` beside existing copy transform helpers for repeat defaults, interval formatting, and validation.

## Data Flow

1. User selects notes.
2. User clicks `Repeat`.
3. Frontend opens `RepeatModal` with defaults derived from selected notes and song timing.
4. User validates.
5. Frontend posts:

```ts
{
  noteIds,
  operation: 'COPY',
  mode: 'REPEAT_INTERVAL',
  repeatCount,
  repeatInterval
}
```

6. Backend returns a normal `NoteCopyPreview`.
7. User reviews conflicts using the existing review UI.
8. Frontend posts `copy-apply` with `selectionVersion` and resolutions.
9. Backend creates accepted repeated notes in one transaction and emits one batch event.
10. Frontend clears modal state and selection.

## Validation And Error Handling

Frontend validation:

- `repeatCount` must be an integer >= 1.
- Generated note count must not exceed the backend cap. The existing cap is 500 selected/generated slots.
- `repeatInterval` must be positive.
- Show a clear inline error if generated copies would exceed the cap.

Backend validation:

- Reject `REPEAT_INTERVAL` without `repeatCount` and `repeatInterval`.
- Reject `repeatCount < 1`.
- Reject `repeatInterval <= 0`.
- Reject generated slot count above the existing copy cap.
- Reject destination notes outside `TIME_MIN` and `TIME_MAX`.
- Reject repeated HOLD notes whose end time exceeds `TIME_MAX`.
- Reject internal collisions through existing `classifySlots()` behavior.
- Return conflict previews for occupied destination slots through existing behavior.

## Testing

Backend unit tests for `NoteCopyService`:

- Repeats selected notes by count and interval.
- Preserves track and note metadata.
- Detects conflicts with existing notes.
- Rejects repeats outside the time range.
- Rejects excessive generated slots.
- Includes repeat parameters in `selectionVersion`.
- Rejects `MOVE + REPEAT_INTERVAL`.

Frontend tests:

- `RepeatModal` builds the expected preview request.
- Count and interval validation block invalid inputs.
- Quick interval actions compute expected values from BPM and time signature.
- Existing conflict review path can apply a repeat preview.

## Rollout

This feature is safe to ship behind the normal editable-chart permissions. It does not add external dependencies, AI cost, or model latency. The main risk is request shape drift between shared types, DTO validation, and frontend modal payloads, so tests should cover both request construction and backend validation.
