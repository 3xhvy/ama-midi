import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DifficultyHelpModal } from './DifficultyHelpModal'

function renderModal() {
  return render(<DifficultyHelpModal open onClose={vi.fn()} />)
}

describe('DifficultyHelpModal', () => {
  it('opens as a difficulty guide with tier cards', () => {
    renderModal()

    expect(screen.getByRole('heading', { name: 'Difficulty Guide' })).toBeTruthy()
    expect(screen.getByText(/Learn what each tier means/i)).toBeTruthy()

    expect(screen.getByText('Easy')).toBeTruthy()
    expect(screen.getByText('0-2.9')).toBeTruthy()
    expect(screen.getByText('Light taps, no doubles, simple rhythm')).toBeTruthy()

    expect(screen.getByText('Master')).toBeTruthy()
    expect(screen.getByText('18+')).toBeTruthy()
    expect(screen.getByText('Peak density, wide jumps, advanced patterns')).toBeTruthy()
  })

  it('shows review badges and quick fix cards', () => {
    renderModal()

    expect(screen.getByText('Ready')).toBeTruthy()
    expect(screen.getByText('No warnings')).toBeTruthy()
    expect(screen.getAllByText('Needs Review').length).toBeGreaterThan(0)
    expect(screen.getByText('WARN or INFO items exist')).toBeTruthy()
    expect(screen.getByText('Blocked')).toBeTruthy()
    expect(screen.getByText('Cannot be approved until ERROR items are fixed')).toBeTruthy()

    expect(screen.getByText('Fix Your Score')).toBeTruthy()
    expect(screen.getByText('Density')).toBeTruthy()
    expect(screen.getByText('Spread bursts across more time')).toBeTruthy()
    expect(screen.getByText('Doubles/triples')).toBeTruthy()
    expect(screen.getByText('Stagger or remove stacked notes')).toBeTruthy()
  })

  it('groups warning codes by review outcome with readable fixes', () => {
    renderModal()

    expect(screen.getByRole('heading', { name: 'Blocking' })).toBeTruthy()
    expect(screen.getByText('Even out the hardest section')).toBeTruthy()
    expect(screen.getAllByText('DIFFICULTY_SPIKE').length).toBeGreaterThan(0)

    expect(screen.getByRole('heading', { name: 'Needs Review' })).toBeTruthy()
    expect(screen.getByText('Snap notes closer to the beat grid')).toBeTruthy()
    expect(screen.getByText('EXCESSIVE_OFFBEAT')).toBeTruthy()

    expect(screen.getByRole('heading', { name: 'Info' })).toBeTruthy()
    expect(screen.getByText('Fill the gap or trim the song')).toBeTruthy()
    expect(screen.getByText('EMPTY_SECTION')).toBeTruthy()
  })

  it('keeps exact tier limits collapsed until requested', () => {
    renderModal()

    expect(screen.queryByText('NPS warn')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Advanced Limits/i }))

    expect(screen.getByText('NPS warn')).toBeTruthy()
    expect(screen.getByText('Max doubles/10s')).toBeTruthy()
    expect(screen.getByText(/Triples are not allowed on Easy\/Normal/)).toBeTruthy()
  })
})
