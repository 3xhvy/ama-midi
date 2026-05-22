import { forwardRef } from 'react'
import { cn, getInitials, getColorFromName } from '../../lib/utils'

const sizeMap     = { xs: 24, sm: 32, md: 40, lg: 48 } as const
const textSizeMap = { xs: 'text-[9px]', sm: 'text-xs', md: 'text-sm', lg: 'text-base' } as const

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string
  name: string
  size?: keyof typeof sizeMap
  showOnline?: boolean
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, name, size = 'md', showOnline, ...props }, ref) => {
    const px = sizeMap[size]
    return (
      <div
        ref={ref}
        className={cn('relative inline-flex items-center justify-center rounded-full overflow-hidden shrink-0', className)}
        style={{ width: px, height: px, backgroundColor: getColorFromName(name) }}
        title={name}
        {...props}
      >
        {src ? (
          <img src={src} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className={cn('font-medium text-white select-none', textSizeMap[size])}>
            {getInitials(name)}
          </span>
        )}
        {showOnline && (
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-shell-surface rounded-full" />
        )}
      </div>
    )
  },
)
Avatar.displayName = 'Avatar'
