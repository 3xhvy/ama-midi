export interface UndoResolution {
  conflictId: string
  action: 'KEEP_EXISTING' | 'REPLACE_WITH_UNDO'
}
