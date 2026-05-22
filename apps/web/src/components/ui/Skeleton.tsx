import { cn } from '../../lib/utils'

const roundedMap = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
} as const

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number
  height?: string | number
  rounded?: keyof typeof roundedMap
}

export function Skeleton({ className, width, height, rounded = 'md', style, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse bg-shell-border', roundedMap[rounded], className)}
      style={{ width, height, ...style }}
      {...props}
    />
  )
}
