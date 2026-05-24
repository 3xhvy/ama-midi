import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import type {
  ConflictAction,
  NoteCopyOperation,
  NoteCopyTransformMode,
} from '@ama-midi/shared'

export class ConflictResolutionDto {
  @IsString()
  conflictId!: string

  @IsEnum(['KEEP_EXISTING', 'REPLACE_WITH_PATTERN'] as const)
  action!: ConflictAction
}

export class NoteCopyPreviewDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  noteIds!: string[]

  @IsEnum(['COPY', 'MOVE'] as const)
  operation!: NoteCopyOperation

  @IsEnum(['TIME_SHIFT', 'TRACK_SHIFT', 'TRACK_TIME_ANCHOR', 'REPEAT_INTERVAL'] as const)
  mode!: NoteCopyTransformMode

  @ValidateIf((dto: NoteCopyPreviewDto) => dto.mode === 'TIME_SHIFT')
  @IsNumber()
  timeDelta!: number

  @ValidateIf((dto: NoteCopyPreviewDto) => dto.mode === 'TRACK_SHIFT')
  @IsInt()
  @Min(1)
  @Max(8)
  targetTrack!: number

  @ValidateIf((dto: NoteCopyPreviewDto) => dto.mode === 'TRACK_TIME_ANCHOR')
  @IsInt()
  @Min(1)
  @Max(8)
  anchorTrack!: number

  @ValidateIf((dto: NoteCopyPreviewDto) => dto.mode === 'TRACK_TIME_ANCHOR')
  @IsNumber()
  @Min(0)
  @Max(300)
  anchorTime!: number

  @ValidateIf((dto: NoteCopyPreviewDto) => dto.mode === 'REPEAT_INTERVAL')
  @IsInt()
  @Min(1)
  @Max(500)
  repeatCount!: number

  @ValidateIf((dto: NoteCopyPreviewDto) => dto.mode === 'REPEAT_INTERVAL')
  @IsNumber()
  @Min(0.1)
  @Max(300)
  repeatInterval!: number
}

export class NoteCopyApplyDto extends NoteCopyPreviewDto {
  @IsString()
  selectionVersion!: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConflictResolutionDto)
  resolutions!: ConflictResolutionDto[]
}
