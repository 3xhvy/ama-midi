import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Song, SongStatus } from '@ama-midi/shared'
import { useProjectSongs } from '../../songs/useSongs'
import { getRecentSongForProject } from '../../navigation/recent-navigation'
import { songEditorPath } from '../../navigation/song-editor-path'
import { NavDropdown } from '../../navigation/NavDropdown'

const STATUS_SECTIONS: { title: string; statuses: SongStatus[] }[] = [
  { title: 'Draft', statuses: ['DRAFT', 'NEEDS_FIX'] },
  { title: 'In Review', statuses: ['IN_REVIEW'] },
  { title: 'Approved', statuses: ['APPROVED', 'PUBLISHED'] },
]

interface Props {
  projectId: string
  projectName: string
  currentSongId: string
  currentSongName: string
  variant?: 'default' | 'breadcrumb' | 'toolbar'
  accent?: 'default' | 'project' | 'song'
}

function toItem(song: Song, currentSongId: string, onSelect: (song: Song) => void) {
  return {
    id: song.id,
    label: song.name,
    description: song.status.replace(/_/g, ' '),
    active: song.id === currentSongId,
    onSelect: () => onSelect(song),
  }
}

export function SongSwitcher({
  projectId,
  projectName,
  currentSongId,
  currentSongName,
  variant = 'default',
  accent = 'default',
}: Props) {
  const navigate = useNavigate()
  const { data: songs = [] } = useProjectSongs(projectId)
  const recentSongId = getRecentSongForProject(localStorage, projectId)

  function go(song: Song) {
    if (song.id !== currentSongId) navigate(songEditorPath(projectId, song.id))
  }

  const sections = useMemo(() => {
    const result = []

    if (recentSongId) {
      const recent = songs.find((s) => s.id === recentSongId)
      if (recent) {
        result.push({
          title: 'Recent in this project',
          items: [toItem(recent, currentSongId, go)],
        })
      }
    }

    for (const section of STATUS_SECTIONS) {
      const items = songs
        .filter((s) => section.statuses.includes(s.status))
        .map((s) => toItem(s, currentSongId, go))
      if (items.length) result.push({ title: section.title, items })
    }

    return result
  }, [songs, recentSongId, currentSongId, projectId])

  return (
    <NavDropdown
      variant={variant}
      accent={accent}
      dropdownId="song-switcher-drop"
      triggerLabel={currentSongName}
      searchPlaceholder={`Search songs in ${projectName}…`}
      sections={sections}
      triggerClassName={
        variant === 'toolbar'
          ? 'max-w-[100px] sm:max-w-[140px]'
          : variant === 'breadcrumb'
            ? 'max-w-[100px] sm:max-w-[140px]'
            : 'max-w-[160px]'
      }
    />
  )
}
