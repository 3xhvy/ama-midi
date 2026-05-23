export type UserRole = 'ADMIN' | 'COMPOSER' | 'VIEWER'
export type NoteEventType = 'NOTE_CREATED' | 'NOTE_UPDATED' | 'NOTE_DELETED'
export type NoteType = 'TAP' | 'HOLD' | 'SWIPE'

export type ProjectStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
export type ProjectPermission = 'READ' | 'EDIT' | 'ADMIN'
export type SongScope = 'ALL_SONGS' | 'SELECTED_SONGS' | 'NO_SONGS'
export type SongStatus = 'DRAFT' | 'IN_REVIEW' | 'NEEDS_FIX' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED'
export type SongCategory =
  | 'MAIN_CAMPAIGN'
  | 'EVENT'
  | 'TUTORIAL'
  | 'LIVE_OPS'
  | 'PROTOTYPE'
  | 'QA_TEST'
  | 'TEMPLATE'
  | 'REFERENCE'
export type SongDifficulty = 'EASY' | 'NORMAL' | 'HARD' | 'EXPERT' | 'MASTER'

export interface Project {
  id: string
  name: string
  description?: string | null
  status: ProjectStatus
  ownerId: string
  songCount: number
  memberCount: number
  createdAt: string
  updatedAt: string
  archivedAt?: string | null
}

export interface ProjectMember {
  id: string
  projectId: string
  userId: string
  userName: string
  userAvatarUrl?: string
  permission: ProjectPermission
  songScope: SongScope
  selectedSongIds: string[]
  createdAt: string
  updatedAt: string
}

export interface ImportSongOptions {
  sourceSongId: string
  copySettings: boolean
  copySections: boolean
  copyPatterns: boolean
  copyNotes: boolean
}

export interface CreateProjectSongInput {
  name: string
  category: SongCategory
  difficulty: SongDifficulty
  bpm: number
  timeSignature: string
  assignedComposerId?: string | null
  assignedQaId?: string | null
  startType: 'BLANK' | 'TEMPLATE' | 'IMPORT'
  templateId?: string | null
  import?: ImportSongOptions
}

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
  projectId:        string
  name:             string
  category:         SongCategory
  status:           SongStatus
  difficulty:       SongDifficulty
  assignedComposerId?: string | null
  assignedComposerName?: string | null
  assignedQaId?: string | null
  assignedQaName?: string | null
  sourceSongId?: string | null
  archivedAt?: string | null
  createdBy:        string
  creatorName:      string
  creatorAvatarUrl?: string
  noteCount:        number
  createdAt:        string
  updatedAt:        string
  bpm:              number
  timeSignature:    string
}

export interface Note {
  id: string
  songId: string
  track: number
  time: number
  title: string
  description: string
  createdBy: string
  creatorName: string
  createdAt: string
  updatedAt: string
  noteType: NoteType
  duration?: number
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
}

export interface SectionMarker {
  id:          string
  songId:      string
  time:        number
  label:       string
  color:       string
  createdBy:   string
  creatorName: string
  createdAt:   string
}

export interface PatternNote {
  track:      number
  timeOffset: number
  noteType:   NoteType
  duration?:  number
}

export interface NotePattern {
  id:        string
  name:      string
  notes:     PatternNote[]
  createdBy: string
  songId:    string | null
  createdAt: string
}
