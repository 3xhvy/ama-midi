import { useState } from 'react'
import { songStatusActionLabel } from '@ama-midi/shared'
import type { SongStatus } from '@ama-midi/shared'
import { SongStatusBadge } from '../../components/ui'
import { useSongWorkflow, useUpdateSongStatus } from '../songs/useSongWorkflow'

export function SongStatusMenu({
  songId,
  projectId,
  status,
  compact = false,
  toolbar = false,
}: {
  songId: string
  projectId: string
  status: SongStatus
  compact?: boolean
  toolbar?: boolean
}) {
  const { data: workflow } = useSongWorkflow(songId)
  const updateStatus = useUpdateSongStatus(songId, projectId)
  const [open, setOpen] = useState(false)

  const allowed = workflow?.allowedTransitions ?? []
  const current = workflow?.status ?? status

  const badgeClass = toolbar
    ? 'ml-1.5 bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/20 border-0'
    : undefined

  if (!allowed.length) {
    return <SongStatusBadge status={current} className={badgeClass} />
  }

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <SongStatusBadge status={current} className={badgeClass} />
        {!compact && (
          <svg width="10" height="10" viewBox="0 0 10 10" className="opacity-50">
            <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close status menu"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-shell-border bg-shell-surface py-1 shadow-md"
          >
            {allowed.map((next) => (
              <button
                key={next}
                type="button"
                role="menuitem"
                disabled={updateStatus.isPending}
                onClick={() => {
                  setOpen(false)
                  updateStatus.mutate(next)
                }}
                className="block w-full px-3 py-2 text-left text-xs text-shell-text hover:bg-shell-bg disabled:opacity-50"
              >
                {songStatusActionLabel(current, next)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
