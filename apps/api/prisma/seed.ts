import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required. Set it in apps/api/.env or your shell.')
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
})

const DEFAULT_SEED_SONG_ID = 'seed-song-00000000-0000-0000-0000-000000000001'
const DEFAULT_SEED_CHART_ID = 'seed-chart-0000-0000-0000-0000000000001'
const DEFAULT_SEED_USER_ID = 'seed-user-00000000-0000-0000-0000-000000000001'
const DEFAULT_SEED_PROJECT_ID = 'seed-proj-00000000-0000-0000-0000-000000000001'

const TARGET_NOTES = Number(process.env.SEED_NOTE_COUNT ?? 10_000)
const TRACK_COUNT = 8
const TIME_MAX_TENTHS = 3_000 // 0.0s … 300.0s at 0.1s snap

interface SeedTarget {
  chartId: string
  songId: string
  createdBy: string
  mode: 'default' | 'chart' | 'song'
}

async function ensureDefaultSeedProject(): Promise<SeedTarget> {
  await prisma.user.upsert({
    where: { id: DEFAULT_SEED_USER_ID },
    update: {},
    create: {
      id: DEFAULT_SEED_USER_ID,
      email: 'seed@ama-midi.dev',
      name: 'Seed User',
      role: 'COMPOSER',
    },
  })

  await prisma.project.upsert({
    where: { id: DEFAULT_SEED_PROJECT_ID },
    update: {},
    create: {
      id: DEFAULT_SEED_PROJECT_ID,
      name: 'Seed Project',
      ownerId: DEFAULT_SEED_USER_ID,
      members: {
        create: { userId: DEFAULT_SEED_USER_ID, permission: 'ADMIN', songScope: 'ALL_SONGS' },
      },
    },
  })

  await prisma.song.upsert({
    where: { id: DEFAULT_SEED_SONG_ID },
    update: {},
    create: {
      id: DEFAULT_SEED_SONG_ID,
      projectId: DEFAULT_SEED_PROJECT_ID,
      name: 'Seed Song (10k notes)',
      createdBy: DEFAULT_SEED_USER_ID,
    },
  })

  await prisma.songChart.upsert({
    where: { id: DEFAULT_SEED_CHART_ID },
    update: {},
    create: {
      id: DEFAULT_SEED_CHART_ID,
      songId: DEFAULT_SEED_SONG_ID,
      name: 'Main',
      speedMultiplier: 1.0,
    },
  })

  return {
    chartId: DEFAULT_SEED_CHART_ID,
    songId: DEFAULT_SEED_SONG_ID,
    createdBy: DEFAULT_SEED_USER_ID,
    mode: 'default',
  }
}

async function resolveSeedTarget(): Promise<SeedTarget> {
  const envChartId = process.env.CHART_ID?.trim()
  const envSongId = process.env.SONG_ID?.trim()

  if (envChartId && envSongId) {
    throw new Error('Set CHART_ID or SONG_ID, not both.')
  }

  if (envChartId) {
    const chart = await prisma.songChart.findUnique({
      where: { id: envChartId },
      select: {
        id: true,
        songId: true,
        song: { select: { createdBy: true, name: true } },
      },
    })
    if (!chart) {
      throw new Error(`Chart not found: ${envChartId}`)
    }
    console.log(`Using existing chart "${envChartId}" on song "${chart.song.name}".`)
    return {
      chartId: chart.id,
      songId: chart.songId,
      createdBy: chart.song.createdBy,
      mode: 'chart',
    }
  }

  if (envSongId) {
    const song = await prisma.song.findUnique({
      where: { id: envSongId },
      select: {
        id: true,
        name: true,
        createdBy: true,
        charts: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true },
        },
      },
    })
    if (!song) {
      throw new Error(`Song not found: ${envSongId}`)
    }
    if (song.charts.length === 0) {
      throw new Error(`Song "${envSongId}" has no charts. Create a chart in the app first.`)
    }

    const chart = song.charts.find((c) => c.name === 'Main') ?? song.charts[0]
    console.log(`Using chart "${chart.id}" (${chart.name}) on song "${song.name}".`)
    return {
      chartId: chart.id,
      songId: song.id,
      createdBy: song.createdBy,
      mode: 'song',
    }
  }

  console.log('No CHART_ID or SONG_ID set — using default seed project/chart.')
  return ensureDefaultSeedProject()
}

function buildNotes(target: SeedTarget) {
  const notes: Array<{
    chartId: string
    songId: string
    track: number
    time: number
    title: string
    createdBy: string
  }> = []

  outer: for (let timeTenths = 0; timeTenths <= TIME_MAX_TENTHS; timeTenths++) {
    const time = timeTenths / 10
    for (let track = 1; track <= TRACK_COUNT; track++) {
      notes.push({
        chartId: target.chartId,
        songId: target.songId,
        track,
        time,
        title: `Note ${notes.length + 1}`,
        createdBy: target.createdBy,
      })
      if (notes.length >= TARGET_NOTES) break outer
    }
  }

  if (notes.length < TARGET_NOTES) {
    throw new Error(
      `Could only place ${notes.length} notes (need ${TARGET_NOTES}). Increase TIME_MAX or TRACK_COUNT.`,
    )
  }

  return notes
}

async function main() {
  const target = await resolveSeedTarget()

  await prisma.note.deleteMany({ where: { chartId: target.chartId } })

  const notes = buildNotes(target)
  const BATCH = 500
  for (let i = 0; i < notes.length; i += BATCH) {
    await prisma.note.createMany({ data: notes.slice(i, i + BATCH), skipDuplicates: true })
    console.log(`Inserted ${Math.min(i + BATCH, notes.length)} / ${notes.length}`)
  }

  const count = await prisma.note.count({
    where: { chartId: target.chartId, deletedAt: null },
  })

  console.log(`Seed complete. ${count} active notes on chart.`)
  console.log(`  Song ID:  ${target.songId}`)
  console.log(`  Chart ID: ${target.chartId}`)
  console.log(`  Use CHART_ID=${target.chartId} for the k6 load test.`)
  if (target.mode === 'default') {
    console.log('  Tip: seed your own chart with CHART_ID=... or SONG_ID=... pnpm seed')
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
