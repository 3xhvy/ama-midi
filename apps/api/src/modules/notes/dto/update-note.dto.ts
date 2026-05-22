import { IsString, IsOptional, IsHexColor } from 'class-validator'

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
}
