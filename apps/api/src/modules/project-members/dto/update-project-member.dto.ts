import { ArrayNotEmpty, IsArray, IsIn, IsOptional, IsUUID, ValidateIf } from 'class-validator'
import { ProjectPermissionEnum, SongScopeEnum } from '@ama-midi/shared'

export class UpdateProjectMemberDto {
  @IsOptional()
  @IsIn([...ProjectPermissionEnum.keys])
  permission?: 'READ' | 'EDIT' | 'ADMIN'

  @IsOptional()
  @IsIn([...SongScopeEnum.keys])
  songScope?: 'ALL_SONGS' | 'SELECTED_SONGS' | 'NO_SONGS'

  @ValidateIf((dto) => dto.songScope === 'SELECTED_SONGS')
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  songIds?: string[]
}
