import { Type } from 'class-transformer'
import { IsArray, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator'

export class UndoResolutionDto {
  @IsString()
  conflictId!: string

  @IsEnum(['KEEP_EXISTING', 'REPLACE_WITH_UNDO'] as const)
  action!: 'KEEP_EXISTING' | 'REPLACE_WITH_UNDO'
}

export class ApplyUndoDto {
  @IsString()
  commandId!: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UndoResolutionDto)
  resolutions?: UndoResolutionDto[]
}
