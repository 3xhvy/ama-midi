import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator'

export class UpdateChartDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string

  @IsOptional()
  @IsNumber()
  @Min(0.8)
  @Max(2.0)
  speedMultiplier?: number
}
