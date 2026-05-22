-- CreateTable
CREATE TABLE "section_markers" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "time" DOUBLE PRECISION NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6C63FF',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "section_markers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_patterns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "songId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "section_markers_songId_time_idx" ON "section_markers"("songId", "time");

-- AddForeignKey
ALTER TABLE "section_markers" ADD CONSTRAINT "section_markers_songId_fkey" FOREIGN KEY ("songId") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_markers" ADD CONSTRAINT "section_markers_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_patterns" ADD CONSTRAINT "note_patterns_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_patterns" ADD CONSTRAINT "note_patterns_songId_fkey" FOREIGN KEY ("songId") REFERENCES "songs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
