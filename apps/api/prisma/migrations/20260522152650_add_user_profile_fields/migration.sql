-- AlterTable
ALTER TABLE "users" ADD COLUMN     "department" TEXT,
ADD COLUMN     "profileComplete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "tourComplete" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "notes_songId_time_idx" ON "notes"("songId", "time");

-- CreateIndex
CREATE INDEX "notes_songId_track_idx" ON "notes"("songId", "track");
