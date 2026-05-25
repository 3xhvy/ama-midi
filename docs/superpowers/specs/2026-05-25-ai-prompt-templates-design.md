# AI Prompt Templates Design

## Goal

Add **curated default prompt templates** to all four AI Assistant flows so composers can start from a sensible brief instead of a blank textarea. Templates appear as a **chip row** above each flow’s text field. Clicking a chip fills the field and may show a **non-binding hint** about related settings — it never auto-changes tier, track, or checkbox state.

## Product Decisions

1. **All four flows** — Generate chart, Scale difficulty, Fill track, Improve pattern each get their own template set.
2. **Chip row UI** — Compact pills labeled “Quick starts” above the textarea; one click replaces field content.
3. **Text + hint only** — Chips fill `description` / `instruction` text. Optional `hint` string displays below chips (e.g. “Try target tier: Hard”). No auto-mutation of form controls.
4. **Curated-only v1** — Static catalog in `packages/shared`, mirroring `song-templates.ts`. No user-saved templates, no recents, no API persistence.
5. **No backend changes** — Templates are frontend/shared copy only; the AI receives the same `description` / `instruction` strings as if the user typed them.
6. **Improve sub-mode filtering** — Extend and Refine each show their own chip subset once sub-mode is chosen.

## Data Model

**File:** `packages/shared/src/ai-prompt-templates.ts`  
**Export:** via `packages/shared/src/index.ts`

```typescript
export type AiPromptFlow =
  | 'generate-chart'
  | 'scale-chart'
  | 'fill-track'
  | 'improve-pattern'

export interface AiPromptTemplate {
  id: string
  flow: AiPromptFlow
  label: string              // chip label, ≤24 chars
  prompt: string             // fills textarea, ≤2000 chars (target ≤300)
  hint?: string              // optional muted hint, ≤80 chars
  improveSubMode?: 'extend' | 'refine'  // improve-pattern only
}

export function templatesForFlow(
  flow: AiPromptFlow,
  improveSubMode?: 'extend' | 'refine',
): AiPromptTemplate[]
```

**Validation (unit-tested):**
- Unique `id` globally
- Every template’s `flow` matches its group
- `prompt.length ≤ 2000`
- Improve templates with `improveSubMode` only appear under `improve-pattern`
- `templatesForFlow('improve-pattern', 'extend')` excludes `refine` templates and vice versa

## Template Catalog (v1)

### Generate chart (6)

| id | label | hint |
|---|---|---|
| `gen-edm-drop` | EDM drop | Try target tier: Hard |
| `gen-sparse-intro` | Sparse intro | — |
| `gen-vocal-holds` | Vocal holds | Mix TAP and HOLD notes |
| `gen-syncopated` | Syncopated groove | — |
| `gen-chill-ballad` | Chill ballad | Try target tier: Easy |
| `gen-dense-chorus` | Dense chorus | Try target tier: Expert |

Example prompt (`gen-edm-drop`):
> Upbeat EDM drop — sparse intro, building hi-hats on tracks 2–3, hold notes on vocals/bass in the verse, dense doubles and syncopation in the chorus. Match 128 BPM four-on-the-floor energy.

### Scale difficulty (4)

| id | label | hint |
|---|---|---|
| `scale-thin-density` | Thin density | Try target tier: Easy |
| `scale-more-doubles` | More doubles | Try target tier: Hard |
| `scale-simplify-holds` | Simplify holds | Try target tier: Normal |
| `scale-keep-chorus` | Keep chorus energy | — |

Example prompt (`scale-thin-density`):
> Reduce overall note count. Fewer simultaneous notes, wider spacing, simpler lane changes. Keep the song structure recognizable.

### Fill track (4)

| id | label | hint |
|---|---|---|
| `fill-hihat-groove` | Hi-hat groove | Pick the hi-hat lane |
| `fill-sparse` | Sparse fills | — |
| `fill-double-time` | Double-time burst | — |
| `fill-mirror-lane` | Mirror lane 1 | Pick the destination lane |

Example prompt (`fill-hihat-groove`):
> Match the existing hi-hat groove near the playhead. Same rhythmic feel, slight variation every 2 bars.

### Improve pattern — Extend (3)

| id | label |
|---|---|
| `improve-ext-continue` | Continue groove |
| `improve-ext-mirror` | Mirror lanes |
| `improve-ext-tension` | Build tension |

Example prompt (`improve-ext-continue`):
> Continue the same rhythmic feel forward. Keep lane choices consistent with the selection.

### Improve pattern — Refine (3)

| id | label |
|---|---|
| `improve-ref-spacing` | Fix spacing |
| `improve-ref-simplify` | Simplify |
| `improve-ref-doubles` | Add doubles |

Example prompt (`improve-ref-spacing`):
> Fix uneven spacing in the selection. Keep the same general pattern but snap to a cleaner grid.

## UI Component

**File:** `apps/web/src/features/editor/components/ai-assistant/AiPromptTemplateChips.tsx`

**Props:**
```typescript
interface Props {
  flow: AiPromptFlow
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  improveSubMode?: 'extend' | 'refine'
}
```

**Behavior:**
1. Render section label `Quick starts` (uppercase muted, matches Fill track section label style).
2. Render wrapping row of chip buttons from `templatesForFlow(flow, improveSubMode)`.
3. On chip click: call `onChange(template.prompt)`; set local `activeTemplateId` and `activeHint`.
4. If user edits textarea so `value !== template.prompt` for active template, clear active chip state and hide hint.
5. When `improveSubMode` changes, clear active state and hint.
6. When `disabled` (processing), chips are non-interactive.

**Styling:** New classes on existing AI flow stylesheet (`globals.css` or `ai-flow-*` block):
- `.ai-prompt-chips` — flex wrap gap 1.5
- `.ai-prompt-chip` — pill, border, text-xs, hover/active states consistent with `.ai-flow-track-btn` but smaller
- `.ai-prompt-chip--active` — accent border
- `.ai-prompt-hint` — reuse `.ai-flow-label-hint`, shown only when hint present

## Per-Flow Integration

| Flow | File | Field | Chip placement |
|---|---|---|---|
| Generate chart | `GenerateChartFlow.tsx` | `description` | Above description textarea, below target tier select |
| Scale difficulty | `ScaleDifficultyFlow.tsx` | `instruction` | Above instruction textarea, below target tier select |
| Fill track | `FillTrackFlow.tsx` | `instruction` | Above instruction textarea, below track picker |
| Improve pattern | `ImprovePatternFlow.tsx` | `instruction` | Above textarea on configure step only; pass `subMode` |

Generate chart: chips are optional starters — description remains required for submit.

Scale / Fill / Improve: instruction stays optional; chips help users who want guidance.

## Architecture

```
packages/shared/src/ai-prompt-templates.ts   ← catalog + templatesForFlow()
apps/web/.../AiPromptTemplateChips.tsx       ← presentational chip row
apps/web/.../flows/*.tsx                     ← wire chips above each textarea
```

No API, store, or database changes.

## Error Handling & Edge Cases

| Case | Behavior |
|---|---|
| Processing in progress | Chips disabled |
| User clears textarea | Deselect chip, hide hint |
| User partially edits template text | Deselect chip (string equality check) |
| Improve: user clicks “Change” sub-mode | Chip row swaps set; clear selection |
| Empty template list | Component renders nothing (should not happen in v1) |
| Template prompt at char limit | Catalog test fails CI |

## Testing

**Shared (`packages/shared` or web re-export test):**
- `ai-prompt-templates.test.ts` — id uniqueness, length limits, flow grouping, improve sub-mode filter

**Web component:**
- `AiPromptTemplateChips.test.tsx` — click fills value, hint renders, active state clears on manual edit, sub-mode filter

**Manual smoke:**
- Open each AI flow, click a chip, confirm textarea fills and hint appears
- Generate chart still requires description (chip satisfies it)

## Out of Scope (v1)

- User-saved custom templates
- Recent briefs / localStorage history
- Auto-setting target tier, track, or create-as-new-chart checkboxes
- i18n / localization
- Analytics on chip usage
- Backend prompt injection or template-specific AI system instructions

## Future Extensions (not in v1)

- **B:** Chips that suggest defaults with one-click “Apply hint” (optional tier pre-select)
- **C:** Recent briefs per song in localStorage
- Per-song category templates (EDM vs Pop) based on `song.category`

## Success Criteria

- All four AI configure screens show a Quick starts chip row when templates exist for that flow.
- One click populates the text field with a usable brief; user can edit before submit.
- Hints display without changing any other form field.
- No regression to existing AI submit validation or streaming behavior.
