import type { Song } from '@ama-midi/shared'

function normalizeAvatarUrl(url?: string | null): string | undefined {
  const trimmed = url?.trim()
  return trimmed || undefined
}

/** Prefer explicit role avatar; reuse creator/composer photo when same user id. */
export function resolveSongPersonAvatar(
  song: Song,
  role: 'creator' | 'composer' | 'qa',
): string | undefined {
  const direct =
    role === 'creator'
      ? song.creatorAvatarUrl
      : role === 'composer'
        ? song.assignedComposerAvatarUrl
        : song.assignedQaAvatarUrl

  const normalized = normalizeAvatarUrl(direct)
  if (normalized) return normalized

  const userId =
    role === 'creator'
      ? song.createdBy
      : role === 'composer'
        ? song.assignedComposerId
        : song.assignedQaId

  if (!userId) return undefined

  if (userId === song.createdBy) return normalizeAvatarUrl(song.creatorAvatarUrl)
  if (userId === song.assignedComposerId) {
    return normalizeAvatarUrl(song.assignedComposerAvatarUrl)
  }

  return undefined
}
