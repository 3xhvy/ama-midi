export interface SortablePresenceUser {
  id: string
  name: string
}

export function sortPresenceUsers<T extends SortablePresenceUser>(
  users: T[],
  currentUserId: string,
): T[] {
  return [...users].sort((a, b) => {
    if (a.id === currentUserId) return -1
    if (b.id === currentUserId) return 1
    return a.name.localeCompare(b.name)
  })
}
