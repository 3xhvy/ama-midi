import { Avatar } from '../../components/ui'

export function SongPersonCell({
  name,
  avatarUrl,
}: {
  name?: string | null
  avatarUrl?: string
}) {
  if (!name) {
    return <span className="text-xs text-shell-muted">—</span>
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Avatar name={name} src={avatarUrl} size="xs" />
      <span className="min-w-0 truncate text-xs text-shell-text">{name}</span>
    </div>
  )
}
