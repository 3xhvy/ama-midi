import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui'
import { useAuthStore } from '../../store/auth.store'
import { useCreateProjectSong } from './useSongs'

export function QuickCreateSongButton({
  projectId,
  loading: loadingProp,
  disabled,
}: {
  projectId: string
  loading?: boolean
  disabled?: boolean
}) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const createSong = useCreateProjectSong(projectId)

  function quickCreate() {
    createSong.mutate(
      {
        name: 'Untitled',
        category: 'PROTOTYPE',
        difficulty: 'NORMAL',
        bpm: 120,
        timeSignature: '4/4',
        startType: 'BLANK',
        assignedComposerId: user?.id ?? null,
        assignedQaId: null,
      },
      {
        onSuccess: (song) => navigate(`/projects/${projectId}/songs/${song.id}`),
      },
    )
  }

  const loading = Boolean(loadingProp) || createSong.isPending

  return (
    <Button
      id="quick-create-trigger"
      size="sm"
      rounded
      onClick={quickCreate}
      disabled={disabled}
      loading={loading}
    >
      Quick Create
    </Button>
  )
}
