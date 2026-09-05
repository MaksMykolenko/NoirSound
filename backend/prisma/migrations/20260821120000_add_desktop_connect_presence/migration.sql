-- AlterTable User: add Discord Rich Presence preferences
ALTER TABLE "User"
ADD COLUMN "discordPresenceEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "discordPresenceShowCover" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "discordPresenceShowTimer" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable DesktopConnectionDevice
CREATE TABLE "DesktopConnectionDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "tokenFamilyId" TEXT,
    "rotationCounter" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesktopConnectionDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DesktopConnectionDevice_userId_revokedAt_idx" ON "DesktopConnectionDevice"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "DesktopConnectionDevice_refreshTokenHash_idx" ON "DesktopConnectionDevice"("refreshTokenHash");

-- AddForeignKey
ALTER TABLE "DesktopConnectionDevice" ADD CONSTRAINT "DesktopConnectionDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
