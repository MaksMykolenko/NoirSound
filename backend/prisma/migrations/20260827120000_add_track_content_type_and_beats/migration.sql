-- Add a first-class Music/Beat distinction without rewriting existing rows.
-- PostgreSQL applies the non-null MUSIC default to every existing Track and
-- UploadBatchItem, preserving compatibility with all legacy upload payloads.

CREATE TYPE "TrackContentType" AS ENUM ('MUSIC', 'BEAT');

ALTER TABLE "Track"
ADD COLUMN "contentType" "TrackContentType" NOT NULL DEFAULT 'MUSIC',
ADD COLUMN "beatKey" TEXT,
ADD COLUMN "beatBpm" INTEGER,
ADD COLUMN "beatMood" TEXT,
ADD COLUMN "beatStyle" TEXT,
ADD COLUMN "beatLicenseType" TEXT,
ADD COLUMN "beatUsageNotes" TEXT,
ADD COLUMN "beatContactEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "UploadBatchItem"
ADD COLUMN "contentType" "TrackContentType" NOT NULL DEFAULT 'MUSIC',
ADD COLUMN "beatKey" TEXT,
ADD COLUMN "beatBpm" INTEGER,
ADD COLUMN "beatMood" TEXT,
ADD COLUMN "beatStyle" TEXT,
ADD COLUMN "beatLicenseType" TEXT,
ADD COLUMN "beatUsageNotes" TEXT,
ADD COLUMN "beatContactEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Track_contentType_status_publishedAt_idx"
ON "Track"("contentType", "status", "publishedAt");
