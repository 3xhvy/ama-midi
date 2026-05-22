import { useState, useEffect, useCallback } from 'react'
import type { TourStep } from './TourOverlay'

const SONG_TOUR_STEPS: TourStep[] = [
  { target: 'piano-roll', message: 'Click anywhere on the grid to place a note at that position.' },
  { target: 'piano-roll', message: 'Select a note then press E to edit its title, color, and description.' },
  { target: 'piano-roll', message: 'Press Cmd+Z to undo your last action. It syncs to all collaborators.' },
]

const STORAGE_KEY = 'ama-song-tour-seen'

export function useSongTour() {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY)
    if (!seen) {
      const id = setTimeout(() => setActive(true), 800)
      return () => clearTimeout(id)
    }
  }, [])

  const complete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setActive(false)
  }, [])

  return { active, steps: SONG_TOUR_STEPS, complete, skip: complete }
}
