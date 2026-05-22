import { IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator'

export class CreateSectionDto {
  @IsNumber() @Min(0) @Max(300) time!: number
  @IsString() @MinLength(1) @MaxLength(24) label!: string
  @Matches(/^#[0-9A-F]{6}$/i, { message: 'color must be 6-digit hex' })
  @IsOptional() color?: string
}

export class UpdateSectionDto {
  @IsString() @MinLength(1) @MaxLength(24) @IsOptional() label?: string
  @Matches(/^#[0-9A-F]{6}$/i) @IsOptional() color?: string
}
