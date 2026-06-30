# NoirSound Role Leak Fix Report

## 1. Identified Leaks & Root Causes

During visual audit of real-mode UI presentations, internal backend enums and system administration roles were leaking into public user-facing interfaces:

1. **User Profile Header (`UserProfileHeader.jsx`)**:
   - Exposed `SYSTEM ADMIN` badge for accounts with `role: 'ADMIN'`.
   - Exposed `System Administrator` text in location metadata line.
2. **Artist Focus Genres (`ArtistPage.jsx` & `artistMapper.js`)**:
   - Surfaced `ADMIN` as a focus genre badge on artist pages due to raw database enum mixing.
3. **Artist Profile Button (`ArtistPage.jsx`)**:
   - Displayed generic button or allowed self-following on owned artist profiles.

---

## 2. Implemented Fixes

### User Profile Sanitization (`src/components/profile/UserProfileHeader.jsx`)
- Removed `SYSTEM ADMIN` and `System Administrator` rendering logic from public profile header.
- Replaced raw roles with friendly labels:
  - `Creator` for users with active artist profiles or creator status.
  - `Listener` for standard listener accounts.

### Artist Focus Genre Protection (`src/api/mappers/artistMapper.js` & `backend/src/routes/artists.js`)
- Introduced a strict `FORBIDDEN_GENRES` filter set containing `ADMIN`, `SYSTEM_ADMIN`, `LISTENER`, `ARTIST`, `USER`, `PLAYER`, `ACTIVE`, `SUSPENDED`, `BANNED`, `DELETED`.
- Both backend API routes and frontend presentation mappers strip these strings from artist focus genres.
- Empty state updated to exact specification: `"Genres will appear after published tracks."`.

### Profile Segregation & Self-Follow Prevention (`ArtistPage.jsx` & `artists.js`)
- Added `isOwnProfile` check on `ArtistPage.jsx`. When viewing one's own artist page, the UI renders `Edit Artist Profile` (navigating to `/profile?tab=settings`) instead of a follow button.
- Added backend validation in `POST /api/artists/:id/follow` rejecting self-follow attempts with `400 Bad Request`.

---

## 3. Automated Test Verification

Added unit test suite `tests/components/ProfileRoleLeak.test.jsx` verifying that:
- `UserProfileHeader` does not render `SYSTEM ADMIN` or `System Administrator` for admin accounts.
- `artistMapper` strips `ADMIN` and `SYSTEM_ADMIN` from focus genres.
