import { useEffect, useMemo, useRef, useState } from 'react'

export interface NavDropdownItem {
  id: string
  label: string
  description?: string
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
}: {
  triggerLabel: string
  searchPlaceholder: string
  sections: NavDropdownSection[]
  dropdownId: string
  maxWidthClassName?: string
  triggerClassName?: string
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
        items: section.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q)
            || (item.description?.toLowerCase().includes(q) ?? false),
        ),
      }))
      .filter((section) => section.items.length > 0)
  }, [sections, query])

  function openDropdown() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) setDropPos({ top: rect.bottom + 4, left: rect.left })
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

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openDropdown())}
        className={`flex items-center gap-1 text-shell-text font-medium text-sm hover:text-primary transition-colors ${triggerClassName}`}
        title={triggerLabel}
      >
        <span className="truncate">{triggerLabel}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          className={`shrink-0 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          id={dropdownId}
          style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, zIndex: 9999 }}
          className={`${maxWidthClassName} bg-shell-surface border border-shell-border rounded-lg shadow-md overflow-hidden`}
        >
          <div className="p-2 border-b border-shell-border">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full px-2 py-1 text-xs bg-shell-bg border border-shell-border rounded text-shell-text placeholder:text-shell-muted outline-none focus:border-primary"
            />
          </div>
          <div className="py-1 max-h-64 overflow-y-auto">
            {filteredSections.length === 0 ? (
              <p className="px-3 py-2 text-xs text-shell-muted">No results</p>
            ) : (
              filteredSections.map((section) => (
                <div key={section.title ?? section.items[0]?.id}>
                  {section.title && (
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-shell-muted">
                      {section.title}
                    </p>
                  )}
                  <ul>
                    {section.items.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => selectItem(item)}
                          className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                            item.active
                              ? 'text-primary font-medium bg-primary/5'
                              : 'text-shell-text hover:bg-shell-bg'
                          }`}
                        >
                          <span className="block truncate">{item.label}</span>
                          {item.description && (
                            <span className="block truncate text-shell-muted">{item.description}</span>
                          )}
                        </button>
                      </li>
                    ))}
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
