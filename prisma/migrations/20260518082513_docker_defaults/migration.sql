-- AlterTable
ALTER TABLE "UserSettings" ALTER COLUMN "whisperHost" SET DEFAULT 'whisper',
ALTER COLUMN "whisperPath" SET DEFAULT '/v1/audio/transcriptions',
ALTER COLUMN "ollamaHost" SET DEFAULT 'ollama';
