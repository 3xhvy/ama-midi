import type { ChartFactorBreakdown } from './difficulty/types'
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
  assignedComposerId?: string | null
  assignedComposerName?: string | null
  assignedComposerAvatarUrl?: string
  assignedQaId?: string | null
  assignedQaName?: string | null
  assignedQaAvatarUrl?: string
  sourceSongId?: string | null
  archivedAt?: string | null
  createdBy:        string
  creatorName:      string
  creatorAvatarUrl?: string
  noteCount:        number
  chartSummary?:    string
  charts?:          SongChart[]
  createdAt:        string
  updatedAt:        string
  bpm:              number
  timeSignature:    string
}

export interface SongChart {
  id: string
  songId: string
  name: string
  speedMultiplier: number
  computedDifficulty: SongDifficulty
  averageDifficultyScore: number
  peakDifficultyScore: number
  factorBreakdown?: ChartFactorBreakdown | null
  analyzedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface ChartDifficultySegment {
  id: string
  chartId: string
  startTimeMs: number
  endTimeMs: number
  notesPerSecond: number
  averageLaneJump: number
  offbeatRatio: number
  holdNoteRatio: number
  simultaneousNoteRatio: number
  patternComplexityScore: number
  difficultyScore: number
  difficultyLevel: SongDifficulty
}

export type ValidationSeverity = 'INFO' | 'WARN' | 'ERROR'

export interface ChartValidationWarning {
  id: string
  chartId: string
  code: string
  severity: ValidationSeverity
  startTimeMs?: number | null
  endTimeMs?: number | null
  message: string
  metadata?: Record<string, unknown> | null
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

import type { SnapMode } from './snap'

export type { SnapMode }

export interface NoteSuggestion {
  track: number
  time: number
}

export type SuggestNotesMode = 'continue_pattern' | 'fill_track' | 'refine_pattern'

export interface SuggestNotesRequest {
  chartId: string
  mode: SuggestNotesMode
  playheadTime: number
  snapMode: SnapMode
  targetTrack?: number
  /** Selected notes to continue — required for continue_pattern from multi-select */
  selectedNotes?: Array<{ track: number; time: number }>
  instruction?: string
}

export interface SuggestNotesResponse {
  suggestions: NoteSuggestion[]
}

export interface GeneratedChartNote {
  track: number
  time: number
  noteType?: NoteType
  duration?: number
  title?: string
}

export interface GeneratedChartSection {
  time: number
  label: string
  color?: string
}

export interface GenerateChartRequest {
  chartId: string
  description: string
  snapMode: SnapMode
  replaceExisting: boolean
  targetTier?: SongDifficulty
}

export interface ScaleChartRequest {
  chartId: string
  targetTier: SongDifficulty
  instruction?: string
  snapMode: SnapMode
}

export interface GenerateChartResponse {
  notes: GeneratedChartNote[]
  sections: GeneratedChartSection[]
}

export interface ApplyChartRequest {
  chartId: string
  notes: GeneratedChartNote[]
  sections?: GeneratedChartSection[]
  replaceExisting: boolean
  previewVersion?: string
  resolutions?: Array<{ conflictId: string; action: ConflictAction }>
}

export interface ApplyChartResponse {
  batchId: string
  createdCount: number
  skippedCount: number
  sectionsCreated: number
  replacedCount: number
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

export type ConflictAction = 'KEEP_EXISTING' | 'REPLACE_WITH_PATTERN' | 'REPLACE_WITH_UNDO'

export interface PatternPastePreviewRequest {
  songId: string
  chartId: string
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
  chartId: string
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
