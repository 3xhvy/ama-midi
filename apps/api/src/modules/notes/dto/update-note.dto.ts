import { IsString, IsOptional, IsHexColor, IsEnum, IsNumber, Min, Max } from 'class-validator'

export class UpdateNoteDto {
  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsHexColor()
  color?: string
  // track and time are NOT updatable — position is immutable

  @IsEnum(['TAP', 'HOLD', 'SWIPE'] as const)
  @IsOptional()
  noteType?: 'TAP' | 'HOLD' | 'SWIPE'

  @IsNumber()
  @Min(0.1)
  @Max(30)
  @IsOptional()
  duration?: number
}
