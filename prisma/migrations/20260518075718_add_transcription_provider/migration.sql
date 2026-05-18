-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "groqApiKey" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "transcriptionProvider" TEXT NOT NULL DEFAULT 'groq';
