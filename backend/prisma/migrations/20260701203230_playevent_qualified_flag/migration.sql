-- AlterTable
ALTER TABLE "PlayEvent" ADD COLUMN     "qualified" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "PlayEvent_trackId_qualified_idx" ON "PlayEvent"("trackId", "qualified");

-- CreateIndex
CREATE INDEX "PlayEvent_artistId_qualified_createdAt_idx" ON "PlayEvent"("artistId", "qualified", "createdAt");

-- CreateIndex
CREATE INDEX "PlayEvent_userId_qualified_createdAt_idx" ON "PlayEvent"("userId", "qualified", "createdAt");
