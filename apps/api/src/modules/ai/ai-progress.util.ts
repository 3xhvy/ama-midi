import { AI_STREAM_STEPS, type AiStreamStepDef } from '@ama-midi/shared'

export type AiProgressEmitter = (event: {
  type: 'step'
  stepId: string
  label: string
  status: 'active' | 'done' | 'error'
  detail?: string
}) => void

export async function runStep<T>(
  steps: AiStreamStepDef[],
  stepId: string,
  onProgress: AiProgressEmitter | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const def = steps.find((s) => s.stepId === stepId)!
  onProgress?.({ type: 'step', stepId, label: def.label, status: 'active' })
  try {
    const result = await fn()
    onProgress?.({ type: 'step', stepId, label: def.label, status: 'done' })
    return result
  } catch (e) {
    onProgress?.({ type: 'step', stepId, label: def.label, status: 'error' })
    throw e
  }
}

export { AI_STREAM_STEPS }

/** Emit a detail message on an already-active step without changing its status. */
export function emitDetail(
  steps: AiStreamStepDef[],
  stepId: string,
  detail: string,
  onProgress: AiProgressEmitter | undefined,
): void {
  if (!onProgress) return
  const def = steps.find((s) => s.stepId === stepId)
  if (!def) return
  onProgress({ type: 'step', stepId, label: def.label, status: 'active', detail })
}
