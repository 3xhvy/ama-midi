# AI Prompt Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add curated “Quick starts” chip rows to all four AI Assistant flows so users can one-click fill description/instruction text with optional non-binding hints.

**Architecture:** Static template catalog in `packages/shared` (like `song-templates.ts`), shared `AiPromptTemplateChips` React component, wired into each flow above its textarea. No API or store changes.

**Tech Stack:** TypeScript, React 18, Vitest (web + shared tests), existing `ai-flow-*` CSS tokens in `globals.css`

**Spec:** `docs/superpowers/specs/2026-05-25-ai-prompt-templates-design.md`

---

## File Map

| Path | Action | Responsibility |
|------|--------|----------------|
| `packages/shared/src/ai-prompt-templates.ts` | **Create** | Template catalog + `templatesForFlow()` |
| `packages/shared/src/index.ts` | **Modify** | Re-export new module |
| `packages/shared/src/ai-prompt-templates.test.ts` | **Create** | Catalog validation tests |
| `apps/web/src/features/editor/components/ai-assistant/AiPromptTemplateChips.tsx` | **Create** | Chip row UI |
| `apps/web/src/features/editor/components/ai-assistant/AiPromptTemplateChips.test.tsx` | **Create** | Component tests |
| `apps/web/src/styles/globals.css` | **Modify** | `.ai-prompt-*` styles |
| `apps/web/src/features/editor/components/ai-assistant/flows/GenerateChartFlow.tsx` | **Modify** | Wire chips above description |
| `apps/web/src/features/editor/components/ai-assistant/flows/ScaleDifficultyFlow.tsx` | **Modify** | Wire chips above instruction |
| `apps/web/src/features/editor/components/ai-assistant/flows/FillTrackFlow.tsx` | **Modify** | Wire chips above instruction |
| `apps/web/src/features/editor/components/ai-assistant/flows/ImprovePatternFlow.tsx` | **Modify** | Wire chips above instruction (sub-mode aware) |

---

## Task 1: Shared template catalog

**Files:**
- Create: `packages/shared/src/ai-prompt-templates.ts`
- Create: `packages/shared/src/ai-prompt-templates.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write the failing catalog test**

Create `packages/shared/src/ai-prompt-templates.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import {
  AI_PROMPT_TEMPLATES,
  templatesForFlow,
} from './ai-prompt-templates'

describe('AI_PROMPT_TEMPLATES', () => {
  it('has unique ids', () => {
    const ids = AI_PROMPT_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps prompts within API max length', () => {
    for (const template of AI_PROMPT_TEMPLATES) {
      expect(template.prompt.length).toBeLessThanOrEqual(2000)
      expect(template.label.length).toBeLessThanOrEqual(24)
      if (template.hint) expect(template.hint.length).toBeLessThanOrEqual(80)
    }
  })

  it('filters improve-pattern templates by sub-mode', () => {
    const extend = templatesForFlow('improve-pattern', 'extend')
    const refine = templatesForFlow('improve-pattern', 'refine')
    expect(extend.every((t) => t.improveSubMode === 'extend')).toBe(true)
    expect(refine.every((t) => t.improveSubMode === 'refine')).toBe(true)
    expect(extend.some((t) => t.id === 'improve-ext-continue')).toBe(true)
    expect(refine.some((t) => t.id === 'improve-ref-spacing')).toBe(true)
  })

  it('returns generate-chart templates', () => {
    expect(templatesForFlow('generate-chart')).toHaveLength(6)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run from repo root:

```bash
cd packages/shared && pnpm exec vitest run src/ai-prompt-templates.test.ts
```

Expected: FAIL — module `./ai-prompt-templates` not found.

- [ ] **Step 3: Implement catalog**

Create `packages/shared/src/ai-prompt-templates.ts`:

```typescript
export type AiPromptFlow =
  | 'generate-chart'
  | 'scale-chart'
  | 'fill-track'
  | 'improve-pattern'

export interface AiPromptTemplate {
  id: string
  flow: AiPromptFlow
  label: string
  prompt: string
  hint?: string
  improveSubMode?: 'extend' | 'refine'
}

export const AI_PROMPT_TEMPLATES: AiPromptTemplate[] = [
  // generate-chart (6)
  {
    id: 'gen-edm-drop',
    flow: 'generate-chart',
    label: 'EDM drop',
    hint: 'Try target tier: Hard',
    prompt:
      'Upbeat EDM drop — sparse intro, building hi-hats on tracks 2–3, hold notes on vocals/bass in the verse, dense doubles and syncopation in the chorus. Match four-on-the-floor energy.',
  },
  {
    id: 'gen-sparse-intro',
    flow: 'generate-chart',
    label: 'Sparse intro',
    prompt:
      'Very sparse intro for the first 8–16 bars — single-lane taps, gradual density build. Clear section markers for intro, verse, and chorus.',
  },
  {
    id: 'gen-vocal-holds',
    flow: 'generate-chart',
    label: 'Vocal holds',
    hint: 'Mix TAP and HOLD notes',
    prompt:
      'Chart with sustained HOLD notes on vocal phrases (tracks 2–4) and TAP accents on drums/percussion lanes. Aim for 20–30% holds.',
  },
  {
    id: 'gen-syncopated',
    flow: 'generate-chart',
    label: 'Syncopated groove',
    prompt:
      'Syncopated groove with off-beat accents, lane alternation, and occasional doubles. Keep intro simpler than the main groove.',
  },
  {
    id: 'gen-chill-ballad',
    flow: 'generate-chart',
    label: 'Chill ballad',
    hint: 'Try target tier: Easy',
    prompt:
      'Slow ballad feel — wide spacing, minimal simultaneous notes, gentle holds on melody lanes. Low density throughout.',
  },
  {
    id: 'gen-dense-chorus',
    flow: 'generate-chart',
    label: 'Dense chorus',
    hint: 'Try target tier: Expert',
    prompt:
      'High-energy chorus with dense note clusters, multi-lane doubles, and short holds. Contrast with a sparser verse.',
  },

  // scale-chart (4)
  {
    id: 'scale-thin-density',
    flow: 'scale-chart',
    label: 'Thin density',
    hint: 'Try target tier: Easy',
    prompt:
      'Reduce overall note count. Fewer simultaneous notes, wider spacing, simpler lane changes. Keep the song structure recognizable.',
  },
  {
    id: 'scale-more-doubles',
    flow: 'scale-chart',
    label: 'More doubles',
    hint: 'Try target tier: Hard',
    prompt:
      'Add controlled doubles and syncopation. Increase density in choruses while keeping verses readable.',
  },
  {
    id: 'scale-simplify-holds',
    flow: 'scale-chart',
    label: 'Simplify holds',
    hint: 'Try target tier: Normal',
    prompt:
      'Shorten or remove long holds. Prefer TAP notes with occasional short holds for accents.',
  },
  {
    id: 'scale-keep-chorus',
    flow: 'scale-chart',
    label: 'Keep chorus energy',
    prompt:
      'Preserve chorus intensity and lane patterns. Adjust difficulty mainly in verses and transitions.',
  },

  // fill-track (4)
  {
    id: 'fill-hihat-groove',
    flow: 'fill-track',
    label: 'Hi-hat groove',
    hint: 'Pick the hi-hat lane',
    prompt:
      'Match the existing hi-hat groove near the playhead. Same rhythmic feel, slight variation every 2 bars.',
  },
  {
    id: 'fill-sparse',
    flow: 'fill-track',
    label: 'Sparse fills',
    prompt:
      'Add sparse filler notes on this lane — every 1–2 bars, avoid cluttering existing patterns.',
  },
  {
    id: 'fill-double-time',
    flow: 'fill-track',
    label: 'Double-time burst',
    prompt:
      'Short double-time burst for 1–2 bars near the playhead, then return to the prevailing rhythm.',
  },
  {
    id: 'fill-mirror-lane',
    flow: 'fill-track',
    label: 'Mirror lane 1',
    hint: 'Pick the destination lane',
    prompt:
      'Mirror the rhythmic pattern from track 1 onto this lane with complementary lane spacing.',
  },

  // improve-pattern extend (3)
  {
    id: 'improve-ext-continue',
    flow: 'improve-pattern',
    label: 'Continue groove',
    improveSubMode: 'extend',
    prompt:
      'Continue the same rhythmic feel forward. Keep lane choices consistent with the selection.',
  },
  {
    id: 'improve-ext-mirror',
    flow: 'improve-pattern',
    label: 'Mirror lanes',
    improveSubMode: 'extend',
    prompt:
      'Extend the pattern with mirrored lane alternation — same timing feel, complementary tracks.',
  },
  {
    id: 'improve-ext-tension',
    flow: 'improve-pattern',
    label: 'Build tension',
    improveSubMode: 'extend',
    prompt:
      'Extend forward with gradually denser notes to build tension before the next section.',
  },

  // improve-pattern refine (3)
  {
    id: 'improve-ref-spacing',
    flow: 'improve-pattern',
    label: 'Fix spacing',
    improveSubMode: 'refine',
    prompt:
      'Fix uneven spacing in the selection. Keep the same general pattern but snap to a cleaner grid.',
  },
  {
    id: 'improve-ref-simplify',
    flow: 'improve-pattern',
    label: 'Simplify',
    improveSubMode: 'refine',
    prompt:
      'Simplify the selection — remove redundant notes, keep the core rhythm readable.',
  },
  {
    id: 'improve-ref-doubles',
    flow: 'improve-pattern',
    label: 'Add doubles',
    improveSubMode: 'refine',
    prompt:
      'Add tasteful doubles to the selection without changing the overall timing structure.',
  },
]

export function templatesForFlow(
  flow: AiPromptFlow,
  improveSubMode?: 'extend' | 'refine',
): AiPromptTemplate[] {
  return AI_PROMPT_TEMPLATES.filter((template) => {
    if (template.flow !== flow) return false
    if (flow !== 'improve-pattern') return true
    if (!improveSubMode) return false
    return template.improveSubMode === improveSubMode
  })
}
```

Add to `packages/shared/src/index.ts`:

```typescript
export * from './ai-prompt-templates'
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/shared && pnpm exec vitest run src/ai-prompt-templates.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/ai-prompt-templates.ts \
        packages/shared/src/ai-prompt-templates.test.ts \
        packages/shared/src/index.ts
git commit -m "$(cat <<'EOF'
feat(shared): add AI prompt template catalog

Curated quick-start prompts for all four AI Assistant flows.
EOF
)"
```

---

## Task 2: `AiPromptTemplateChips` component

**Files:**
- Create: `apps/web/src/features/editor/components/ai-assistant/AiPromptTemplateChips.tsx`
- Create: `apps/web/src/features/editor/components/ai-assistant/AiPromptTemplateChips.test.tsx`
- Modify: `apps/web/src/styles/globals.css`

- [ ] **Step 1: Write the failing component test**

Create `apps/web/src/features/editor/components/ai-assistant/AiPromptTemplateChips.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AiPromptTemplateChips } from './AiPromptTemplateChips'

describe('AiPromptTemplateChips', () => {
  it('fills the field when a chip is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <AiPromptTemplateChips
        flow="generate-chart"
        value=""
        onChange={onChange}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'EDM drop' }))
    expect(onChange).toHaveBeenCalledWith(
      expect.stringContaining('Upbeat EDM drop'),
    )
  })

  it('shows a hint after selecting a chip with hint text', async () => {
    const user = userEvent.setup()
    render(
      <AiPromptTemplateChips
        flow="generate-chart"
        value=""
        onChange={() => {}}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'EDM drop' }))
    expect(screen.getByText('Try target tier: Hard')).toBeInTheDocument()
  })

  it('clears active chip when value diverges from template prompt', () => {
    const { rerender } = render(
      <AiPromptTemplateChips
        flow="generate-chart"
        value="Upbeat EDM drop — edited"
        onChange={() => {}}
      />,
    )
    expect(screen.queryByText('Try target tier: Hard')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && pnpm test src/features/editor/components/ai-assistant/AiPromptTemplateChips.test.tsx
```

Expected: FAIL — component not found.

- [ ] **Step 3: Add CSS**

Append to `apps/web/src/styles/globals.css` near other `.ai-flow-*` rules (~line 1264):

```css
.ai-prompt-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.ai-prompt-chip {
  border-radius: 9999px;
  border: 1px solid var(--modal-border, rgba(255, 255, 255, 0.12));
  padding: 0.25rem 0.625rem;
  font-size: 0.6875rem;
  line-height: 1.25;
  color: var(--modal-text);
  background: transparent;
  transition: border-color 0.15s, background-color 0.15s;
}

.ai-prompt-chip:hover:not(:disabled) {
  border-color: rgba(108, 99, 255, 0.55);
  background: rgba(108, 99, 255, 0.12);
}

.ai-prompt-chip--active {
  border-color: rgba(108, 99, 255, 0.85);
  background: rgba(108, 99, 255, 0.2);
}

.ai-prompt-chip:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.dark .editor-modal .ai-prompt-chip {
  border-color: rgba(255, 255, 255, 0.14);
  color: var(--modal-text);
}
```

- [ ] **Step 4: Implement component**

Create `apps/web/src/features/editor/components/ai-assistant/AiPromptTemplateChips.tsx`:

```tsx
import { useEffect, useState } from 'react'
import {
  templatesForFlow,
  type AiPromptFlow,
} from '@ama-midi/shared'

interface Props {
  flow: AiPromptFlow
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  improveSubMode?: 'extend' | 'refine'
}

export function AiPromptTemplateChips({
  flow,
  value,
  onChange,
  disabled = false,
  improveSubMode,
}: Props) {
  const templates = templatesForFlow(flow, improveSubMode)
  const [activeId, setActiveId] = useState<string | null>(null)

  const activeTemplate = templates.find((t) => t.id === activeId) ?? null

  useEffect(() => {
    setActiveId(null)
  }, [improveSubMode, flow])

  useEffect(() => {
    if (!activeTemplate || value !== activeTemplate.prompt) {
      setActiveId(null)
    }
  }, [value, activeTemplate])

  if (templates.length === 0) return null

  const hint = activeTemplate?.hint

  return (
    <div className="space-y-1.5">
      <p className="ai-flow-section-label text-[10px] uppercase tracking-wide">
        Quick starts
      </p>
      <div className="ai-prompt-chips">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            disabled={disabled}
            aria-pressed={activeId === template.id}
            className={`ai-prompt-chip${activeId === template.id ? ' ai-prompt-chip--active' : ''}`}
            onClick={() => {
              setActiveId(template.id)
              onChange(template.prompt)
            }}
          >
            {template.label}
          </button>
        ))}
      </div>
      {hint ? (
        <p className="ai-flow-label-hint text-[10px] leading-snug">{hint}</p>
      ) : null}
    </div>
  )
}
```

Note: hint shows only while `activeId` matches and `value === activeTemplate.prompt` (enforced by the `useEffect` clearing `activeId` on edit).

- [ ] **Step 5: Run tests**

```bash
cd apps/web && pnpm test src/features/editor/components/ai-assistant/AiPromptTemplateChips.test.tsx
```

Expected: PASS (3 tests)

If `@testing-library/user-event` is missing, install in `apps/web`:

```bash
cd apps/web && pnpm add -D @testing-library/user-event
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/editor/components/ai-assistant/AiPromptTemplateChips.tsx \
        apps/web/src/features/editor/components/ai-assistant/AiPromptTemplateChips.test.tsx \
        apps/web/src/styles/globals.css
git commit -m "$(cat <<'EOF'
feat(web): add AI prompt template chip picker

Shared Quick starts chip row for AI Assistant text fields.
EOF
)"
```

---

## Task 3: Wire into Generate chart flow

**Files:**
- Modify: `apps/web/src/features/editor/components/ai-assistant/flows/GenerateChartFlow.tsx`

- [ ] **Step 1: Import and render chips**

Add import:

```typescript
import { AiPromptTemplateChips } from '../AiPromptTemplateChips'
```

Insert above `<AiFlowTextarea value={description} ...>`:

```tsx
        <AiPromptTemplateChips
          flow="generate-chart"
          value={description}
          onChange={setDescription}
          disabled={processing}
        />
```

- [ ] **Step 2: Manual smoke**

Run `pnpm dev`, open editor → AI → Generate chart. Confirm:
- “Quick starts” chips appear above description
- Clicking “EDM drop” fills textarea and shows hint
- Generate preview still works

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor/components/ai-assistant/flows/GenerateChartFlow.tsx
git commit -m "$(cat <<'EOF'
feat(web): add prompt templates to generate chart flow
EOF
)"
```

---

## Task 4: Wire into Scale, Fill, and Improve flows

**Files:**
- Modify: `apps/web/src/features/editor/components/ai-assistant/flows/ScaleDifficultyFlow.tsx`
- Modify: `apps/web/src/features/editor/components/ai-assistant/flows/FillTrackFlow.tsx`
- Modify: `apps/web/src/features/editor/components/ai-assistant/flows/ImprovePatternFlow.tsx`

- [ ] **Step 1: Scale difficulty**

In `ScaleDifficultyFlow.tsx`:

```typescript
import { AiPromptTemplateChips } from '../AiPromptTemplateChips'
```

Above instruction `<AiFlowTextarea>`:

```tsx
        <AiPromptTemplateChips
          flow="scale-chart"
          value={instruction}
          onChange={setInstruction}
          disabled={processing}
        />
```

- [ ] **Step 2: Fill track**

In `FillTrackFlow.tsx`:

```typescript
import { AiPromptTemplateChips } from '../AiPromptTemplateChips'
```

Above instruction `<AiFlowTextarea>` (below track picker):

```tsx
        <AiPromptTemplateChips
          flow="fill-track"
          value={instruction}
          onChange={setInstruction}
          disabled={processing}
        />
```

- [ ] **Step 3: Improve pattern**

In `ImprovePatternFlow.tsx` configure step only (inside the `return` that has the textarea, not the sub-mode picker):

```typescript
import { AiPromptTemplateChips } from '../AiPromptTemplateChips'
```

Above `<AiFlowTextarea>`:

```tsx
        <AiPromptTemplateChips
          flow="improve-pattern"
          improveSubMode={subMode}
          value={instruction}
          onChange={setInstruction}
          disabled={processing}
        />
```

- [ ] **Step 4: Run web tests**

```bash
cd apps/web && pnpm test src/features/editor/components/ai-assistant/
cd packages/shared && pnpm exec vitest run src/ai-prompt-templates.test.ts
```

Expected: all PASS

- [ ] **Step 5: Manual smoke all flows**

| Flow | Check |
|------|-------|
| Scale | Chips above instruction; hint mentions tier |
| Fill track | Chips above instruction |
| Improve → Extend | 3 extend chips |
| Improve → Refine | 3 refine chips; “Change” swaps chip set |

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/editor/components/ai-assistant/flows/ScaleDifficultyFlow.tsx \
        apps/web/src/features/editor/components/ai-assistant/flows/FillTrackFlow.tsx \
        apps/web/src/features/editor/components/ai-assistant/flows/ImprovePatternFlow.tsx
git commit -m "$(cat <<'EOF'
feat(web): wire AI prompt templates into remaining flows
EOF
)"
```

---

## Spec Coverage Checklist

| Spec requirement | Task |
|---|---|
| All 4 flows get chips | Tasks 3–4 |
| Chip row UI | Task 2 |
| Text + hint only | Task 2 (`AiPromptTemplateChips`) |
| Curated catalog in shared | Task 1 |
| Improve sub-mode filter | Task 1 + Task 4 Step 3 |
| No backend changes | N/A (none planned) |
| Catalog validation tests | Task 1 |
| Component tests | Task 2 |

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-25-ai-prompt-templates.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — implement tasks in this session with checkpoints

Which approach do you want?
