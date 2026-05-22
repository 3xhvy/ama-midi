import { Avatar, type AvatarProps } from './Avatar'
import { cn } from '../../lib/utils'

export interface AvatarStackProps {
  users: { id: string; name: string; avatarUrl?: string; title?: string | null; department?: string | null }[]
  max?: number
  size?: AvatarProps['size']
  className?: string
}

function buildTooltip(user: AvatarStackProps['users'][number]): string {
  const parts = [user.name, user.title, user.department].filter(Boolean)
  return parts.join(' · ')
}

export function AvatarStack({ users, max = 5, size = 'sm', className }: AvatarStackProps) {
  const visible  = users.slice(0, max)
  const overflow = users.length - visible.length
  return (
    <div className={cn('flex items-center', className)}>
      {visible.map((user, i) => (
        <div
          key={user.id}
          className="border-2 border-shell-surface rounded-full"
          style={{ marginLeft: i > 0 ? -8 : 0, zIndex: visible.length - i, position: 'relative' }}
        >
          <Avatar src={user.avatarUrl} name={user.name} size={size} showOnline title={buildTooltip(user)} />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="flex items-center justify-center rounded-full bg-shell-bg border border-shell-border text-xs text-shell-muted font-medium"
          style={{ width: size === 'sm' ? 32 : 40, height: size === 'sm' ? 32 : 40, marginLeft: -8, position: 'relative', zIndex: 0 }}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
