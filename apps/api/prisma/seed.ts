import { PrismaClient } from '../generated/prisma/client'

const prisma = new PrismaClient()

const SEED_SONG_ID = 'seed-song-00000000-0000-0000-0000-000000000001'
const SEED_USER_ID = 'seed-user-00000000-0000-0000-0000-000000000001'

async function main() {
  await prisma.user.upsert({
    where: { id: SEED_USER_ID },
    update: {},
    create: {
      id: SEED_USER_ID,
      email: 'seed@ama-midi.dev',
      name: 'Seed User',
      role: 'COMPOSER',
    },
  })

  await prisma.song.upsert({
    where: { id: SEED_SONG_ID },
    update: {},
    create: {
      id: SEED_SONG_ID,
      name: 'Seed Song (10k notes)',
      createdBy: SEED_USER_ID,
    },
  })

  await prisma.note.deleteMany({ where: { songId: SEED_SONG_ID } })

  const positions = new Set<string>()
  const notes: Array<{
    songId: string
    track: number
    time: number
    title: string
    color: string
    createdBy: string
  }> = []

  const colors = ['#6C63FF', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#8B5CF6', '#3B82F6']

  let t = 0
  while (notes.length < 10000) {
    const track = (notes.length % 8) + 1
    const time = Math.round((t / 10) * 10) / 10
    const key = `${track}:${time}`
    if (!positions.has(key) && time <= 300) {
      positions.add(key)
      notes.push({
        songId: SEED_SONG_ID,
        track,
        time,
        title: `Note ${notes.length + 1}`,
        color: colors[track - 1],
        createdBy: SEED_USER_ID,
      })
    }
    t++
    if (t > 100000) break
  }

  const BATCH = 500
  for (let i = 0; i < notes.length; i += BATCH) {
    await prisma.note.createMany({ data: notes.slice(i, i + BATCH), skipDuplicates: true })
    console.log(`Inserted ${Math.min(i + BATCH, notes.length)} / ${notes.length}`)
  }

  console.log(`Seed complete. Song ID: ${SEED_SONG_ID}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
