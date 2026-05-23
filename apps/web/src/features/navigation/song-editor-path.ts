export function projectPath(projectId: string): string {
  return `/projects/${projectId}`
}

export function songEditorPath(projectId: string, songId: string): string {
  return `/projects/${projectId}/songs/${songId}`
}
