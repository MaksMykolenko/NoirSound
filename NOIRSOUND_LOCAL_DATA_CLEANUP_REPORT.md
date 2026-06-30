# NoirSound Local Data Cleanup Report

## 1. Automated Cleanup Command Architecture

To provide a safe, repeatable method for wiping local test artifacts and product content without dropping database tables or deleting user accounts, a dedicated cleanup utility was implemented at `backend/scripts/cleanLocalProductData.js`.

### Command Access:
```bash
npm run db:clean-local              # Dry-run audit mode
npm run db:clean-local -- --confirm    # Execution mode
```

---

## 2. Safety Guards & Execution Pipeline

1. **Environment Protection**: Throws error and exits immediately if `NODE_ENV=production`.
2. **Database Host Verification**: Inspects `DATABASE_URL` hostname and database name. Restricts execution to local/dev/test environments.
3. **Dry-Run Default**: Running without `--confirm` displays table counts without modifying data.
4. **Dependency Order Deletion**: Cleans product content tables in safe FK constraint order:
   - `PlayEvent` & `ListeningAggregate`
   - `CommentLike` & `Comment`
   - `PlaylistTrack`, `PlaylistLike`, & `Playlist`
   - `TrackLike` & `ArtistFollow`
   - `Upload` & `TrackAudioAsset`
   - `Report` & `ModerationDecision`
   - `Track`
5. **Account Preservation**: Keeps core system accounts by default (`admin@noirsound.com`, `artist@noirsound.com`, `listener@noirsound.com`). Optional `--include-users` flag purges non-core accounts.

---

## 3. Automated Test Verification

Added backend test file `backend/tests/cleanLocalProductData.test.js` verifying dry-run output and production refusal behavior.
