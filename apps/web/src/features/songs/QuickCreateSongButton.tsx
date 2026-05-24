import { LightningBoltIcon } from '@radix-ui/react-icons'
import { useNavigate } from 'react-router-dom'
import { Button, type ButtonProps } from '../../components/ui'
import { useAuthStore } from '../../store/auth.store'
import { useCreateProjectSong } from './useSongs'

export function QuickCreateSongButton({
  projectId,
  loading: loadingProp,
  disabled,
  variant = 'secondary',
  size = 'sm',
  rounded = true,
}: {
  projectId: string
  loading?: boolean
  disabled?: boolean
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
  rounded?: boolean
}) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const createSong = useCreateProjectSong(projectId)

  function quickCreate() {
    createSong.mutate(
      {
        name: 'Untitled',
        category: 'PROTOTYPE',
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
      data-tour="quick-create-song"
      size={size}
      variant={variant}
      rounded={rounded}
      icon={<LightningBoltIcon className="h-3.5 w-3.5" />}
      onClick={quickCreate}
      disabled={disabled}
      loading={loading}
    >
      Quick Create
    </Button>
  )
}
