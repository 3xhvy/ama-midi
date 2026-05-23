import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import type { SnapMode, SongDifficulty } from '@ama-midi/shared'

export class GenerateChartDto {
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
  @IsIn(['TAP', 'HOLD', 'SWIPE'])
  noteType?: 'TAP' | 'HOLD' | 'SWIPE'

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
}
