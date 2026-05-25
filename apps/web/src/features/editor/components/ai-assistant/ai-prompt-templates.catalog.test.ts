import { describe, expect, it } from 'vitest'
import {
  AI_PROMPT_TEMPLATES,
  templatesForFlow,
} from '@ama-midi/shared'

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
