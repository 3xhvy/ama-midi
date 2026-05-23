ALTER TABLE "note_events"
ADD COLUMN "batchId" UUID,
ADD COLUMN "replacesNoteId" UUID;

CREATE INDEX "note_events_batchId_idx" ON "note_events"("batchId");
