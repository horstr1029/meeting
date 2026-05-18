-- AlterTable UserSettings: add logo, email recipients
ALTER TABLE "UserSettings" ADD COLUMN "emailRecipients" TEXT NOT NULL DEFAULT '';
ALTER TABLE "UserSettings" ADD COLUMN "logoDataUrl" TEXT;
