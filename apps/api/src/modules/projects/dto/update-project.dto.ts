import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null

  @IsOptional()
  @IsIn(['ACTIVE', 'PAUSED', 'ARCHIVED'])
  status?: 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
}
