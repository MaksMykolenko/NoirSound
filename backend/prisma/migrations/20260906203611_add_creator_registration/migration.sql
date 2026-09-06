-- CreateEnum
CREATE TYPE "CreatorType" AS ENUM ('ARTIST', 'BEATMAKER', 'BOTH');

-- CreateEnum
CREATE TYPE "CreatorRegistrationStatus" AS ENUM ('REGISTERED', 'REVIEWED', 'ENABLED');

-- CreateTable
CREATE TABLE "CreatorRegistration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creatorType" "CreatorType" NOT NULL DEFAULT 'ARTIST',
    "intendsMusic" BOOLEAN NOT NULL DEFAULT true,
    "intendsBeats" BOOLEAN NOT NULL DEFAULT false,
    "displayName" VARCHAR(120),
    "portfolioUrl" VARCHAR(2048),
    "primaryPlatformUrl" VARCHAR(2048),
    "note" VARCHAR(1000),
    "status" "CreatorRegistrationStatus" NOT NULL DEFAULT 'REGISTERED',
    "adminNote" VARCHAR(2000),
    "reviewedAt" TIMESTAMP(3),
    "enabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreatorRegistration_userId_key" ON "CreatorRegistration"("userId");

-- CreateIndex
CREATE INDEX "CreatorRegistration_status_idx" ON "CreatorRegistration"("status");

-- CreateIndex
CREATE INDEX "CreatorRegistration_creatorType_idx" ON "CreatorRegistration"("creatorType");

-- CreateIndex
CREATE INDEX "CreatorRegistration_createdAt_idx" ON "CreatorRegistration"("createdAt");

-- AddForeignKey
ALTER TABLE "CreatorRegistration" ADD CONSTRAINT "CreatorRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
