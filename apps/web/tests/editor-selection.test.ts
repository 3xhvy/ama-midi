import assert from 'node:assert/strict'
import { test } from 'node:test'
import { useEditorStore } from '../src/store/editor.store.ts'

test('focusing a note keeps the current multi-selection intact', () => {
  const store = useEditorStore.getState()

  store.clearSelection()
  store.toggleNoteSelection('note-a')
  store.toggleNoteSelection('note-b')
  useEditorStore.getState().focusNote('note-b')

  const state = useEditorStore.getState()
  assert.deepEqual([...state.selectedNoteIds].sort(), ['note-a', 'note-b'])
  assert.equal(state.selectedNoteId, 'note-b')
})

test('selectNotes replaces the current selection', () => {
  const store = useEditorStore.getState()

  store.clearSelection()
  store.toggleNoteSelection('note-a')
  store.selectNotes(['note-x', 'note-y', 'note-z'])

  const state = useEditorStore.getState()
  assert.deepEqual([...state.selectedNoteIds].sort(), ['note-x', 'note-y', 'note-z'])
  assert.equal(state.selectedNoteId, null)
})

test('adding a group of note ids preserves existing selected notes', () => {
  const store = useEditorStore.getState()

  store.clearSelection()
  store.selectNote('note-a')
  useEditorStore.getState().addNoteSelection(['note-b', 'note-c'])

  const state = useEditorStore.getState()
  assert.deepEqual([...state.selectedNoteIds].sort(), ['note-a', 'note-b', 'note-c'])
  assert.equal(state.selectedNoteId, null)
})
