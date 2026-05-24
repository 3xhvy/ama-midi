-- DropIndex (IF EXISTS: index may already be gone from a prior failed attempt)
DROP INDEX IF EXISTS "notes_songId_track_idx";

-- AlterTable
ALTER TABLE "song_charts" ADD COLUMN IF NOT EXISTS "factorBreakdown" JSONB;
