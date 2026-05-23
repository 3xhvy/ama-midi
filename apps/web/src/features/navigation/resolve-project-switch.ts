import { projectPath, songEditorPath } from './song-editor-path.ts'

export function resolveProjectSwitchTarget(input: {
  projectId: string
  recentSongId: string | null
  songCount: number
}): string {
  if (input.recentSongId) return songEditorPath(input.projectId, input.recentSongId)
  return projectPath(input.projectId)
}
