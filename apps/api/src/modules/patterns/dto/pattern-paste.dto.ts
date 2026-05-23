import { IsArray, IsEnum, IsNumber, IsString, IsUUID, Max, Min, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import type { ConflictAction } from '@ama-midi/shared'

class PatternPasteResolutionDto {
  @IsString()
  conflictId!: string

  @IsEnum(['KEEP_EXISTING', 'REPLACE_WITH_PATTERN'])
  action!: ConflictAction
}

export class PatternPastePreviewDto {
  @IsUUID()
  songId!: string

  @IsUUID()
  chartId!: string

  @IsNumber()
  @Min(0)
  @Max(300)
  startTime!: number
}

export class PatternPasteApplyDto {
  @IsUUID()
  songId!: string

  @IsUUID()
  chartId!: string

  @IsNumber()
  @Min(0)
  @Max(300)
  startTime!: number

  @IsString()
  patternVersion!: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PatternPasteResolutionDto)
  resolutions!: PatternPasteResolutionDto[]
}
