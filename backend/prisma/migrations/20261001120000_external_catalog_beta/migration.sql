-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "catalogScope" TEXT NOT NULL DEFAULT 'NATIVE';

-- CreateTable
CREATE TABLE "ExternalRecording" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "versionType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "versionLabel" TEXT,
    "isrc" TEXT,
    "parentId" TEXT,
    "mergedIntoId" TEXT,
    "curatorId" TEXT,
    "metadataProvenance" TEXT NOT NULL DEFAULT 'ADMIN_PROVIDED',
    "metadataExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalRecording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalSource" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT,
    "canonicalUrl" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "playbackMode" TEXT NOT NULL DEFAULT 'LINK_OUT',
    "availability" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "matchStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "officialStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "provenance" TEXT NOT NULL,
    "verificationEvidence" TEXT,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalPlaybackEvent" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "durationListenedSeconds" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalPlaybackEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalCatalogSetting" (
    "id" TEXT NOT NULL DEFAULT 'beta',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalCatalogSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalRecording_trackId_key" ON "ExternalRecording"("trackId");

-- CreateIndex
CREATE INDEX "ExternalRecording_mergedIntoId_idx" ON "ExternalRecording"("mergedIntoId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalSource_canonicalUrl_key" ON "ExternalSource"("canonicalUrl");

-- CreateIndex
CREATE INDEX "ExternalSource_recordingId_idx" ON "ExternalSource"("recordingId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalSource_provider_externalId_key" ON "ExternalSource"("provider", "externalId");

-- CreateIndex
CREATE INDEX "ExternalPlaybackEvent_userId_createdAt_idx" ON "ExternalPlaybackEvent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ExternalRecording" ADD CONSTRAINT "ExternalRecording_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalRecording" ADD CONSTRAINT "ExternalRecording_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ExternalRecording"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalRecording" ADD CONSTRAINT "ExternalRecording_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "ExternalRecording"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalSource" ADD CONSTRAINT "ExternalSource_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "ExternalRecording"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalPlaybackEvent" ADD CONSTRAINT "ExternalPlaybackEvent_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "ExternalRecording"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
