import { useRef, useCallback } from 'react'

export function useThrottle<T extends (...args: Parameters<T>) => void>(
  fn: T,
  limitMs: number,
): T {
  const lastCallRef = useRef(0)
  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now()
      if (now - lastCallRef.current >= limitMs) {
        lastCallRef.current = now
        fn(...args)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn, limitMs],
  ) as T
}
