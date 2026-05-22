import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator'

export class UpdateSongDto {
  @IsString() @IsOptional() name?: string
  @IsInt() @Min(40) @Max(300) @IsOptional() bpm?: number
  @Matches(/^\d+\/\d+$/, { message: 'timeSignature must look like "4/4"' })
  @IsOptional() timeSignature?: string
}
