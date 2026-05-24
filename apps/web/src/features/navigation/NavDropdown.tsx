import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDownIcon } from '@radix-ui/react-icons'
import type { SongStatus } from '@ama-midi/shared'
import { SongStatusEnum } from '@ama-midi/shared'
import { SongStatusBadge } from '../../components/ui'
import { cn } from '../../lib/utils'

export interface NavDropdownItem {
  id: string
  label: string
  description?: string
  meta?: string
  status?: SongStatus
  onSelect: () => void
  active?: boolean
}

export interface NavDropdownSection {
  title?: string
  items: NavDropdownItem[]
}

export function NavDropdown({
  triggerLabel,
  searchPlaceholder,
  sections,
  dropdownId,
  maxWidthClassName = 'w-64',
  triggerClassName = 'max-w-[160px]',
  variant = 'default',
  accent = 'default',
}: {
  triggerLabel: string
  searchPlaceholder: string
  sections: NavDropdownSection[]
  dropdownId: string
  maxWidthClassName?: string
  triggerClassName?: string
  variant?: 'default' | 'breadcrumb' | 'toolbar'
  accent?: 'default' | 'project' | 'song'
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sections

    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          const secondary = item.meta ?? item.description
          return (
            item.label.toLowerCase().includes(q)
            || (secondary?.toLowerCase().includes(q) ?? false)
            || (item.status ? SongStatusEnum.label(item.status).toLowerCase().includes(q) : false)
          )
        }),
      }))
      .filter((section) => section.items.length > 0)
  }, [sections, query])

  function openDropdown() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) setDropPos({ top: rect.bottom + 6, left: rect.left })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    function onDown(e: MouseEvent) {
      const target = e.target as Node
      if (!btnRef.current?.contains(target) && !(document.getElementById(dropdownId)?.contains(target))) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, dropdownId])

  function selectItem(item: NavDropdownItem) {
    setOpen(false)
    setQuery('')
    item.onSelect()
  }

  const isBreadcrumb = variant === 'breadcrumb'
  const isToolbar = variant === 'toolbar'

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => (open ? setOpen(false) : openDropdown())}
        className={cn(
          'group flex items-center gap-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
          isToolbar
            ? cn(
                'editor-toolbar-nav-link',
                accent === 'song' && 'editor-toolbar-nav-link--song',
                open && 'text-[var(--toolbar-text)] bg-white/[0.06]',
              )
            : isBreadcrumb
              ? cn(
                  'min-h-[28px] gap-1 rounded-md px-2.5 py-1 hover:bg-primary/10',
                  open && 'bg-primary/12 ring-1 ring-primary/25 shadow-sm',
                  accent === 'song'
                    ? 'text-primary'
                    : 'text-shell-text',
                )
              : 'text-sm font-medium text-shell-text hover:text-primary gap-1',
          triggerClassName,
        )}
        title={triggerLabel}
      >
        <span
          className={cn(
            'truncate',
            isToolbar && accent === 'song' && 'font-medium',
            isBreadcrumb && 'text-sm font-semibold',
          )}
        >
          {triggerLabel}
        </span>
        <ChevronDownIcon
          className={cn(
            'shrink-0 transition-transform duration-150',
            isToolbar
              ? cn('h-3 w-3 opacity-50 group-hover:opacity-80', open && 'opacity-80')
              : isBreadcrumb
                ? cn(
                    'h-3.5 w-3.5',
                    accent === 'song' ? 'text-primary/70 group-hover:text-primary' : 'text-primary/50 group-hover:text-primary/80',
                  )
                : 'h-2.5 w-2.5 opacity-50',
            open && 'rotate-180',
            isBreadcrumb && open && 'text-primary',
          )}
        />
      </button>

      {open && (
        <div
          id={dropdownId}
          role="listbox"
          style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, zIndex: 9999 }}
          className={cn(
            maxWidthClassName,
            'editor-toolbar-dropdown',
          )}
        >
          <div className="border-b border-shell-border bg-shell-bg/50 p-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-shell-border bg-shell-surface px-2.5 py-1.5 text-xs text-shell-text placeholder:text-shell-muted outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filteredSections.length === 0 ? (
              <p className="px-3 py-3 text-xs text-shell-muted">No results</p>
            ) : (
              filteredSections.map((section) => (
                <div key={section.title ?? section.items[0]?.id}>
                  {section.title && (
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-shell-muted">
                      {section.title}
                    </p>
                  )}
                  <ul className="px-1">
                    {section.items.map((item) => {
                      const secondary = item.meta ?? item.description
                      return (
                      <li key={item.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={item.active}
                          onClick={() => selectItem(item)}
                          className={cn(
                            'w-full rounded-lg px-2.5 py-2 text-left transition-colors',
                            item.active
                              ? 'bg-primary/10 ring-1 ring-primary/20'
                              : 'hover:bg-shell-bg',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span
                                className={cn(
                                  'block truncate text-xs',
                                  item.active ? 'font-semibold text-primary' : 'font-medium text-shell-text',
                                )}
                              >
                                {item.label}
                              </span>
                              {secondary && (
                                <span className="mt-0.5 block truncate text-[10px] leading-snug text-shell-muted">
                                  {secondary}
                                </span>
                              )}
                            </div>
                            {item.status && (
                              <SongStatusBadge status={item.status} className="shrink-0" />
                            )}
                          </div>
                        </button>
                      </li>
                      )
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  )
}
