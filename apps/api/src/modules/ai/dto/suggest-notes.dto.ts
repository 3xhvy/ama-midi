import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import type { SnapMode, SuggestNotesMode } from '@ama-midi/shared'

class SelectedPatternNoteDto {
  @IsInt()
  @Min(1)
  @Max(8)
  track!: number

  @IsNumber()
  @Min(0)
  @Max(300)
  time!: number
}

export class SuggestNotesDto {
  @IsUUID()
  chartId!: string

  @IsIn(['continue_pattern', 'fill_track', 'refine_pattern'])
  mode!: SuggestNotesMode

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instruction?: string

  @ValidateIf((o: SuggestNotesDto) => o.mode === 'fill_track')
  @IsInt()
  @Min(1)
  @Max(8)
  targetTrack?: number

  @IsNumber()
  @Min(0)
  @Max(300)
  playheadTime!: number

  @IsIn(['0.1s', 'beat', 'halfBeat'])
  snapMode!: SnapMode

  @ValidateIf((o: SuggestNotesDto) => o.mode === 'continue_pattern' || o.mode === 'refine_pattern')
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SelectedPatternNoteDto)
  selectedNotes?: SelectedPatternNoteDto[]
}
