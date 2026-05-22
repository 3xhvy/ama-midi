import { TapNote, type NoteVariantProps } from './TapNote'
import { HoldNote } from './HoldNote'
import { SwipeNote } from './SwipeNote'

export type NoteCircleProps = NoteVariantProps

export function NoteCircle(props: NoteCircleProps) {
  if (props.note.noteType === 'HOLD')  return <HoldNote {...props} />
  if (props.note.noteType === 'SWIPE') return <SwipeNote {...props} />
  return <TapNote {...props} />
}
