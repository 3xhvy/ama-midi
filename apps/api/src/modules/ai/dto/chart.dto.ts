import { IsArray, IsBoolean, IsEnum, IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import type { ConflictAction, SnapMode, SongDifficulty } from '@ama-midi/shared'

export class GenerateChartDto {
  @IsUUID()
  chartId!: string

  @IsBoolean()
  replaceExisting!: boolean

  @IsString()
  @MaxLength(2000)
  description!: string

  @IsIn(['0.1s', 'beat', 'halfBeat'])
  snapMode!: SnapMode

  @IsOptional()
  @IsIn(['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'])
  targetTier?: SongDifficulty
}

class GeneratedChartNoteDto {
  @IsNumber()
  @Min(1)
  @Max(8)
  track!: number

  @IsNumber()
  @Min(0)
  @Max(300)
  time!: number

  @IsOptional()
  @IsIn(['TAP', 'HOLD'])
  noteType?: 'TAP' | 'HOLD'

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  duration?: number

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string
}

class GeneratedChartSectionDto {
  @IsNumber()
  @Min(0)
  @Max(300)
  time!: number

  @IsString()
  @MaxLength(60)
  label!: string

  @IsOptional()
  @IsString()
  color?: string
}

export class ScaleChartDto {
  @IsUUID()
  chartId!: string

  @IsIn(['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'])
  targetTier!: SongDifficulty

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instruction?: string

  @IsIn(['0.1s', 'beat', 'halfBeat'])
  snapMode!: SnapMode
}

class ChartApplyResolutionDto {
  @IsString()
  conflictId!: string

  @IsEnum(['KEEP_EXISTING', 'REPLACE_WITH_PATTERN'])
  action!: ConflictAction
}

export class PreviewChartDto {
  @ValidateNested({ each: true })
  @Type(() => GeneratedChartNoteDto)
  notes!: GeneratedChartNoteDto[]

  @IsBoolean()
  replaceExisting!: boolean
}

export class ApplyChartDto {
  @IsUUID()
  chartId!: string

  @ValidateNested({ each: true })
  @Type(() => GeneratedChartNoteDto)
  notes!: GeneratedChartNoteDto[]

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => GeneratedChartSectionDto)
  sections?: GeneratedChartSectionDto[]

  @IsBoolean()
  replaceExisting!: boolean

  @IsOptional()
  @IsString()
  previewVersion?: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChartApplyResolutionDto)
  resolutions?: ChartApplyResolutionDto[]
}
