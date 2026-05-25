import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AiPromptTemplateChips } from './AiPromptTemplateChips'

describe('AiPromptTemplateChips', () => {
  it('fills the field when a chip is clicked', () => {
    const onChange = vi.fn()
    render(
      <AiPromptTemplateChips
        flow="generate-chart"
        value=""
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'EDM drop' }))
    expect(onChange).toHaveBeenCalledWith(
      expect.stringContaining('Upbeat EDM drop'),
    )
  })

  it('shows a hint after selecting a chip with hint text', () => {
    let text = ''
    const { rerender } = render(
      <AiPromptTemplateChips
        flow="generate-chart"
        value={text}
        onChange={(next) => { text = next }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'EDM drop' }))
    rerender(
      <AiPromptTemplateChips
        flow="generate-chart"
        value={text}
        onChange={(next) => { text = next }}
      />,
    )
    expect(screen.getByText('Try target tier: Hard')).toBeTruthy()
  })

  it('clears hint when value diverges from template prompt', () => {
    render(
      <AiPromptTemplateChips
        flow="generate-chart"
        value="Upbeat EDM drop — edited"
        onChange={() => {}}
      />,
    )
    expect(screen.queryByText('Try target tier: Hard')).toBeNull()
  })
})
