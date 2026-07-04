-- CreateEnum
CREATE TYPE "UploadBatchMode" AS ENUM ('MIXED', 'SINGLES_ONLY', 'PLAYLIST');

-- CreateEnum
CREATE TYPE "UploadBatchStatus" AS ENUM ('DRAFT', 'UPLOADING', 'PROCESSING', 'PARTIAL_READY', 'READY', 'PUBLISHED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UploadBatchItemStatus" AS ENUM ('DRAFT', 'UPLOADING', 'UPLOADED', 'PROCESSING', 'READY', 'FAILED', 'EXCLUDED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "UploadBatchItemTarget" AS ENUM ('SINGLE', 'PLAYLIST', 'EXCLUDED');

-- AlterTable
ALTER TABLE "Track"
ADD COLUMN "primaryArtistName" TEXT,
ADD COLUMN "featuredArtists" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "explicit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Playlist"
ADD COLUMN "artistProfileId" TEXT,
ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "coverImageKey" TEXT;

-- CreateTable
CREATE TABLE "UploadBatch" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "userId" TEXT NOT NULL,
    "artistProfileId" TEXT NOT NULL,
    "mode" "UploadBatchMode" NOT NULL DEFAULT 'MIXED',
    "status" "UploadBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "playlistId" TEXT,
    "playlistTitle" TEXT,
    "playlistDescription" TEXT,
    "playlistCoverStorageKey" TEXT,
    "playlistCoverMimeType" TEXT,
    "playlistCoverSizeBytes" INTEGER,
    "playlistIsPublic" BOOLEAN NOT NULL DEFAULT true,
    "playlistTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UploadBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadBatchItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "trackId" TEXT,
    "uploadId" TEXT,
    "status" "UploadBatchItemStatus" NOT NULL DEFAULT 'DRAFT',
    "target" "UploadBatchItemTarget" NOT NULL DEFAULT 'SINGLE',
    "playlistOrder" INTEGER,
    "title" TEXT NOT NULL,
    "primaryArtistName" TEXT NOT NULL,
    "featuredArtists" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "genre" TEXT,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "explicit" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "copyrightConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UploadBatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UploadBatch_playlistId_key" ON "UploadBatch"("playlistId");
CREATE UNIQUE INDEX "UploadBatch_userId_clientId_key" ON "UploadBatch"("userId", "clientId");
CREATE INDEX "UploadBatch_userId_status_idx" ON "UploadBatch"("userId", "status");
CREATE INDEX "UploadBatch_artistProfileId_idx" ON "UploadBatch"("artistProfileId");
CREATE UNIQUE INDEX "UploadBatchItem_trackId_key" ON "UploadBatchItem"("trackId");
CREATE UNIQUE INDEX "UploadBatchItem_uploadId_key" ON "UploadBatchItem"("uploadId");
CREATE UNIQUE INDEX "UploadBatchItem_batchId_clientId_key" ON "UploadBatchItem"("batchId", "clientId");
CREATE INDEX "UploadBatchItem_batchId_status_idx" ON "UploadBatchItem"("batchId", "status");
CREATE INDEX "UploadBatchItem_batchId_target_playlistOrder_idx" ON "UploadBatchItem"("batchId", "target", "playlistOrder");
CREATE INDEX "Playlist_artistProfileId_idx" ON "Playlist"("artistProfileId");

-- AddForeignKey
ALTER TABLE "Playlist" ADD CONSTRAINT "Playlist_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "ArtistProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UploadBatch" ADD CONSTRAINT "UploadBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UploadBatch" ADD CONSTRAINT "UploadBatch_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "ArtistProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UploadBatch" ADD CONSTRAINT "UploadBatch_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UploadBatchItem" ADD CONSTRAINT "UploadBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "UploadBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UploadBatchItem" ADD CONSTRAINT "UploadBatchItem_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UploadBatchItem" ADD CONSTRAINT "UploadBatchItem_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;
