import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { SongCategoryEnum, SongDifficultyEnum, type SongCategory, type SongDifficulty } from '@ama-midi/shared'

class ImportSongDto {
  @IsUUID()
  sourceSongId!: string

  @IsBoolean()
  copySettings!: boolean

  @IsBoolean()
  copySections!: boolean

  @IsBoolean()
  copyPatterns!: boolean

  @IsBoolean()
  copyNotes!: boolean
}

export class CreateProjectSongDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string

  @IsIn([...SongCategoryEnum.keys])
  category!: SongCategory

  @IsIn([...SongDifficultyEnum.keys])
  difficulty!: SongDifficulty

  @IsInt()
  @Min(40)
  @Max(300)
  bpm!: number

  @IsIn(['4/4', '3/4', '6/8'])
  timeSignature!: string

  @IsOptional()
  @IsUUID()
  assignedComposerId?: string

  @IsOptional()
  @IsUUID()
  assignedQaId?: string

  @IsIn(['BLANK', 'TEMPLATE', 'IMPORT'])
  startType!: 'BLANK' | 'TEMPLATE' | 'IMPORT'

  @ValidateIf((dto) => dto.startType === 'TEMPLATE')
  @IsString()
  @MinLength(1)
  templateId?: string

  @ValidateIf((dto) => dto.startType === 'IMPORT')
  @ValidateNested()
  @Type(() => ImportSongDto)
  import?: ImportSongDto
}
