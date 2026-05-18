-- AlterTable Meeting: add attendees and agenda
ALTER TABLE "Meeting" ADD COLUMN "attendees" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Meeting" ADD COLUMN "agenda" TEXT;

-- AlterTable ActionItem: add priority
ALTER TABLE "ActionItem" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'medium';
