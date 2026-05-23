import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSongTemplate, type CreateProjectSongInput, type ImportSongOptions, type SongCategory, type SongDifficulty } from '@ama-midi/shared'
import { Button, Modal } from '../../../components/ui'
import { useAuthStore } from '../../../store/auth.store'
import { useProjectMembers } from '../../project-members/useProjectMembers'
import { useProjects } from '../../projects/useProjects'
import { useCreateProjectSong, useSongs } from '../useSongs'
import { CreateSongWizardStepper } from './CreateSongWizardStepper'
import { AssignmentStep } from './steps/AssignmentStep'
import { ReviewStep } from './steps/ReviewStep'
import { SetupStep } from './steps/SetupStep'
import { StartStep } from './steps/StartStep'
import {
  applyTemplateDefaults,
  validateSetupStep,
  validateStartStep,
  type SetupFields,
  type StartType,
  type WizardStep,
} from './wizard-logic'

const DEFAULT_IMPORT_OPTIONS: ImportSongOptions = {
  sourceSongId: '',
  copySettings: true,
  copySections: true,
  copyPatterns: false,
  copyNotes: false,
}

export function CreateSongWizard({
  projectId,
  onClose,
}: {
  projectId: string
  onClose: () => void
}) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const createSong = useCreateProjectSong(projectId)
  const { data: allSongs = [] } = useSongs()
  const { data: projects = [] } = useProjects()
  const { data: members = [] } = useProjectMembers(projectId)

  const [step, setStep] = useState<WizardStep>('start')
  const [startType, setStartType] = useState<StartType>('BLANK')
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<SongCategory>('PROTOTYPE')
  const [difficulty, setDifficulty] = useState<SongDifficulty>('NORMAL')
  const [bpm, setBpm] = useState(120)
  const [timeSignature, setTimeSignature] = useState('4/4')
  const [assignedComposerId, setAssignedComposerId] = useState<string | null>(null)
  const [assignedQaId, setAssignedQaId] = useState<string | null>(null)
  const [importOptions, setImportOptions] = useState<ImportSongOptions>(DEFAULT_IMPORT_OPTIONS)
  const [setupTouched, setSetupTouched] = useState(false)
  const [stepError, setStepError] = useState<string | null>(null)
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null)

  const projectNames = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p.name])),
    [projects],
  )

  const composerOptions = useMemo(
    () =>
      members
        .filter((m) => m.permission === 'EDIT' || m.permission === 'ADMIN')
        .map((m) => ({ value: m.userId, label: m.userName })),
    [members],
  )

  const qaOptions = useMemo(
    () =>
      members
        .filter((m) => ['READ', 'EDIT', 'ADMIN'].includes(m.permission))
        .map((m) => ({ value: m.userId, label: m.userName })),
    [members],
  )

  useEffect(() => {
    if (assignedComposerId || !user) return
    if (composerOptions.some((o) => o.value === user.id)) {
      setAssignedComposerId(user.id)
    }
  }, [assignedComposerId, composerOptions, user])

  const composerName =
    composerOptions.find((o) => o.value === assignedComposerId)?.label ?? null
  const qaName = qaOptions.find((o) => o.value === assignedQaId)?.label ?? null

  const importSourceName = allSongs.find((s) => s.id === importOptions.sourceSongId)?.name ?? null
  const templateName = templateId ? getSongTemplate(templateId)?.name ?? null : null

  function applySetupFields(fields: SetupFields) {
    setName(fields.name)
    setCategory(fields.category)
    setDifficulty(fields.difficulty)
    setBpm(fields.bpm)
    setTimeSignature(fields.timeSignature)
  }

  function onSetupChange(fields: Partial<SetupFields>) {
    setSetupTouched(true)
    if (fields.name !== undefined) setName(fields.name)
    if (fields.category !== undefined) setCategory(fields.category)
    if (fields.difficulty !== undefined) setDifficulty(fields.difficulty)
    if (fields.bpm !== undefined) setBpm(fields.bpm)
    if (fields.timeSignature !== undefined) setTimeSignature(fields.timeSignature)
  }

  function onTemplateSelect(id: string) {
    setTemplateId(id)
    if (setupTouched) {
      setPendingTemplateId(id)
    } else {
      applySetupFields(applyTemplateDefaults(id))
      setPendingTemplateId(null)
    }
  }

  function onTemplateOverwriteChoice(choice: 'keep' | 'apply') {
    if (choice === 'apply' && pendingTemplateId) {
      applySetupFields(applyTemplateDefaults(pendingTemplateId))
      setSetupTouched(false)
    }
    setPendingTemplateId(null)
  }

  function goNext() {
    setStepError(null)
    if (step === 'start') {
      const err = validateStartStep(
        startType,
        templateId,
        startType === 'IMPORT' ? importOptions : null,
      )
      if (err) {
        setStepError(err)
        return
      }
      setStep('setup')
      return
    }
    if (step === 'setup') {
      const err = validateSetupStep({ name, bpm, timeSignature })
      if (err) {
        setStepError(err)
        return
      }
      setStep('assignment')
      return
    }
    if (step === 'assignment') {
      setStep('review')
    }
  }

  function goBack() {
    setStepError(null)
    if (step === 'setup') setStep('start')
    else if (step === 'assignment') setStep('setup')
    else if (step === 'review') setStep('assignment')
  }

  function onStepClick(targetStep: WizardStep) {
    setStepError(null)
    setStep(targetStep)
  }

  function create(openEditor: boolean) {
    const err = validateSetupStep({ name, bpm, timeSignature })
    if (err) {
      setStepError(err)
      return
    }

    const body: CreateProjectSongInput = {
      name: name.trim(),
      category,
      difficulty,
      bpm,
      timeSignature,
      assignedComposerId: assignedComposerId || null,
      assignedQaId: assignedQaId || null,
      startType,
      templateId: startType === 'TEMPLATE' ? templateId : undefined,
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
      <Modal.Content className="max-w-[560px]">
        <Modal.Header onClose={onClose}>Create Song</Modal.Header>
        <Modal.Body className="max-h-[min(60vh,520px)] overflow-y-auto">
          <CreateSongWizardStepper current={step} onStepClick={onStepClick} />

          {step === 'start' && (
            <>
              <StartStep
                startType={startType}
                templateId={templateId}
                importOptions={importOptions}
                setupTouched={setupTouched}
                pendingTemplateId={pendingTemplateId}
                songs={allSongs}
                projectNames={projectNames}
                onStartTypeChange={setStartType}
                onTemplateSelect={onTemplateSelect}
                onTemplateOverwriteChoice={onTemplateOverwriteChoice}
                onImportChange={setImportOptions}
              />
              {stepError && <p className="mt-3 text-xs text-error">{stepError}</p>}
            </>
          )}

          {step === 'setup' && (
            <SetupStep
              name={name}
              category={category}
              difficulty={difficulty}
              bpm={bpm}
              timeSignature={timeSignature}
              error={stepError}
              onSetupChange={onSetupChange}
            />
          )}

          {step === 'assignment' && (
            <AssignmentStep
              composerOptions={composerOptions}
              qaOptions={qaOptions}
              assignedComposerId={assignedComposerId}
              assignedQaId={assignedQaId}
              onComposerChange={setAssignedComposerId}
              onQaChange={setAssignedQaId}
            />
          )}

          {step === 'review' && (
            <ReviewStep
              startType={startType}
              templateId={templateId}
              templateName={templateName}
              importSourceName={importSourceName}
              importOptions={startType === 'IMPORT' ? importOptions : null}
              name={name}
              category={category}
              difficulty={difficulty}
              bpm={bpm}
              timeSignature={timeSignature}
              composerName={composerName}
              qaName={qaName}
            />
          )}
        </Modal.Body>
        <Modal.Footer>
          {step !== 'start' && (
            <Button size="sm" variant="secondary" onClick={goBack}>
              Back
            </Button>
          )}
          {step !== 'review' ? (
            <Button size="sm" onClick={goNext}>
              Next
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => create(false)}
                loading={createSong.isPending}
              >
                Create
              </Button>
              <Button size="sm" onClick={() => create(true)} loading={createSong.isPending}>
                Create and Open
              </Button>
            </>
          )}
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  )
}
