export const MEMBER_PERMISSION_OPTIONS = [
  { value: 'READ', label: 'Read' },
  { value: 'EDIT', label: 'Edit' },
  { value: 'ADMIN', label: 'Admin' },
] as const

export const MEMBER_SCOPE_OPTIONS = [
  { value: 'ALL_SONGS', label: 'All' },
  { value: 'SELECTED_SONGS', label: 'Selected' },
  { value: 'NO_SONGS', label: 'None' },
] as const
