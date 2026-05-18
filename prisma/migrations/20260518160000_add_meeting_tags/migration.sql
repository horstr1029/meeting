-- Add tags column to Meeting
ALTER TABLE "Meeting" ADD COLUMN "tags" TEXT NOT NULL DEFAULT '';
