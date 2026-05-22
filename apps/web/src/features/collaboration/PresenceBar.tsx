interface PresenceUser {
  id: string
  name: string
  avatarUrl?: string
  email: string
}

interface Props {
  users: PresenceUser[]
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function getColorFromName(name: string): string {
  const colors = ['#6C63FF', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#8B5CF6', '#3B82F6']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export function PresenceBar({ users }: Props) {
  const visible = users.slice(0, 5)
  const overflow = users.length - visible.length

  return (
    <div className="flex items-center gap-1">
      {visible.map((user, i) => (
        <div
          key={user.id}
          title={user.name}
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white border-2 border-editor-surface cursor-default select-none overflow-hidden"
          style={{
            backgroundColor: getColorFromName(user.name),
            marginLeft: i > 0 ? '-8px' : '0',
            zIndex: visible.length - i,
            position: 'relative',
          }}
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="w-full h-full rounded-full object-cover" />
          ) : (
            getInitials(user.name)
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div className="w-8 h-8 rounded-full bg-shell-surface border border-shell-border flex items-center justify-center text-xs text-shell-muted" style={{ marginLeft: '-8px', position: 'relative', zIndex: 0 }}>
          +{overflow}
        </div>
      )}
    </div>
  )
}
