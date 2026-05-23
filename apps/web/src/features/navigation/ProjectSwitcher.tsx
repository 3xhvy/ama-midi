import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjects } from '../projects/useProjects'
import {
  getRecentProjects,
  getRecentSongForProject,
  recordRecentProject,
} from './recent-navigation'
import { resolveProjectSwitchTarget } from './resolve-project-switch'
import { NavDropdown } from './NavDropdown'

export function ProjectSwitcher({
  currentProjectId,
  currentProjectName,
  variant = 'default',
  accent = 'default',
}: {
  currentProjectId: string
  currentProjectName: string
  variant?: 'default' | 'breadcrumb' | 'toolbar'
  accent?: 'default' | 'project' | 'song'
}) {
  const navigate = useNavigate()
  const { data: projects = [] } = useProjects()

  function openProject(projectId: string, songCount: number) {
    recordRecentProject(localStorage, projectId)
    const target = resolveProjectSwitchTarget({
      projectId,
      recentSongId: getRecentSongForProject(localStorage, projectId),
      songCount,
    })
    navigate(target)
  }

  const sections = useMemo(() => {
    const recentIds = getRecentProjects(localStorage)
    const recentProjects = recentIds
      .map((id) => projects.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))

    const recentItems = recentProjects.map((project) => ({
      id: project.id,
      label: project.name,
      description: `${project.songCount} songs`,
      active: project.id === currentProjectId,
      onSelect: () => openProject(project.id, project.songCount),
    }))

    const allItems = projects.map((project) => ({
      id: project.id,
      label: project.name,
      description: `${project.songCount} songs`,
      active: project.id === currentProjectId,
      onSelect: () => openProject(project.id, project.songCount),
    }))

    const result = []
    if (recentItems.length) result.push({ title: 'Recent projects', items: recentItems })
    result.push({ title: 'My projects', items: allItems })
    return result
  }, [projects, currentProjectId, navigate])

  return (
    <NavDropdown
      variant={variant}
      accent={accent}
      dropdownId="project-switcher-drop"
      triggerLabel={currentProjectName}
      searchPlaceholder="Search projects…"
      sections={sections}
      triggerClassName={
        variant === 'toolbar'
          ? 'max-w-[120px] sm:max-w-[150px]'
          : variant === 'breadcrumb'
            ? 'max-w-[120px] sm:max-w-[150px]'
            : 'max-w-[140px]'
      }
    />
  )
}
