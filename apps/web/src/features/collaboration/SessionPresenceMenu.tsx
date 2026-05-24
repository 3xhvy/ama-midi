import { ChevronDownIcon } from '@radix-ui/react-icons'
import { useEffect, useRef, useState } from 'react'
import { getColorFromName } from '@ama-midi/shared'
import { Avatar, Badge } from '../../components/ui'
import { cn } from '../../lib/utils'
import type { PresenceUser } from './useSocket'
import { sortPresenceUsers } from './sort-presence-users'

interface Props {
  users: PresenceUser[]
  currentUserId: string
  compact?: boolean
}

const DROPDOWN_ID = 'session-presence-dropdown'

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

function formatSubtitle(user: PresenceUser) {
  const parts = [user.title, user.department].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

export function SessionPresenceMenu({ users, currentUserId, compact = false }: Props) {
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  const sorted = sortPresenceUsers(users, currentUserId)
  const maxVisible = compact ? 3 : 5
  const avatarSize = compact ? 'w-6 h-6 text-[9px] border' : 'w-8 h-8 text-xs border-2'
  const avatarOverlap = compact ? '-6px' : '-8px'
  const visible = users.slice(0, maxVisible)
  const overflow = users.length - visible.length
  const countLabel = users.length === 1 ? '1 person in this session' : `${users.length} people in this session`

  function openDropdown() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) {
      const anchorX = compact ? rect.right : rect.left + rect.width / 2
      setDropPos({ top: rect.bottom + 6, left: anchorX })
    }
    setOpen(true)
  }

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

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={countLabel}
        onClick={() => (open ? setOpen(false) : openDropdown())}
        className={cn(
          'editor-toolbar-chip group',
          compact && 'editor-toolbar-chip--compact',
          open && 'bg-white/[0.06]',
        )}
      >
        <div className="flex items-center">
          {visible.map((user, i) => (
            <div
              key={user.id}
              className={cn(
                'rounded-full flex items-center justify-center font-medium text-white border-shell-surface overflow-hidden',
                avatarSize,
              )}
              style={{
                backgroundColor: getColorFromName(user.id),
                marginLeft: i > 0 ? avatarOverlap : '0',
                zIndex: visible.length - i,
                position: 'relative',
              }}
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                getInitials(user.name)
              )}
            </div>
          ))}
          {overflow > 0 && (
            <div
              className={cn(
                'rounded-full bg-shell-surface border border-shell-border flex items-center justify-center text-shell-muted',
                compact ? 'w-6 h-6 text-[9px]' : 'w-8 h-8 text-xs',
              )}
              style={{ marginLeft: avatarOverlap, position: 'relative', zIndex: 0 }}
            >
              +{overflow}
            </div>
          )}
        </div>
        <ChevronDownIcon
          className={cn(
            'shrink-0 text-[var(--toolbar-muted)] opacity-60 transition-transform group-hover:opacity-90',
            compact ? 'h-2.5 w-2.5' : 'h-3 w-3',
            open && 'rotate-180 opacity-90',
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div
          id={DROPDOWN_ID}
          role="listbox"
          aria-label="People in this session"
          style={{
            position: 'fixed',
            top: dropPos.top,
            left: dropPos.left,
            transform: compact ? 'translateX(-100%)' : 'translateX(-50%)',
            zIndex: 9999,
          }}
          className="editor-toolbar-dropdown w-72"
        >
          <div className="border-b border-shell-border px-3 py-2">
            <p className="text-xs font-semibold text-shell-text">In this session</p>
            <p className="text-[10px] text-shell-muted">{countLabel}</p>
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {sorted.map((user) => {
              const isYou = user.id === currentUserId
              const subtitle = formatSubtitle(user)
              return (
                <li
                  key={user.id}
                  role="option"
                  aria-selected={isYou}
                  className={cn(
                    'mx-1 flex items-center gap-3 rounded-lg px-2.5 py-2',
                    isYou && 'bg-primary/10 ring-1 ring-primary/20',
                  )}
                >
                  <Avatar src={user.avatarUrl} name={user.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-medium text-shell-text">{user.name}</span>
                      {isYou && (
                        <Badge variant="info" size="sm" className="shrink-0">
                          You
                        </Badge>
                      )}
                    </div>
                    {subtitle && (
                      <p className="mt-0.5 truncate text-[10px] leading-snug text-shell-muted">{subtitle}</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </>
  )
}
