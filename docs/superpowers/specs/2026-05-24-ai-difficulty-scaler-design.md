# AI Difficulty Scaler Design

## Goal

Add an AI-first whole-chart difficulty scaler that transforms the currently active chart into a target difficulty tier, returns a full replacement preview, and applies only when the user accepts the preview. This makes AI useful after initial chart generation by letting users iterate toward a playable tier without manually rebuilding the chart.

## Product Decision

Version 1 scales the whole chart only. It does not support selected regions, section-only edits, or saving directly as a separate chart variant. The scaler uses the same preview/apply model as AI chart generation: generate a preview, show it in the editor, and apply it to the current chart with `replaceExisting: true` only after user confirmation.

## Why This Comes Before Other AI Features

Difficulty scaling produces an artifact the user can apply immediately. That is higher practical value than a scorecard, and it extends the existing `generate_chart` flow instead of creating a disconnected diagnostic surface. It also creates reusable AI infrastructure needed by later features such as density advice, quality scoring, and region regeneration.

## Prerequisite: LLM Adapter

Before adding scaler-specific prompts, extract direct Anthropic usage behind an injected adapter.

Create a small AI provider boundary:

```ts
export interface LLMMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface LLMAdapter {
  complete(opts: {
    system: string
    messages: LLMMessage[]
    maxTokens: number
  }): Promise<string>
}
```

Initial implementation:

- `AnthropicAdapter`: current production behavior.
- Provider token: `LLM_ADAPTER`.
- `AiService` and `AiChartService` inject the adapter instead of constructing `new Anthropic(...)`.

Out of scope for this feature:

- Ollama adapter.
- OpenAI-compatible adapter.
- Streaming.
- Retry/backoff framework.

Those can be added once the boundary exists.

## User Flow

1. User opens the AI menu in the editor.
2. User chooses `Scale difficulty`.
3. Modal asks for:
   - Target tier: `EASY`, `NORMAL`, `HARD`, `EXPERT`, `MASTER`.
   - Optional instruction: free-text guidance such as `keep chorus energetic`, `reduce doubles`, or `add more holds`.
4. User clicks `Generate preview`.
5. Backend loads the active chart, notes, section markers, song metadata, and current analysis.
6. LLM returns a full replacement chart JSON.
7. Backend normalizes notes and sections.
8. Frontend stores the result in `ChartPreviewState` with `replaceExisting: true`.
9. Existing `ChartPreviewBar` lets user dismiss or apply.
10. Existing apply endpoint replaces current notes and section markers only after accept.

## API

Add endpoint:

```ts
POST /songs/:songId/scale-chart
```

Request:

```ts
interface ScaleChartRequest {
  chartId: string
  targetTier: SongDifficulty
  instruction?: string
  snapMode: SnapMode
}
```

Response reuses existing chart preview response:

```ts
interface GenerateChartResponse {
  notes: GeneratedChartNote[]
  sections: GeneratedChartSection[]
}
```

Frontend apply continues using:

```ts
POST /songs/:songId/apply-chart
```

with:

```ts
{
  chartId,
  notes: preview.notes,
  sections: preview.sections,
  replaceExisting: true
}
```

## Backend Design

Add `AiChartService.scaleChart(songId, userRole, body)`.

Behavior:

- Reject `VIEWER`.
- Validate `chartId` belongs to `songId`.
- Load song metadata.
- Load active chart metadata: name, speed multiplier, computed difficulty, scores.
- Load all non-deleted notes sorted by time and track.
- Load existing section markers sorted by time.
- Load or compute current chart analysis. Prefer existing persisted analysis when available; compute fresh if no segments exist.
- Reject empty charts because there is nothing to scale. Users should use `generate_chart` first.
- Build prompt with source notes, sections, analysis summary, target tier, and instruction.
- Call `llm.complete()`.
- Parse JSON and normalize through the same note/section normalization path used by `generateChart()`.
- Return `{ notes, sections }`.

Reuse existing constants:

- `MAX_GENERATED_NOTES = 150`.
- `TARGET_NOTE_COUNT` for tier note-count targets.
- `snapTime()` for quantization.
- `NOTE_TYPES` validation.

## Prompt Contract

System prompt:

- The model is a rhythm-game chart arranger for AMA-MIDI.
- Charts use 8 lanes, 0-300s timeline.
- Return only valid JSON with keys `notes` and `sections`.
- Returned chart is a full replacement, not a patch.

User prompt includes:

- Song: name, BPM, time signature, category.
- Source chart: current computed difficulty, average score, peak score, speed multiplier.
- Current notes as compact JSON: `track`, `time`, `noteType`, `duration`, `title`.
- Current sections as compact JSON.
- Analysis segments summarized by 5s window: start, end, notes/sec, difficulty level, score.
- Current warnings.
- Target tier and target note count.
- Optional instruction.

Constraints:

- Preserve recognizable timing motifs and song structure.
- Scale density and note complexity toward target tier.
- Easier targets should thin density, reduce large lane jumps, reduce doubles/triples, and simplify holds.
- Harder targets may add notes, doubles, holds, and syncopation while preserving musical feel.
- Keep all times snapped to requested snap grid.
- Avoid duplicate `track + time` pairs.
- Keep total notes at or below 150 for v1.
- Return 3-6 useful section markers when applicable.

## Frontend Design

Add `Scale difficulty` to the existing AI menu.

Create `AiScaleChartModal` with:

- Target tier select.
- Optional instruction textarea.
- Clear warning copy: `Preview will replace the current chart only if you accept it.`
- Submit button: `Generate preview`.

On success:

```ts
setChartPreview({
  notes: result.notes,
  sections: result.sections,
  replaceExisting: true,
})
```

The existing `ChartPreviewBar` remains the apply/dismiss surface. No new diff UI is required for v1.

## Error Handling

Frontend:

- Disable submit if no chart is selected.
- Disable submit if no target tier is selected.
- Show `AI returned no notes` if response has no notes.
- Show generic failure toast for API errors.

Backend:

- `403` for viewers.
- `404` for missing chart/song relationship.
- `400` for empty source chart.
- Return empty normalized notes only if the model output is invalid; frontend treats this as failed generation.
- Drop invalid notes rather than failing the whole response, matching current `generateChart()` behavior.

## Testing

Backend tests:

- `scaleChart` rejects viewers.
- `scaleChart` rejects empty source charts.
- Prompt input includes source notes, section markers, analysis, target tier, and instruction.
- LLM JSON is normalized using snap mode and note validation.
- Invalid model JSON returns an empty preview rather than throwing.
- Existing `generateChart` and `suggestNotes` continue to work through fake `LLMAdapter`.

Frontend tests:

- Scale modal blocks submit without target tier.
- Scale modal sends `chartId`, `targetTier`, `instruction`, and `snapMode`.
- Successful response sets chart preview with `replaceExisting: true`.

Build verification:

- API focused AI tests.
- Web helper/modal tests if available.
- `pnpm --dir apps/api build`.
- `pnpm --dir apps/web build`.

## Rollout

Ship behind the existing edit permission model. The feature does not directly mutate data until the existing preview apply action is accepted. The main risk is low-quality model output, so v1 must keep normalization strict and preserve the preview escape hatch.

## Future Extensions

- Save scaled output as a new chart variant.
- Scale selected sections or time ranges.
- Add model-provider selection through additional `LLMAdapter` implementations.
- Add streaming progress for long generations.
- Add before/after density comparison in the preview bar.
