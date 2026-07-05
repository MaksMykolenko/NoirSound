-- Add a structured lyrics type shared by final Tracks and batch item drafts.
CREATE TYPE "LyricsType" AS ENUM ('NONE', 'PLAIN', 'SYNCED');

-- Final Track lyrics. Full text remains lazy-loaded through the lyrics API.
ALTER TABLE "Track"
ADD COLUMN "lyricsText" TEXT,
ADD COLUMN "lyricsType" "LyricsType" NOT NULL DEFAULT 'NONE',
ADD COLUMN "lyricsLanguage" TEXT,
ADD COLUMN "lyricsSynced" JSONB,
ADD COLUMN "lyricsRightsConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lyricsUpdatedAt" TIMESTAMP(3);

-- Persist lyrics while a multi-upload item is still a draft.
ALTER TABLE "UploadBatchItem"
ADD COLUMN "lyricsText" TEXT,
ADD COLUMN "lyricsType" "LyricsType" NOT NULL DEFAULT 'NONE',
ADD COLUMN "lyricsLanguage" TEXT,
ADD COLUMN "lyricsSynced" JSONB,
ADD COLUMN "lyricsRightsConfirmed" BOOLEAN NOT NULL DEFAULT false;
