import {
  SongCategoryEnum,
  SUPPORTED_TIME_SIGNATURES,
  type SongCategory,
} from '@ama-midi/shared'
import { Input } from '../../../../components/ui'
import type { SetupFields } from '../wizard-logic'

export interface SetupStepProps {
  name: string
  category: SongCategory
  bpm: number
  timeSignature: string
  error?: string | null
  onSetupChange: (fields: Partial<SetupFields>) => void
}

const selectClassName =
  'w-full rounded-lg border border-shell-border bg-shell-surface px-3 py-2 text-sm text-shell-text focus:outline-none focus:ring-2 focus:ring-primary/30'

export function SetupStep({
  name,
  category,
  bpm,
  timeSignature,
  error,
  onSetupChange,
}: SetupStepProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-shell-text">Song details</h3>

      <p className="text-xs leading-relaxed text-shell-muted">
        Difficulty is computed automatically from your chart after you add notes.
      </p>

      <div>
        <label className="mb-1 block text-xs text-shell-muted">Name</label>
        <Input
          value={name}
          onChange={(e) => onSetupChange({ name: e.target.value })}
          autoFocus
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-shell-muted">Category</label>
        <select
          value={category}
          onChange={(e) => onSetupChange({ category: e.target.value as SongCategory })}
          className={selectClassName}
        >
          {SongCategoryEnum.keys.map((key) => (
            <option key={key} value={key}>
              {SongCategoryEnum.label(key)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-shell-muted">BPM</label>
          <Input
            type="number"
            min={40}
            max={300}
            value={String(bpm)}
            onChange={(e) => onSetupChange({ bpm: Number(e.target.value) || 0 })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-shell-muted">Time signature</label>
          <select
            value={timeSignature}
            onChange={(e) => onSetupChange({ timeSignature: e.target.value })}
            className={selectClassName}
          >
            {SUPPORTED_TIME_SIGNATURES.map((sig) => (
              <option key={sig} value={sig}>
                {sig}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  )
}
