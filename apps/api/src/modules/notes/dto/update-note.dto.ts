import { IsString, IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator'

export class UpdateNoteDto {
  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsEnum(['TAP', 'HOLD', 'SWIPE'] as const)
  @IsOptional()
  noteType?: 'TAP' | 'HOLD' | 'SWIPE'

  @IsNumber()
  @Min(0.1)
  @Max(30)
  @IsOptional()
  duration?: number
}
