import { ArrayNotEmpty, IsArray, IsIn, IsOptional, IsUUID, ValidateIf } from 'class-validator'

export class UpdateProjectMemberDto {
  @IsOptional()
  @IsIn(['READ', 'EDIT', 'ADMIN'])
  permission?: 'READ' | 'EDIT' | 'ADMIN'

  @IsOptional()
  @IsIn(['ALL_SONGS', 'SELECTED_SONGS', 'NO_SONGS'])
  songScope?: 'ALL_SONGS' | 'SELECTED_SONGS' | 'NO_SONGS'

  @ValidateIf((dto) => dto.songScope === 'SELECTED_SONGS')
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  songIds?: string[]
}
