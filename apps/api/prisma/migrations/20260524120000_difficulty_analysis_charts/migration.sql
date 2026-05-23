-- CreateEnum
CREATE TYPE "ValidationSeverity" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateTable
CREATE TABLE "song_charts" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Main',
    "speedMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "computedDifficulty" "SongDifficulty" NOT NULL DEFAULT 'NORMAL',
    "averageDifficultyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "peakDifficultyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "analyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "song_charts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chart_difficulty_segments" (
    "id" TEXT NOT NULL,
    "chartId" TEXT NOT NULL,
    "startTimeMs" INTEGER NOT NULL,
    "endTimeMs" INTEGER NOT NULL,
    "notesPerSecond" DOUBLE PRECISION NOT NULL,
    "averageLaneJump" DOUBLE PRECISION NOT NULL,
    "offbeatRatio" DOUBLE PRECISION NOT NULL,
    "holdNoteRatio" DOUBLE PRECISION NOT NULL,
    "simultaneousNoteRatio" DOUBLE PRECISION NOT NULL,
    "patternComplexityScore" DOUBLE PRECISION NOT NULL,
    "difficultyScore" DOUBLE PRECISION NOT NULL,
    "difficultyLevel" "SongDifficulty" NOT NULL,

    CONSTRAINT "chart_difficulty_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chart_validation_warnings" (
    "id" TEXT NOT NULL,
    "chartId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "severity" "ValidationSeverity" NOT NULL,
    "startTimeMs" INTEGER,
    "endTimeMs" INTEGER,
    "message" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "chart_validation_warnings_pkey" PRIMARY KEY ("id")
);

-- Default chart per song (dev cutover)
INSERT INTO "song_charts" (
    "id", "songId", "name", "speedMultiplier", "computedDifficulty",
    "averageDifficultyScore", "peakDifficultyScore", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    s."id",
    'Main',
    1.0,
    'NORMAL',
    0,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "songs" s;

-- Add chartId to notes and backfill from default chart
ALTER TABLE "notes" ADD COLUMN "chartId" TEXT;

UPDATE "notes" n
SET "chartId" = sc."id"
FROM "song_charts" sc
WHERE sc."songId" = n."songId" AND sc."name" = 'Main';

ALTER TABLE "notes" ALTER COLUMN "chartId" SET NOT NULL;

-- Drop old partial unique index
DROP INDEX IF EXISTS "uq_notes_active_position";

-- DropColumn
ALTER TABLE "songs" DROP COLUMN "difficulty";

-- CreateIndex
CREATE INDEX "song_charts_songId_idx" ON "song_charts"("songId");

-- CreateIndex
CREATE INDEX "chart_difficulty_segments_chartId_startTimeMs_idx" ON "chart_difficulty_segments"("chartId", "startTimeMs");

-- CreateIndex
CREATE INDEX "chart_validation_warnings_chartId_severity_idx" ON "chart_validation_warnings"("chartId", "severity");

-- CreateIndex
CREATE INDEX "notes_chartId_time_idx" ON "notes"("chartId", "time");

-- CreateIndex
CREATE INDEX "notes_chartId_track_idx" ON "notes"("chartId", "track");

-- Partial unique index scoped to chart
CREATE UNIQUE INDEX "uq_notes_chart_track_time_active"
    ON "notes" ("chartId", "track", "time")
    WHERE "deletedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "song_charts" ADD CONSTRAINT "song_charts_songId_fkey" FOREIGN KEY ("songId") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_difficulty_segments" ADD CONSTRAINT "chart_difficulty_segments_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "song_charts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_validation_warnings" ADD CONSTRAINT "chart_validation_warnings_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "song_charts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "song_charts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
