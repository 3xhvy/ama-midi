-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectPermission" AS ENUM ('READ', 'EDIT', 'ADMIN');

-- CreateEnum
CREATE TYPE "SongScope" AS ENUM ('ALL_SONGS', 'SELECTED_SONGS', 'NO_SONGS');

-- CreateEnum
CREATE TYPE "SongStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'NEEDS_FIX', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SongCategory" AS ENUM ('MAIN_CAMPAIGN', 'EVENT', 'TUTORIAL', 'LIVE_OPS', 'PROTOTYPE', 'QA_TEST', 'TEMPLATE', 'REFERENCE');

-- CreateEnum
CREATE TYPE "SongDifficulty" AS ENUM ('EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER');

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" "ProjectPermission" NOT NULL,
    "songScope" "SongScope" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_member_song_access" (
    "id" TEXT NOT NULL,
    "projectMemberId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,

    CONSTRAINT "project_member_song_access_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add nullable columns first
ALTER TABLE "songs" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "assignedComposerId" TEXT,
ADD COLUMN     "assignedQaId" TEXT,
ADD COLUMN     "category" "SongCategory" NOT NULL DEFAULT 'PROTOTYPE',
ADD COLUMN     "difficulty" "SongDifficulty" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "importOptions" JSONB,
ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "sourceSongId" TEXT,
ADD COLUMN     "status" "SongStatus" NOT NULL DEFAULT 'DRAFT';

-- Backfill: default project for existing songs
INSERT INTO "projects" ("id", "name", "status", "ownerId", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'Default Project', 'ACTIVE', "id", NOW(), NOW()
FROM "users"
ORDER BY "createdAt" ASC
LIMIT 1;

INSERT INTO "project_members" ("id", "projectId", "userId", "permission", "songScope", "createdAt", "updatedAt")
SELECT gen_random_uuid(), p."id", p."ownerId", 'ADMIN', 'ALL_SONGS', NOW(), NOW()
FROM "projects" p
WHERE p."name" = 'Default Project'
ON CONFLICT DO NOTHING;

UPDATE "songs"
SET "projectId" = (SELECT "id" FROM "projects" WHERE "name" = 'Default Project' LIMIT 1)
WHERE "projectId" IS NULL;

ALTER TABLE "songs" ALTER COLUMN "projectId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "projects_ownerId_idx" ON "projects"("ownerId");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "project_members_userId_idx" ON "project_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_projectId_userId_key" ON "project_members"("projectId", "userId");

-- CreateIndex
CREATE INDEX "project_member_song_access_songId_idx" ON "project_member_song_access"("songId");

-- CreateIndex
CREATE UNIQUE INDEX "project_member_song_access_projectMemberId_songId_key" ON "project_member_song_access"("projectMemberId", "songId");

-- CreateIndex
CREATE INDEX "songs_projectId_status_idx" ON "songs"("projectId", "status");

-- CreateIndex
CREATE INDEX "songs_projectId_category_idx" ON "songs"("projectId", "category");

-- CreateIndex
CREATE INDEX "songs_assignedComposerId_idx" ON "songs"("assignedComposerId");

-- CreateIndex
CREATE INDEX "songs_assignedQaId_idx" ON "songs"("assignedQaId");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_member_song_access" ADD CONSTRAINT "project_member_song_access_projectMemberId_fkey" FOREIGN KEY ("projectMemberId") REFERENCES "project_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_member_song_access" ADD CONSTRAINT "project_member_song_access_songId_fkey" FOREIGN KEY ("songId") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "songs" ADD CONSTRAINT "songs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "songs" ADD CONSTRAINT "songs_assignedComposerId_fkey" FOREIGN KEY ("assignedComposerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "songs" ADD CONSTRAINT "songs_assignedQaId_fkey" FOREIGN KEY ("assignedQaId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "songs" ADD CONSTRAINT "songs_sourceSongId_fkey" FOREIGN KEY ("sourceSongId") REFERENCES "songs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
