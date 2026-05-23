import { IsIn, IsInt, IsNumber, IsOptional, Max, Min, ValidateIf, ValidateNested } from 'class-validator'
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
  @IsIn(['continue_pattern', 'fill_track'])
  mode!: SuggestNotesMode

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

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SelectedPatternNoteDto)
  selectedNotes?: SelectedPatternNoteDto[]
}
