import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { ProjectStatusEnum } from '@ama-midi/shared'

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
  @IsIn([...ProjectStatusEnum.keys])
  status?: 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
}
