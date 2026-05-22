import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max, IsNumber, IsHexColor, IsEnum } from 'class-validator'

export class CreateNoteDto {
  @IsString()
  @IsNotEmpty()
  title!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsInt()
  @Min(1)
  @Max(8)
  track!: number

  @IsNumber()
  @Min(0)
  @Max(300)
  time!: number

  @IsOptional()
  @IsHexColor()
  color?: string

  @IsEnum(['TAP', 'HOLD', 'SWIPE'] as const)
  @IsOptional()
  noteType?: 'TAP' | 'HOLD' | 'SWIPE'

  @IsNumber()
  @Min(0.1)
  @Max(30)
  @IsOptional()
  duration?: number
}
