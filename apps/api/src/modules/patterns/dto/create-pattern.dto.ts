import {
  IsArray, IsEnum, IsNumber, IsOptional, IsString, IsUUID,
  Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

class PatternNoteDto {
  @IsNumber() @Min(1) @Max(8) track!: number
  @IsNumber() @Min(0)         timeOffset!: number
  @IsEnum(['TAP', 'HOLD', 'SWIPE']) noteType!: 'TAP' | 'HOLD' | 'SWIPE'
  @IsString() color!: string
  @IsNumber() @Min(0.1) @Max(30) @IsOptional() duration?: number
}

export class CreatePatternDto {
  @IsString() @MinLength(1) @MaxLength(50) name!: string
  @IsArray() @ValidateNested({ each: true }) @Type(() => PatternNoteDto)
  notes!: PatternNoteDto[]
  @IsUUID() @IsOptional() songId?: string
}
