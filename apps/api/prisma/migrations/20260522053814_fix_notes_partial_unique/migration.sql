-- Replace full unique index with partial unique index (active notes only)
DROP INDEX "notes_songId_track_time_key";

CREATE UNIQUE INDEX "uq_notes_active_position"
  ON "notes" ("songId", "track", "time")
  WHERE "deletedAt" IS NULL;
