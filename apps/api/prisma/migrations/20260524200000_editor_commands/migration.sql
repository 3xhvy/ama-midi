CREATE TABLE "editor_commands" (
  "id"                TEXT NOT NULL,
  "songId"            TEXT NOT NULL,
  "chartId"           TEXT,
  "commandType"       TEXT NOT NULL,
  "userId"            TEXT NOT NULL,
  "summary"           JSONB NOT NULL DEFAULT '{}',
  "undoable"          BOOLEAN NOT NULL DEFAULT true,
  "undoneByCommandId" TEXT,
  "isCompensation"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "editor_commands_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "editor_commands"
  ADD CONSTRAINT "editor_commands_songId_fkey"
    FOREIGN KEY ("songId") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "editor_commands_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "editor_commands_undoneByCommandId_fkey"
    FOREIGN KEY ("undoneByCommandId") REFERENCES "editor_commands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "editor_commands_chartId_userId_createdAt_idx"
  ON "editor_commands" ("chartId", "userId", "createdAt");

CREATE INDEX "editor_commands_chartId_createdAt_idx"
  ON "editor_commands" ("chartId", "createdAt");

ALTER TABLE "editor_events"
  ADD COLUMN "commandId" TEXT,
  ADD CONSTRAINT "editor_events_commandId_fkey"
    FOREIGN KEY ("commandId") REFERENCES "editor_commands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "editor_events_commandId_idx" ON "editor_events" ("commandId");
