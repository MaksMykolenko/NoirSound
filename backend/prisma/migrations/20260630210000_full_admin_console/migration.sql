-- Persist explicit, reversible admin moderation states.
ALTER TYPE "UploadStatus" ADD VALUE 'CANCELLED';
ALTER TYPE "ReportStatus" ADD VALUE 'ESCALATED';

ALTER TABLE "ArtistProfile"
ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- Audit history must survive removal of an actor account.
ALTER TABLE "AuditLog"
DROP CONSTRAINT "AuditLog_actorId_fkey";

ALTER TABLE "AuditLog"
ALTER COLUMN "actorId" DROP NOT NULL;

ALTER TABLE "AuditLog"
ADD CONSTRAINT "AuditLog_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
