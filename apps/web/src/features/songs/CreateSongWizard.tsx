import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Modal, ToggleGroup } from '../../components/ui'
import { useCreateProjectSong } from './useSongs'
import { ImportSongStep } from './ImportSongStep'
import type { CreateProjectSongInput, ImportSongOptions, Song, SongCategory, SongDifficulty } from '@ama-midi/shared'

type Step = 'start' | 'setup' | 'assignment' | 'review'
type StartType = 'BLANK' | 'TEMPLATE' | 'IMPORT'

const STARTS = [
  { value: 'BLANK', label: 'Blank' },
  { value: 'TEMPLATE', label: 'Template' },
  { value: 'IMPORT', label: 'Import' },
]

const CATEGORIES = [
  { value: 'MAIN_CAMPAIGN', label: 'Campaign' },
  { value: 'EVENT', label: 'Event' },
  { value: 'TUTORIAL', label: 'Tutorial' },
  { value: 'LIVE_OPS', label: 'Live Ops' },
  { value: 'PROTOTYPE', label: 'Prototype' },
  { value: 'QA_TEST', label: 'QA' },
  { value: 'TEMPLATE', label: 'Template' },
  { value: 'REFERENCE', label: 'Reference' },
]

const DIFFICULTIES = [
  { value: 'EASY', label: 'Easy' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HARD', label: 'Hard' },
  { value: 'EXPERT', label: 'Expert' },
  { value: 'MASTER', label: 'Master' },
]

export function CreateSongWizard({
  projectId,
  songs,
  onClose,
}: {
  projectId: string
  songs: Song[]
  onClose: () => void
}) {
  const navigate = useNavigate()
  const createSong = useCreateProjectSong(projectId)
  const [step, setStep] = useState<Step>('start')
  const [startType, setStartType] = useState<StartType>('BLANK')
  const [name, setName] = useState('')
  const [category, setCategory] = useState<SongCategory>('PROTOTYPE')
  const [difficulty, setDifficulty] = useState<SongDifficulty>('NORMAL')
  const [bpm, setBpm] = useState(120)
  const [timeSignature, setTimeSignature] = useState('4/4')
  const [assignedComposerId, setAssignedComposerId] = useState('')
  const [assignedQaId, setAssignedQaId] = useState('')
  const [importOptions, setImportOptions] = useState<ImportSongOptions>({
    sourceSongId: '',
    copySettings: true,
    copySections: true,
    copyPatterns: false,
    copyNotes: false,
  })

  const setupValid = name.trim() && bpm >= 40 && bpm <= 300
  const importValid = startType !== 'IMPORT' || importOptions.sourceSongId
  const canCreate = setupValid && importValid

  function create(openEditor: boolean) {
    if (!canCreate) return
    const body: CreateProjectSongInput = {
      name: name.trim(),
      category,
      difficulty,
      bpm,
      timeSignature,
      assignedComposerId: assignedComposerId || null,
      assignedQaId: assignedQaId || null,
      startType,
      import: startType === 'IMPORT' ? importOptions : undefined,
    }
    createSong.mutate(body, {
      onSuccess: (song) => {
        onClose()
        if (openEditor) navigate(`/projects/${projectId}/songs/${song.id}`)
      },
    })
  }

  return (
    <Modal.Root open onOpenChange={(open) => !open && onClose()}>
      <Modal.Content>
        <Modal.Header onClose={onClose}>Create Song</Modal.Header>
        <Modal.Body>
          <div className="mb-4 flex gap-2 text-xs text-shell-muted">
            {['start', 'setup', 'assignment', 'review'].map((item) => (
              <span key={item} className={step === item ? 'text-shell-text' : ''}>{item}</span>
            ))}
          </div>

          {step === 'start' && (
            <div className="space-y-3">
              <ToggleGroup items={STARTS} value={startType} onValueChange={(v) => setStartType(v as StartType)} />
              {startType === 'IMPORT' && (
                <ImportSongStep songs={songs} value={importOptions} onChange={setImportOptions} />
              )}
            </div>
          )}

          {step === 'setup' && (
            <div className="space-y-3">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Song name" autoFocus />
              <ToggleGroup items={CATEGORIES} value={category} onValueChange={(v) => setCategory(v as SongCategory)} />
              <ToggleGroup items={DIFFICULTIES} value={difficulty} onValueChange={(v) => setDifficulty(v as SongDifficulty)} />
              <input type="number" min={40} max={300} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="w-full rounded-md border border-shell-border bg-shell-bg px-3 py-2 text-sm text-shell-text" />
              <select value={timeSignature} onChange={(e) => setTimeSignature(e.target.value)} className="w-full rounded-md border border-shell-border bg-shell-bg px-3 py-2 text-sm text-shell-text">
                <option value="4/4">4/4</option>
                <option value="3/4">3/4</option>
                <option value="6/8">6/8</option>
              </select>
            </div>
          )}

          {step === 'assignment' && (
            <div className="space-y-3">
              <Input value={assignedComposerId} onChange={(e) => setAssignedComposerId(e.target.value)} placeholder="Composer user id" />
              <Input value={assignedQaId} onChange={(e) => setAssignedQaId(e.target.value)} placeholder="QA user id" />
            </div>
          )}

          {step === 'review' && (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-shell-muted">Start</dt><dd className="text-shell-text">{startType}</dd></div>
              <div className="flex justify-between"><dt className="text-shell-muted">Name</dt><dd className="text-shell-text">{name}</dd></div>
              <div className="flex justify-between"><dt className="text-shell-muted">Category</dt><dd className="text-shell-text">{category}</dd></div>
              <div className="flex justify-between"><dt className="text-shell-muted">Difficulty</dt><dd className="text-shell-text">{difficulty}</dd></div>
              <div className="flex justify-between"><dt className="text-shell-muted">BPM</dt><dd className="text-shell-text">{bpm}</dd></div>
              <div className="flex justify-between"><dt className="text-shell-muted">Time</dt><dd className="text-shell-text">{timeSignature}</dd></div>
            </dl>
          )}
        </Modal.Body>
        <Modal.Footer>
          {step !== 'start' && <Button variant="secondary" onClick={() => setStep(step === 'setup' ? 'start' : step === 'assignment' ? 'setup' : 'assignment')}>Back</Button>}
          {step !== 'review' ? (
            <Button onClick={() => setStep(step === 'start' ? 'setup' : step === 'setup' ? 'assignment' : 'review')} disabled={step === 'start' && !importValid}>Next</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => create(false)} disabled={!canCreate} loading={createSong.isPending}>Create</Button>
              <Button onClick={() => create(true)} disabled={!canCreate} loading={createSong.isPending}>Create and Open</Button>
            </>
          )}
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  )
}
