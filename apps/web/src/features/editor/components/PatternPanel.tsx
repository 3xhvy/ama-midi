import { usePatterns, useDeletePattern } from '../../patterns/usePatterns'
import { useCreateNote } from '../../notes/useNotes'
import { useEditorStore } from '../../../store/editor.store'
import { toast } from 'sonner'
import type { NotePattern } from '@ama-midi/shared'

interface Props { songId: string }

export function PatternPanel({ songId }: Props) {
  const { data: patterns = [] } = usePatterns()
  const deletePattern = useDeletePattern()
  const createNote    = useCreateNote(songId)
  const playheadTime  = useEditorStore(s => s.playheadTime)

  async function handlePaste(pattern: NotePattern) {
    let ok = 0, conflicts = 0
    for (const pn of pattern.notes) {
      try {
        await createNote.mutateAsync({
          track:    pn.track,
          time:     playheadTime + pn.timeOffset,
          title:    `${pattern.name} ${pn.track}`,
          noteType: pn.noteType,
          duration: pn.duration,
        })
        ok++
      } catch (e: any) {
        if (e?.status === 409) conflicts++
        else throw e
      }
    }
    const summary = `Pasted ${ok}/${pattern.notes.length} notes` + (conflicts ? ` (${conflicts} conflicts)` : '')
    if (conflicts) toast.warning(summary)
    else           toast.success(summary)
  }

  return (
    <div className="px-3 py-2 border-t border-shell-border">
      <div className="text-xs font-medium text-shell-text uppercase tracking-wide mb-2">Patterns</div>
      {patterns.length === 0 ? (
        <p className="text-[10px] text-shell-muted">No patterns yet. Select 2+ notes and save as pattern.</p>
      ) : (
        <ul className="space-y-1">
          {patterns.map(p => (
            <li key={p.id} className="flex items-center justify-between text-xs">
              <span className="truncate text-shell-text">{p.name} <span className="text-shell-muted">({p.notes.length})</span></span>
              <div className="flex gap-1">
                <button
                  onClick={() => handlePaste(p)}
                  className="px-1.5 py-0.5 text-[10px] rounded border border-shell-border text-shell-muted hover:text-shell-text"
                >
                  Paste
                </button>
                <button
                  onClick={() => deletePattern.mutate(p.id)}
                  className="px-1.5 py-0.5 text-[10px] rounded text-shell-muted/60 hover:text-red-400"
                  title="Delete pattern"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
