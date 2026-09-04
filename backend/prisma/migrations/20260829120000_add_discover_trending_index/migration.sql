-- Support the public seven-day Discover ranking without scanning the full
-- play-event history. Only the aggregate query uses this index; raw events
-- and listener identifiers never leave the backend.
CREATE INDEX "PlayEvent_qualified_createdAt_trackId_idx"
ON "PlayEvent"("qualified", "createdAt", "trackId");
