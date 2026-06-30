-- AlterEnum
ALTER TYPE "TrackStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "Upload" ADD COLUMN     "coverMimeType" TEXT,
ADD COLUMN     "coverSizeBytes" INTEGER,
ADD COLUMN     "coverStorageKey" TEXT;
