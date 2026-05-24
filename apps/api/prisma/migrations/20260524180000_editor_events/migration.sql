CREATE TABLE "editor_events" (
  "id" TEXT NOT NULL,
  "songId" TEXT NOT NULL,
  "chartId" TEXT,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "eventType" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "beforeState" JSONB,
  "afterState" JSONB,
  "batchId" UUID,
  "replacesEventId" UUID,
  "undoneByEventId" UUID,
  "undoable" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "editor_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "editor_events"
ADD CONSTRAINT "editor_events_songId_fkey"
FOREIGN KEY ("songId") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "editor_events"
ADD CONSTRAINT "editor_events_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "editor_events_songId_createdAt_idx" ON "editor_events"("songId", "createdAt");
CREATE INDEX "editor_events_chartId_createdAt_idx" ON "editor_events"("chartId", "createdAt");
CREATE INDEX "editor_events_batchId_idx" ON "editor_events"("batchId");
CREATE INDEX "editor_events_userId_createdAt_idx" ON "editor_events"("userId", "createdAt");

INSERT INTO "editor_events" (
  "id",
  "songId",
  "chartId",
  "entityType",
  "entityId",
  "eventType",
  "userId",
  "beforeState",
  "afterState",
  "batchId",
  "undoable",
  "createdAt"
)
SELECT
  "id",
  "songId",
  NULL,
  'NOTE',
  "noteId",
  "eventType"::TEXT,
  "userId",
  "beforeState",
  "afterState",
  "batchId",
  CASE WHEN "eventType" IN ('NOTE_CREATED', 'NOTE_DELETED') THEN true ELSE false END,
  "createdAt"
FROM "note_events";
