import { IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator'

export class SetBackingTrackUrlDto {
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUrl({}, { message: 'url must be a valid http(s) URL' })
  @IsOptional()
  url?: string | null
}
