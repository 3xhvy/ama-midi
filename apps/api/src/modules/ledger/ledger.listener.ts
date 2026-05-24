import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { NOTE_EVENTS } from '@ama-midi/shared'
import type { NoteCreatedEvent, NoteDeletedEvent, NoteUpdatedEvent } from '@ama-midi/shared'
import { EditorEventService } from './editor-event.service'

@Injectable()
export class LedgerListener {
  constructor(private readonly editorEvents: EditorEventService) {}

  @OnEvent(NOTE_EVENTS.CREATED)
  onNoteCreated({ songId, noteId, userId, afterState, batchId, replacesNoteId }: NoteCreatedEvent) {
    return this.editorEvents.record({
      songId,
      chartId: afterState.chartId,
      entityType: 'NOTE',
      entityId: noteId,
      eventType: 'NOTE_CREATED',
      userId,
      afterState: afterState as object,
      batchId: batchId ?? null,
      replacesEventId: replacesNoteId ?? null,
      undoable: true,
    })
  }

  @OnEvent(NOTE_EVENTS.UPDATED)
  onNoteUpdated({ songId, noteId, userId, beforeState, afterState }: NoteUpdatedEvent) {
    return this.editorEvents.record({
      songId,
      chartId: afterState.chartId,
      entityType: 'NOTE',
      entityId: noteId,
      eventType: 'NOTE_UPDATED',
      userId,
      beforeState: beforeState as object,
      afterState: afterState as object,
      undoable: true,
    })
  }

  @OnEvent(NOTE_EVENTS.DELETED)
  onNoteDeleted({ songId, noteId, userId, beforeState, batchId }: NoteDeletedEvent) {
    return this.editorEvents.record({
      songId,
      chartId: (beforeState as any).chartId as string | undefined,
      entityType: 'NOTE',
      entityId: noteId,
      eventType: 'NOTE_DELETED',
      userId,
      beforeState: beforeState as object,
      batchId: batchId ?? null,
      undoable: true,
    })
  }
}
