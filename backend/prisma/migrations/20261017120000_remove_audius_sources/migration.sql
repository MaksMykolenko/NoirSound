-- Audius was removed as a platform source.
-- 1. Hide external tracks whose recording group (root + merged members) has no
--    platform left besides Audius. Track rows are kept so likes, playlists and
--    listening history stay referentially intact.
WITH "Grp" AS (
  SELECT r."trackId", COALESCE(r."mergedIntoId", r."id") AS "rootId"
  FROM "ExternalRecording" r
)
UPDATE "Track" t
SET "status" = 'HIDDEN', "updatedAt" = CURRENT_TIMESTAMP
FROM "Grp" g
WHERE t."id" = g."trackId"
  AND t."catalogScope" = 'EXTERNAL_BETA'
  AND t."status" = 'PUBLISHED'
  AND EXISTS (
    SELECT 1 FROM "ExternalSource" s
    JOIN "ExternalRecording" m ON m."id" = s."recordingId"
    WHERE COALESCE(m."mergedIntoId", m."id") = g."rootId" AND s."provider" = 'AUDIUS'
  )
  AND NOT EXISTS (
    SELECT 1 FROM "ExternalSource" s
    JOIN "ExternalRecording" m ON m."id" = s."recordingId"
    WHERE COALESCE(m."mergedIntoId", m."id") = g."rootId" AND s."provider" <> 'AUDIUS'
  );

-- 2. Drop the Audius source links themselves.
DELETE FROM "ExternalSource" WHERE "provider" = 'AUDIUS';
