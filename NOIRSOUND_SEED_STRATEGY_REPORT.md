# NoirSound Seed Strategy & Cleanup Automation Report

## 1. Overview of Seed Architecture Changes

Prior to this refactor, running `npx prisma db seed` populated the database with demo music tracks, comments, playlists, and listening events by default. This polluted local development environments and made real mode appear like a pre-populated demo.

The seed architecture has been refactored into two distinct pipelines managed via NPM package scripts in `backend/package.json`:

```json
{
  "scripts": {
    "db:seed": "node prisma/seed.js minimal",
    "db:seed:minimal": "node prisma/seed.js minimal",
    "db:seed:demo": "node prisma/seed.js demo",
    "db:clean-demo": "node scripts/cleanDemoData.js"
  }
}
```

---

## 2. Minimal Seed Breakdown

- **Script Command**: `npm run db:seed:minimal` (or `npm run db:seed`)
- **Purpose**: Creates essential system user accounts and required profiles for local operation without fabricating music catalogue items.
- **Entities Created**:
  1. `admin@noirsound.com` (Role: ADMIN, Username: admin)
  2. `artist@noirsound.com` (Role: ARTIST, Username: velvet_circuit, with linked `ArtistProfile`)
  3. `listener@noirsound.com` (Role: LISTENER, Username: music_fan)
- **Entities Excluded**: 0 tracks, 0 playlists, 0 comments, 0 play events.

---

## 3. Demo Seed Breakdown

- **Script Command**: `npm run db:seed:demo`
- **Purpose**: Explicit, opt-in population of realistic demonstration tracks, artists, playlists, and engagement data.
- **Entities Created**:
  - 4 Artists (`Velvet Circuit`, `Mira Vale`, `Northline Archive`, `Static Bloom`)
  - 7 Published Tracks (`Glass Highway`, `Redline Echo`, `Low Orbit`, `Rain on Fifth Street`, `Soft Static`, `Voltage Garden`, `Afterimage Protocol`)
  - 1 Public Playlist (`Nocturne Notes`) with 4 tracks
  - 1 Comment on `Glass Highway`
  - 1 PlayEvent on `Glass Highway`
- **Idempotency Guarantees**: Uses deterministic UUIDs and slugs. Re-running the script upserts existing records and does not duplicate data or crash on unique constraints.

---

## 4. Cleanup Automation (`cleanDemoData.js`)

- **Script Command**: `npm run db:clean-demo`
- **Behavior & Guardrails**:
  - **Dry-Run by Default**: Prints targeted rows and counts without modifying database state.
  - **Confirmation Required**: Execution requires `--confirm` (`npm run db:clean-demo -- --confirm`).
  - **Production Guard**: Immediately throws an error if `NODE_ENV=production`.
  - **Database Host Safety**: Validates database name and host string. Refuses execution on external databases.
  - **Selective Deletion**: Targets only deterministic demo IDs (`seed-nocturne-notes`, `seed-*` slugs, demo emails). **Never deletes user-uploaded tracks or non-demo accounts.**
