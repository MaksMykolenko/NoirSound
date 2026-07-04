# NoirSound Playlist Builder UI Report

Date: 2026-07-04

## Route and entry point

- New route: `/upload/batch`
- Product name: **Batch Upload Studio**
- Existing `/upload` keeps the single-track form and now exposes:
  - Single Track
  - Multi Upload

## Studio flow

The responsive six-step UI implements:

1. Select files
2. Sort tracks
3. Edit metadata
4. Configure playlist
5. Review
6. Upload and publish

The page uses a primary editor area plus a sticky batch status/item rail on wide screens. On smaller screens the layout collapses to one column and the track editor becomes a bottom sheet.

## File staging

- Multi-file picker and drag/drop.
- Client-side MIME/extension, per-file size, file-count, and total-size checks.
- Duplicate filename warning without rejecting legitimate duplicates.
- Inferred readable title supplied by the backend draft.
- Files can be removed before draft creation.
- No object upload begins during local staging.
- Resumed drafts explicitly prompt for local file reselection because browser `File` objects cannot survive refresh.

## Assignment and track settings

Every item can be assigned to:

- Single
- Playlist
- Excluded

Playlist rows support native drag/drop and accessible up/down controls. Clicking any item opens `BatchTrackSettingsDrawer` with:

- Title
- Primary artist
- Featured artists
- Canonical genre picker
- Tags
- Description
- Cover staging
- Explicit flag
- Visibility
- Copyright confirmation
- Target and playlist order
- Read-only file, MIME, size, duration, and status

Draft saving is explicit and consistent.

## Playlist visual editor

`BatchPlaylistEditor` mirrors the finished playlist hierarchy:

- Large inline cover placeholder.
- Inline title and description fields.
- Creator line.
- Public/private and draft badges.
- Live ordered track rows.
- Track title, artist, English genre label, status, and missing-metadata badge.
- Click-to-open track settings.
- Drag and keyboard ordering.

The playlist cover is staged locally and uploaded only when the user starts the batch upload.

## Review and progress

Review shows counts for selected files, standalone singles, playlist tracks, excluded tracks, and blocking errors. Per-item missing fields remain visible.

Progress shows batch totals and per-item upload/processing/ready/failed/published state. Failed rows expose Retry. Strict and partial publish actions are separate and disabled unless their backend-derived safety conditions are satisfied.

## i18n and genre behavior

Batch UI translations were added for:

- English
- Ukrainian
- Polish
- Russian

Genre option and group labels continue to use the canonical English taxonomy in every locale.

## Visual verification

- In-app browser review completed in mock mode at 1440×900.
- Document width equaled viewport width (`1440`), confirming no horizontal page overflow at that breakpoint.
- Initial studio hierarchy, stepper, drop zone, navigation, and footer rendered correctly.
- Component tests cover playlist placeholders, click-to-open behavior, accessible order controls, title editing, and Ukrainian UI with English genre labels.

## Remaining UI verification

- The in-app browser surface did not expose file-input injection, so the real multi-file browser interaction is covered by the committed Playwright scenario instead.
- Full mobile drawer/bottom-sheet visual QA remains to be rerun with the backend stack and E2E fixtures active.
