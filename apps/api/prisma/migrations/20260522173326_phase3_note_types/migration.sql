-- CreateEnum
CREATE TYPE "NoteType" AS ENUM ('TAP', 'HOLD', 'SWIPE');

-- AlterTable
ALTER TABLE "notes" ADD COLUMN     "duration" DOUBLE PRECISION,
ADD COLUMN     "noteType" "NoteType" NOT NULL DEFAULT 'TAP';
