import type {
  NoteEventType,
  NoteType,
  ProjectPermission,
  ProjectStatus,
  SongCategory,
  SongDifficulty,
  SongScope,
  SongStatus,
  UserRole,
} from './enums'

export type {
  NoteEventType,
  NoteType,
  ProjectPermission,
  ProjectStatus,
  SongCategory,
  SongDifficulty,
  SongScope,
  SongStatus,
  UserRole,
} from './enums'

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

export interface UserSearchResult {
  id:        string
  name:      string
  email:     string
  avatarUrl?: string
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

export interface DashboardSongRow {
  id: string
  projectId: string
  projectName: string
  name: string
  status: SongStatus
  assignedComposerName?: string | null
  assignedQaName?: string | null
  updatedAt: string
}

export interface DashboardFeed {
  recentSongs: DashboardSongRow[]
  assignedToMe: DashboardSongRow[]
  needsReview: DashboardSongRow[]
}

import type { ChartReadOnlyReason } from './chart-edit-access'

export interface SongWorkflowInfo {
  status: SongStatus
  allowedTransitions: SongStatus[]
  canEditChart: boolean
  readOnlyReason: ChartReadOnlyReason | null
}

export interface Note {
  id: string
  songId: string
  chartId: string
  track: number
  time: number
  title: string
  description: string
  createdBy: string
  creatorName: string
  creatorAvatarUrl?: string
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

export type ConflictAction = 'KEEP_EXISTING' | 'REPLACE_WITH_PATTERN'

export interface PatternPastePreviewRequest {
  songId: string
  startTime: number
}

export interface PatternPasteCreatableNote {
  patternNoteIndex: number
  track: number
  time: number
  noteType: NoteType
  duration?: number
}

export interface PatternPasteConflict {
  conflictId: string
  patternNoteIndex: number
  track: number
  time: number
  patternNote: {
    track: number
    timeOffset: number
    noteType: NoteType
    duration?: number
  }
  existingNote: {
    id: string
    title: string
    description: string
    track: number
    time: number
    noteType: NoteType
    duration?: number
    createdBy: string
    creatorName: string
    creatorAvatarUrl?: string
    createdAt: string
  }
}

export interface PatternPastePreview {
  patternId: string
  patternVersion: string
  songId: string
  startTime: number
  summary: {
    totalPatternNotes: number
    creatableNotes: number
    conflictCount: number
    affectedExistingNotes: number
  }
  creatable: PatternPasteCreatableNote[]
  conflicts: PatternPasteConflict[]
}

export interface PatternPasteApplyRequest {
  songId: string
  startTime: number
  patternVersion: string
  resolutions: Array<{
    conflictId: string
    action: ConflictAction
  }>
}

export interface PatternPasteApplyResult {
  batchId: string
  createdCount: number
  replacedCount: number
  skippedCount: number
  notes: Note[]
}
