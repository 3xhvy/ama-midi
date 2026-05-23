import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSongs } from '../../songs/useSongs'

interface Props {
  currentSongId: string
  currentSongName: string
}

export function SongSwitcher({ currentSongId, currentSongName }: Props) {
  const [open,    setOpen]    = useState(false)
  const [query,   setQuery]   = useState('')
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })
  const btnRef   = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { data: songs = [] } = useSongs()

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
      if (!btnRef.current?.contains(target) && !(document.getElementById('song-switcher-drop')?.contains(target))) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const filtered = songs
    .filter(s => s.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 5)

  function go(id: string) {
    setOpen(false)
    setQuery('')
    if (id !== currentSongId) navigate(`/songs/${id}`)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => open ? setOpen(false) : openDropdown()}
        className="flex items-center gap-1 text-shell-text font-medium text-sm hover:text-primary transition-colors max-w-[160px]"
        title={currentSongName}
      >
        <span className="truncate">{currentSongName}</span>
        <svg
          width="10" height="10" viewBox="0 0 10 10"
          className={`shrink-0 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div
          id="song-switcher-drop"
          style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, zIndex: 9999 }}
          className="w-56 bg-shell-surface border border-shell-border rounded-lg shadow-md overflow-hidden"
        >
          <div className="p-2 border-b border-shell-border">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search songs…"
              className="w-full px-2 py-1 text-xs bg-shell-bg border border-shell-border rounded text-shell-text placeholder:text-shell-muted outline-none focus:border-primary"
            />
          </div>
          <ul className="py-1 max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-shell-muted">No songs found</li>
            ) : (
              filtered.map(s => (
                <li key={s.id}>
                  <button
                    onClick={() => go(s.id)}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors truncate ${
                      s.id === currentSongId
                        ? 'text-primary font-medium bg-primary/5'
                        : 'text-shell-text hover:bg-shell-bg'
                    }`}
                  >
                    {s.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </>
  )
}
