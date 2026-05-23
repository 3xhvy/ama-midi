import type { Project, ProjectStatus } from '@ama-midi/shared'

export type ProjectDirectoryStatusFilter = 'ALL' | ProjectStatus

export function filterProjects(
  projects: Project[],
  input: { query: string; status: ProjectDirectoryStatusFilter },
): Project[] {
  const query = input.query.trim().toLowerCase()

  return projects.filter((project) => {
    const description = project.description ?? ''
    const matchesQuery =
      !query ||
      project.name.toLowerCase().includes(query) ||
      description.toLowerCase().includes(query)
    const matchesStatus = input.status === 'ALL' || project.status === input.status
    return matchesQuery && matchesStatus
  })
}
