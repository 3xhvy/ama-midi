import { useEffect, useMemo, useRef, useState } from 'react'
import { MagnifyingGlassIcon } from '@radix-ui/react-icons'
import { cn } from '../../lib/utils'

export interface SearchSelectOption {
  value: string
  label: string
  description?: string
}

export interface SearchSelectProps {
  options: SearchSelectOption[]
  value: string | string[]
  onChange: (value: string | string[]) => void
  multiple?: boolean
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  loading?: boolean
  disabled?: boolean
  className?: string
  onSearchChange?: (query: string) => void
}

function normalizeValues(value: string | string[]): string[] {
  return Array.isArray(value) ? value : value ? [value] : []
}

export function SearchSelect({
  options,
  value,
  onChange,
  multiple = false,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No results',
  loading = false,
  disabled = false,
  className,
  onSearchChange,
}: SearchSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selectedValues = useMemo(() => normalizeValues(value), [value])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(q)
      || (opt.description?.toLowerCase().includes(q) ?? false),
    )
  }, [options, query])

  const singleLabel = useMemo(() => {
    const match = options.find((opt) => opt.value === selectedValues[0])
    return match?.label ?? ''
  }, [options, selectedValues])

  const multiLabels = useMemo(
    () => selectedValues
      .map((id) => options.find((opt) => opt.value === id)?.label)
      .filter((label): label is string => Boolean(label)),
    [options, selectedValues],
  )

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  function toggleOption(optionValue: string) {
    if (multiple) {
      const next = selectedValues.includes(optionValue)
        ? selectedValues.filter((id) => id !== optionValue)
        : [...selectedValues, optionValue]
      onChange(next)
      return
    }
    onChange(optionValue)
    setOpen(false)
    setQuery('')
  }

  function openPanel() {
    if (disabled) return
    setOpen(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={openPanel}
        className={cn(
          'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors',
          'bg-[var(--modal-input-bg)] border-[var(--modal-input-border)] text-[var(--modal-input-text)]',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          {multiple ? (
            multiLabels.length > 0 ? (
              <span>{multiLabels.length} selected</span>
            ) : (
              <span style={{ color: 'var(--modal-input-placeholder)' }}>{placeholder}</span>
            )
          ) : singleLabel ? (
            singleLabel
          ) : (
            <span style={{ color: 'var(--modal-input-placeholder)' }}>{placeholder}</span>
          )}
        </span>
        <span className="ml-2 text-xs" style={{ color: 'var(--modal-muted)' }}>▾</span>
      </button>

      {multiple && multiLabels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {multiLabels.map((label, index) => (
            <span
              key={`${label}-${index}`}
              className="rounded-full border px-2 py-0.5 text-xs"
              style={{
                borderColor: 'var(--modal-input-border)',
                backgroundColor: 'var(--modal-input-bg)',
                color: 'var(--modal-input-text)',
              }}
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {open && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-lg border shadow-md"
          style={{
            backgroundColor: 'var(--modal-bg)',
            borderColor: 'var(--modal-border)',
            boxShadow: 'var(--modal-shadow)',
          }}
        >
          <div
            className="flex items-center gap-2 border-b px-3 py-2"
            style={{ borderColor: 'var(--modal-border)' }}
          >
            <MagnifyingGlassIcon className="h-4 w-4 shrink-0" style={{ color: 'var(--modal-muted)' }} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                onSearchChange?.(e.target.value)
              }}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm outline-none"
              style={{ color: 'var(--modal-input-text)' }}
            />
          </div>

          <ul className="max-h-52 overflow-y-auto py-1">
            {loading && (
              <li className="px-3 py-2 text-sm" style={{ color: 'var(--modal-muted)' }}>
                Loading…
              </li>
            )}
            {!loading && filtered.length === 0 && (
              <li className="px-3 py-2 text-sm" style={{ color: 'var(--modal-muted)' }}>
                {emptyMessage}
              </li>
            )}
            {!loading && filtered.map((option) => {
              const selected = selectedValues.includes(option.value)
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => toggleOption(option.value)}
                    className={cn(
                      'flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:opacity-90',
                      selected && 'bg-primary/10',
                    )}
                  >
                    {multiple && (
                      <span
                        className={cn(
                          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]',
                          selected ? 'border-primary bg-primary text-white' : 'border-[var(--modal-input-border)]',
                        )}
                      >
                        {selected ? '✓' : ''}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium" style={{ color: 'var(--modal-text)' }}>
                        {option.label}
                      </span>
                      {option.description && (
                        <span className="block truncate text-xs" style={{ color: 'var(--modal-muted)' }}>
                          {option.description}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
