export type UserRole = 'ADMIN' | 'COMPOSER' | 'VIEWER'
export type NoteEventType = 'NOTE_CREATED' | 'NOTE_UPDATED' | 'NOTE_DELETED'

export interface AuthUser {
  id:              string
  email:           string
  name:            string
  avatarUrl?:      string
  role:            UserRole
  title?:          string
  department?:     string
  profileComplete: boolean
  tourComplete:    boolean
}

export interface Song {
  id:               string
  name:             string
  createdBy:        string
  creatorName:      string
  creatorAvatarUrl?: string
  noteCount:        number
  createdAt:        string
  updatedAt:        string
}

export interface Note {
  id: string
  songId: string
  track: number
  time: number
  title: string
  description: string
  color: string
  createdBy: string
  creatorName: string
  createdAt: string
  updatedAt: string
}

export interface NoteEvent {
  id: string
  songId: string
  noteId: string | null
  eventType: NoteEventType
  userId: string
  userName: string
  userAvatarUrl?: string
  timestamp: string
  beforeState: Partial<Note> | null
  afterState: Partial<Note> | null
}

export interface NoteSuggestion {
  track: number
  time: number
  color: string
}
