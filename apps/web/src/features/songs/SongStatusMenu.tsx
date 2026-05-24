import { useEffect, useRef, useState } from 'react'
import { songStatusActionLabel } from '@ama-midi/shared'
import type { SongStatus } from '@ama-midi/shared'
import { SongStatusBadge } from '../../components/ui'
import { useSongWorkflow, useUpdateSongStatus } from '../songs/useSongWorkflow'

const DROPDOWN_ID = 'song-status-dropdown'

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
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  const allowed = workflow?.allowedTransitions ?? []
  const current = workflow?.status ?? status

  useEffect(() => {
    if (!open) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (
        !btnRef.current?.contains(target)
        && !document.getElementById(DROPDOWN_ID)?.contains(target)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [open])

  const badgeClass = toolbar
    ? 'ml-1 shrink-0 border-0 text-[10px]'
    : undefined

  if (!allowed.length) {
    return <SongStatusBadge status={current} className={badgeClass} />
  }

  function openDropdown() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) {
      setDropPos({ top: rect.bottom + 6, left: rect.left })
    }
    setOpen(true)
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openDropdown())}
        className="ml-1 inline-flex shrink-0 items-center gap-0.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <SongStatusBadge status={current} className={badgeClass} />
        {!compact && (
          <svg width="10" height="10" viewBox="0 0 10 10" className="opacity-40">
            <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {open && (
        <div
          id={DROPDOWN_ID}
          role="menu"
          style={{
            position: 'fixed',
            top: dropPos.top,
            left: dropPos.left,
            zIndex: 9999,
          }}
          className="editor-toolbar-dropdown min-w-[180px] py-1"
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
      )}
    </>
  )
}
