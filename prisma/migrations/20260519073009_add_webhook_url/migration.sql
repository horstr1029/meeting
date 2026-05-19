-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "webhookUrl" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "ollamaHost" SET DEFAULT '172.17.0.1',
ALTER COLUMN "ollamaPort" SET DEFAULT '11211',
ALTER COLUMN "ollamaModel" SET DEFAULT 'mistral:7b-instruct';
