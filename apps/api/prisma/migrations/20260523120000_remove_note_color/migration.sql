-- Drop per-note color; track identity uses TRACK_COLORS in the client.
ALTER TABLE "notes" DROP COLUMN "color";
