# NoirSound Empty State Verification Report

## 1. Scope & Objective

This document verifies the visual and behavioral presentation of all major NoirSound pages when operating against a clean database seeded via `npm run db:seed:minimal` (or when operating in real API mode with zero tracks/analytics).

---

## 2. Visual & UI Component Verification Matrix

| Page / Component | Condition Checked | Expected Behavior / Presentation | Verification Result |
| :--- | :--- | :--- | :--- |
| **Home (`/`)** | Zero tracks in DB | Shows polished `EmptyState` card: *"No tracks yet. Be the first creator to upload."* with direct CTA button to `/upload`. | **PASS** |
| **Home (`/`)** | Zero published artists | Shows polished `EmptyState` card: *"Creators will appear here after artists publish music."* | **PASS** |
| **Discover (`/discover`)** | Zero tracks in DB | Shows clean `EmptyState` with `UploadCloud` icon: *"No releases yet — Published tracks will appear here after the first successful upload."* | **PASS** |
| **Discover (`/discover`)** | Zero matching filters | Shows `SearchX` empty state: *"No matching releases — Try a broader search or choose another genre."* | **PASS** |
| **Discover (`/discover`)** | Zero published artists | Recommended Artists section shows `Users` empty state: *"No creators yet — More creators will appear here after artists upload tracks."* | **PASS** |
| **Library (`/library`)** | Unauthenticated | Displays sign-in prompt `EmptyState`: *"Sign in to open your library"*. | **PASS** |
| **Library (`/library`)** | No recently played history | Recently Played tab shows `History` empty state: *"Nothing played recently — A track appears here only after playback actually starts."* | **PASS** |
| **Library (`/library`)** | Liked / Playlists / Followed | Shows honest `Construction` state explaining account collection endpoints are pending, avoiding fake mock cards. | **PASS** |
| **Profile (`/profile`)** | No listening stats | Stats tab displays `Headphones` empty state: *"Not enough listening data yet — Stats will appear after the backend records your first real playback events."* | **PASS** |
| **Dashboard (`/dashboard`)** | Creator with zero uploads | Creator Dashboard displays `UploadCloud` empty state: *"Your creator analytics will appear after your first upload — Only persisted, published releases and their backend metrics are shown."* | **PASS** |
| **Sidebar (`LibrarySidebarSection`)** | Zero user playlists | Shows honest compact message: *"Personal playlists and followed artists will appear after account collection endpoints are connected."* | **PASS** |

---

## 3. Local Clean DB Verification Instructions

To verify the clean database setup locally, run the following sequence:

```bash
# 1. Reset and restart local database container
cd backend
docker compose down -v
docker compose up -d

# 2. Run Prisma migrations and minimal seed
npx prisma migrate dev
npm run db:seed:minimal

# 3. Start backend and worker
npm run dev
# in separate terminal: npm run worker

# 4. Start frontend in real mode
cd ..
npm run dev
```

### Verification Checklist:
- Navigating to `http://localhost:5173` displays clean empty states without fake tracks (`Nightcrawler`, `Neon Drift`, `Glass Highway`, etc.).
- Logging in as `artist@noirsound.com` / `password123` allows uploading a real WAV audio file.
- After processing, the newly uploaded track appears naturally in Home and Discover releases, and streams seamlessly via signed URLs.
