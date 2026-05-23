import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  NoteEventTypeEnum,
  NoteTypeEnum,
  ProjectPermissionEnum,
  ProjectStatusEnum,
  SongCategoryEnum,
  SongDifficultyEnum,
  SongScopeEnum,
  SongStatusEnum,
  UserRoleEnum,
} from '@ama-midi/shared'

function prismaEnumKeys(schema: string, enumName: string): string[] {
  const match = schema.match(new RegExp(`enum ${enumName} \\{([\\s\\S]*?)\\}`))
  if (!match) throw new Error(`Missing Prisma enum ${enumName}`)

  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('//'))
    .map((line) => line.split(/\s+/)[0])
}

describe('shared enum drift', () => {
  const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8')

  it.each([
    ['UserRole', UserRoleEnum.keys],
    ['NoteEventType', NoteEventTypeEnum.keys],
    ['NoteType', NoteTypeEnum.keys],
    ['ProjectStatus', ProjectStatusEnum.keys],
    ['ProjectPermission', ProjectPermissionEnum.keys],
    ['SongScope', SongScopeEnum.keys],
    ['SongStatus', SongStatusEnum.keys],
    ['SongCategory', SongCategoryEnum.keys],
    ['SongDifficulty', SongDifficultyEnum.keys],
  ] as const)('%s matches the shared enum registry', (enumName, expectedKeys) => {
    expect(prismaEnumKeys(schema, enumName)).toEqual([...expectedKeys])
  })
})
