-- DropIndex
DROP INDEX "notes_songId_track_idx";

-- AlterTable
ALTER TABLE "song_charts" ADD COLUMN     "factorBreakdown" JSONB;
