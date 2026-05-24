import { useRef, useCallback } from 'react'

export function useThrottle<T extends (...args: Parameters<T>) => void>(
  fn: T,
  limitMs: number,
  trailing = false,
): T {
  const lastCallRef     = useRef(0)
  const trailingRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastArgsRef     = useRef<Parameters<T> | null>(null)

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now()
      lastArgsRef.current = args

      if (trailingRef.current) {
        clearTimeout(trailingRef.current)
        trailingRef.current = null
      }

      if (now - lastCallRef.current >= limitMs) {
        lastCallRef.current = now
        fn(...args)
      } else if (trailing) {
        const remaining = limitMs - (now - lastCallRef.current)
        trailingRef.current = setTimeout(() => {
          lastCallRef.current  = Date.now()
          trailingRef.current  = null
          const pending = lastArgsRef.current
          if (pending) fn(...(pending as Parameters<T>))
        }, remaining)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn, limitMs, trailing],
  ) as T
}
