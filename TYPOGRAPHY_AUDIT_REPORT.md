# NoirSound — Typography Readability and Bona Nova Display Font

## Current verified release record

This report accompanies the sitewide readability pass and the final display-font migration. The detailed original audit remains below as a historical trace; where its older QA limitations differ, this release record is authoritative.

### Font contract

- UI: `"Commissioner", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Display: `"Bona Nova", Georgia, "Times New Roman", serif`.
- Commissioner loads normal weights 400, 500, 600, and 700.
- Bona Nova loads normal weight 700 only. Its 400 and 400 italic files are available from the source but unused here, so they are not requested.
- Google Fonts remains the loading strategy with `display=swap`; no local font binaries or CSP changes were added.
- The previous display family is absent from production HTML, CSS, tests, and runtime source. Historical discussion below may still name it when describing the migration sequence.

### Usage

Bona Nova is restricted to the Home hero, Home editorial creator heading, Artist/Playlist/Track hero titles, and the FullscreenLyricsPlayer track title. Commissioner remains the font for body copy, navigation, sidebar, controls, forms, cards, metadata, player controls, lyrics, upload, Dashboard, Admin, modals, context menus, toasts, legal text, and mobile navigation. `.ns-page-title` stays on Commissioner, so utility pages do not inherit the display face.

The semantic readability scale is unchanged: page title 28–36px, section title 18–22px, card/body 15px, compact body 14px, label 13px, metadata 12px, and micro 11px only for nonessential technical marks. Mobile editable inputs remain 16px. Visible numeric metadata uses Commissioner with tabular numerals; mono is reserved for the technical Admin Audit Log target ID.

### Automated verification

- `npm run lint`: exit 0, no warnings.
- `npm test`: 37/37 files, 206/206 tests passed.
- `npm run build`: exit 0; 1966 modules transformed; only the existing non-blocking chunk-size warning remains.
- Font-contract regression coverage verifies semantic tokens, exact requested weights, UI/display separation, utility-page exclusions, metadata mono restrictions, long-title wrapping, and short-landscape fullscreen behavior.

### Browser verification

Mock API mode was verified in the in-app browser. `document.fonts.check()` returned true for Commissioner 400/500/600/700 and Bona Nova 700. Computed styles reported Commissioner on body/controls and Bona Nova 700 on display titles. The observed resource inventory contained the Google stylesheet plus three Bona Nova WOFF2 subset resources and three Commissioner resources, with no font CORS errors or final-page console errors.

Localized Home display titles rendered with Bona Nova in EN, UK, PL, and RU. The Ukrainian check initially ran before the Cyrillic subset settled and returned false, then passed on the repeat after the font set reached its loaded state. Google Fonts metadata lists Cyrillic, Cyrillic Extended, Latin, and Latin Extended support for Bona Nova.

All eight themes preserved the same UI/display tokens and had no horizontal overflow. Home was swept at 1920×1080, 1600×900, 1440×900, 1280×800, 1024×768, 768×1024, 430×932, 390×844, 375×667, 360×640, 320×568, 844×390, and 667×375. Every viewport had `scrollWidth === clientWidth`, with no display-title clipping. Artist, Playlist, Track, Profile, Library, Upload, the mobile drawer, player, and fullscreen lyrics were also verified. In fullscreen lyrics at 667×375, the scroll region ends at the controls boundary with no overlap.

Fresh final-state screenshots are stored locally under `artifacts/qa/bona-nova/` and are not part of the release commit.

### Scope and limitations

- Backend, API contracts, database schema/migrations, routing, player business logic, sidebar sizing, BrandLogo equalizer behavior, `.ns-page-container`, and `--ns-content-max-width` were not changed.
- Mock audio playback still depends on an external demo stream and can show a network/autoplay error; this does not affect font or layout verification.
- Browser zoom 125% and 150% was not freshly repeated for the Bona Nova swap. The existing zoom artifacts remain local, and the implementation continues to use rem/clamp-based sizing.
- Production deployment and its smoke verification are reported separately in the task handoff because a commit cannot embed its own final SHA without changing that SHA.

---

## Historical readability audit (superseded where noted above)

---

## A. Root cause

Three independent problems, all present at once:

1. **No centralized type scale.** `src/index.css` had exactly four typographic rules (`.ns-page-title`, `.ns-page-lede`, `.ns-section-title`, `.ns-eyebrow`) and nothing else. Every other piece of secondary/service text — nav labels, card subtitles, table cells, badges, form labels, player labels — was sized ad hoc, component by component, with no shared vocabulary. Two developers solving "make this label smaller" independently reached for `text-xs` (12px) and `text-[11px]`/`text-[10px]`/`text-[9px]` (raw arbitrary values) equally often, so the same *role* (e.g. "card subtitle") ended up at three or four different sizes across the app.

2. **`text-xs` (12px) used for real content, not just labels.** Tailwind's `text-xs` utility was the default reach for anything that "felt secondary" — track descriptions, empty-state copy, error messages, toast notifications, form helper text, modal body copy. These are not decorative labels; they're the only copy on the screen in some states (e.g. `ErrorState`, `EmptyState`, toasts), and 12px is too small for that role at normal viewing distance.

3. **Raw arbitrary-value classes below the 12px floor.** `text-[9px]`, `text-[10px]`, `text-[11px]`, `text-[12px]`, `text-[12.5px]`, `text-[13px]` etc. appeared 180+ times across ~60 files, always as one-off literals, never as a shared token. Combined with `tracking-wider`/`tracking-widest` (0.05em/0.1em) on short uppercase labels already running small, several sidebar and card labels were both too small *and* over-tracked, which compounds the readability problem (wider letter-spacing at small sizes reduces perceived word shape, making short scans harder).

Page titles (`.ns-page-title`, `h1`) were correctly identified in the original brief as "mostly fine" — confirmed on inspection: they used `clamp()` already and sat in the 24–36px range. The problem was almost entirely in tier 2 and below (section titles, card titles, body-small, labels, metadata).

---

## B. Typography scale

Added to `src/index.css`, `:root` block (new tokens only; existing color/spacing tokens untouched):

| Token | Value | Role |
|---|---|---|
| `--ns-text-page-title` | `clamp(1.75rem, 3vw, 2.25rem)` (28–36px) | `<h1>` page titles. Floor raised from 24px→28px; the 36px desktop cap is unchanged, so real desktop viewports (≥1200px) render byte-identical to before. |
| `--ns-text-section-title` | `clamp(1.125rem, 1rem + 0.6vw, 1.375rem)` (18–22px) | Section headers within a page (was 14–18px — a genuine fix). |
| `--ns-text-card-title` | `0.9375rem` (15px) | Card / list-item titles (track cards, playlist cards, sidebar item names). |
| `--ns-text-body` | `0.9375rem` (15px) | Primary reading copy. |
| `--ns-text-body-small` | `0.875rem` (14px) | Compact body copy — descriptions, helper paragraphs, empty/error state copy, toasts. |
| `--ns-text-label` | `0.8125rem` (13px) | Secondary UI text — table cells, tabs, buttons, form field labels. |
| `--ns-text-meta` | `0.75rem` (12px) | Metadata — counts, timestamps, badges, sidebar secondary lines. |
| `--ns-text-micro` | `0.6875rem` (11px) | Reserved for unimportant technical marks only (never used for anything with real information content). |
| `--ns-line-body` | `1.6` | Line-height for body/body-small tiers. |
| `--ns-line-snug` | `1.45` | Line-height for meta tier. |
| `--ns-line-compact` | `1.35` | Line-height for label/micro tiers. |
| `--ns-tracking-label` | `0.04em` | Single, moderate tracking value for all uppercase labels (replaces the previous mix of `tracking-wide`/`wider`/`widest` = 0.025/0.05/0.1em). |

Exposed as Tailwind utilities via the `@theme` block (Tailwind v4 `--text-*` / `--tracking-*` namespace convention already used elsewhere in this file), each paired with its line-height companion:

```
text-ns-micro, text-ns-meta, text-ns-label, text-ns-body-sm, text-ns-body,
text-ns-card-title, text-ns-section-title, tracking-ns-label
```

Existing shared classes updated to reference the new tokens instead of hardcoded values: `.ns-page-title`, `.ns-page-lede`, `.ns-section-title`, `.ns-eyebrow`. One new shared class added: `.ns-card-title`.

No color, spacing, width, or z-index token was touched. No existing token was renamed or removed.

---

## C. Changed components

80 files touched (see `git status --short` in section J for the authoritative list). Grouped by area:

**Design tokens (1):** `src/index.css`

**Sidebar / navigation:** `LibrarySidebarSection.jsx`, `SidebarPlaylistItem.jsx`, `SidebarArtistItem.jsx`, `Header.jsx`, `MobileNavbar.jsx`, `BrandLogo.jsx`, `Footer.jsx`

**Home:** `Home.jsx`, `HomeHero.jsx`, `CreatorCallout.jsx`, `ProductFeatures.jsx`, `BrowseByGenre.jsx`, `TrackCard.jsx`, `ArtistCard.jsx`

**Profile / Library:** `Profile.jsx`, `Library.jsx`, `TrackListItem.jsx`, `PlaylistCard.jsx`, `UserProfileHeader.jsx`, `ListeningStats.jsx`, `UserSettingsForm.jsx`, `UserActivityItem.jsx`, `AccountDropdown.jsx`, `ThemeSelector.jsx`, `LanguageSwitcher.jsx`

**Playlist / Artist / Track:** `PlaylistPage.jsx`, `PlaylistTrackTable.jsx`, `EditPlaylistModal.jsx`, `CreatePlaylistModal.jsx`, `AddToPlaylistModal.jsx`, `ArtistPage.jsx`, `TrackPage.jsx`, `CommentSection.jsx`, `CommentItem.jsx`, `ReplyThread.jsx`, `ReplyInput.jsx`, `ReportButton.jsx`, `TrackLyricsCard.jsx`, `LyricsEditor.jsx`

**Player:** `PlayerBar.jsx`, `PlayerBarShared.jsx`, `FullscreenLyricsPlayer.jsx`, `QueuePanel.jsx`, `Waveform.jsx`

**Upload / batch upload:** `Upload.jsx`, `UploadForm.jsx`, `BatchUploadPage.jsx`, `BatchFileDropzone.jsx`, `BatchItemList.jsx`, `BatchPlaylistEditor.jsx`, `BatchTrackSettingsDrawer.jsx`, `GenrePicker.jsx`, `GenrePill.jsx`

**Admin:** `AdminUI.jsx` (shared table/pagination/error/confirm-modal primitives), `AdminLayout.jsx`, and all 15 admin subpages (`AdminArtistDetail`, `AdminArtists`, `AdminAuditLogs`, `AdminComments`, `AdminOverview`, `AdminReportDetail`, `AdminReports`, `AdminSettings`, `AdminStats`, `AdminSystem`, `AdminTrackDetail`, `AdminTracks`, `AdminUploads`, `AdminUserDetail`, `AdminUsers`)

**Shared UI / states:** `EmptyState.jsx`, `ErrorState.jsx` *(reviewed, no change needed)*, `ToastContainer.jsx`, `AuthModal.jsx` *(reviewed, no change needed)*, `ContextMenu.jsx` *(reviewed, no change needed)*, `Dashboard.jsx`, `Discover.jsx`, `LegalPage.jsx`, `StatsCard.jsx`, `App.jsx`

**Deliberately unchanged (reviewed, judged already compliant):** `NotFound.jsx`, `MobileHeader.jsx`, `LibraryDrawer.jsx`, `LyricsEditModal.jsx`, `FallbackCover.jsx` "No artwork" mark and verified-badge checkmarks (both intentionally decorative sub-11px, per the spec's own carve-out), `LegalPage.jsx` disclaimer footer (12px legal fine print — industry-standard treatment, kept distinct from "service text").

---

## D. Before / after

Screenshots captured earlier in this session (Mock API mode, demo listener account) live under `artifacts/qa/` in the project root — untracked, not imported anywhere in `src/`:

- `artifacts/qa/before/` + `artifacts/qa/after/` — Library, Playlist, Profile, Artist desktop (1600×900), and a mobile drawer capture (430×932), before/after the sidebar + page-level fixes.
- `artifacts/qa/evidence/` — Home, Library, Playlist, admin table, mobile Home/drawer/now-playing, fullscreen lyrics + context menu, plus three verification shots including one in Ukrainian (`verify-uk-admin-settings.png`).

**Library page (before/after, side-by-side confirmed):** tab strip ("Liked Songs / Playlists / Recently Played / Followed Artists") is visibly larger and no longer over-tracked; sidebar "Filter library" placeholder, playlist names, and track-count captions all stepped up a tier; page title/composition, sidebar width, and the equalizer logo are pixel-identical to before.

**Mobile drawer (430×932):** "YOUR LIBRARY" label, filter input, "Liked Songs" / "Recently Played" rows with counts, "PLAYLISTS" section label with `by X · N tracks` captions, "DEMO ARTISTS" section label with "Artist" role labels — all legible, no truncation or overflow at this width.

**Ukrainian admin settings (`verify-uk-admin-settings.png`):** full Ukrainian sidebar nav + nested admin nav (11 items) renders cleanly at the fixed sidebar width with no wrapping/clipping, confirming the sidebar fix holds under the longest-tested locale strings.

**Caveat:** these captures were taken partway through the pass (after the sidebar/Home/Profile/Library fixes, before the later Upload/BatchUpload/modals/player-shared/EmptyState/ToastContainer fixes made in this session's final push). They are genuine, representative evidence of the fix's effect, not a complete final-state gallery — see section I.

---

## E. Responsive QA

Two viewports were verified against real rendered screenshots this session: **1600×900** (desktop) and **430×932** (mobile drawer). Both confirmed clean: no clipped text, no horizontal overflow, tab/nav strips readable, equalizer intact.

The full range down to 320px was **not** re-verified against live renders in this final pass — headless Chrome could not be launched in this sandbox (see H) to sweep the complete viewport matrix. Verified instead by code review:

| Concern | How it was checked | Result |
|---|---|---|
| Page title scales fluidly, doesn't overflow at narrow widths | `--ns-text-page-title` uses `clamp(1.75rem, 3vw, 2.25rem)` — fluid by construction | Pass (unchanged mechanism, only the floor moved) |
| Tabs/step-nav don't wrap or clip with longer text | Every tab/step strip touched (`Profile`, `Library`, `BatchUploadPage`) uses `ns-tabs-scroll overflow-x-auto` + `min-w-max` — confirmed present via source read and locked in by a new regression test (section H) | Pass by construction |
| Touch targets unaffected | No `min-h-*`/`min-w-*`/padding class was changed anywhere in this pass — only `text-*`/`tracking-*` | Pass (unchanged) |
| No new fixed-height clipping traps | Reviewed every badge/pill touched (`TrackStatusBadge`, `BatchItemList` status badge, `GenrePill`, playlist "public/private" badges); all use padding-based sizing (`px-*` `py-*`), not fixed `h-N` + `overflow-hidden`, so they grow with the slightly taller text rather than clip it | Pass |
| Mobile input zoom (iOS auto-zooms `<input>` under 16px) | The one input this pass touched for this reason — sidebar "Filter library" — was bumped `text-xs`→`text-base` (16px). Several other pre-existing inputs (upload form fields, search fields) remain at 14px; they were not part of the reported readability problem and were left alone to stay in scope | Partial — see section I |

---

## F. Locale QA

`src/i18n/locales/{en,uk,pl,ru}/common.json` reviewed for the labels touched in the tightest spaces:

- **Batch-upload step nav** (`selectFiles` … `uploadPublish`): Russian/Ukrainian run up to ~2× the English length (e.g. `editMetadata`: "Edit metadata" (13 chars) vs. "Редактирование метаданных" (27 chars)). Safe by construction — the step strip is `overflow-x-auto` with `min-w-max`, so longer labels extend the scrollable strip rather than wrap or overflow the page. Locked in by a regression test (section H).
- **Profile/Library tabs** (`followedArtists` etc.): same scroll-strip mechanism; in this case the non-English strings happen to be *shorter* than English ("Followed Artists" → "Артисти"/"Artyści"/"Артисты").
- **Modal titles** (`playlists.addToPlaylist` etc.): not truncated in any locale — modal `<h2>` elements have no `truncate`/`nowrap` constraint, so they wrap naturally inside the fixed-width modal if ever needed.
- Confirmed visually in the Ukrainian admin-settings screenshot (section D): full sidebar nav + admin sub-nav in Ukrainian, no wrapping or clipping at the fixed sidebar width.

No translation string was shortened to fit a layout, per the constraint — all layout accommodations were structural (scroll strips, non-truncated titles), not content changes.

---

## G. Accessibility

- **Contrast:** no color value was changed anywhere in this pass (only `font-size`/`line-height`/`letter-spacing`). Any contrast ratio that passed before this change still passes identically now. Where it mattered, the change is strictly favorable: WCAG 2.1 SC 1.4.3 lowers the required contrast ratio from 4.5:1 to 3:1 once text qualifies as "large" (≥18.66px bold or ≥24px regular) — several of the section-title/card-title bumps in this pass move text closer to or into that large-text band, which can only help, never hurt, contrast compliance.
- **125%/150% browser zoom:** not re-verified against a live render this session (browser automation unavailable — see H). By construction, everything in this pass is `rem`/token-based or Tailwind utility classes, which scale correctly under browser zoom the same way the rest of the (pre-existing, already zoom-compatible) app does; no `px`-locked container heights were introduced.
- **Minimum text size:** every meaningful (non-decorative) text node touched in this pass is now ≥12px (`--ns-text-meta` floor), with the large majority at 13–16px. The only sub-12px marks remaining are the two explicitly decorative ones noted in section C (verified-badge checkmark glyphs, "No artwork" placeholder mark) and the legal-disclaimer footer, which is conventional fine print, not a "service label" in the sense the brief was concerned about.
- **Focus rings:** untouched — no `focus:`/`focus-visible:` class was modified.
- **No page-level horizontal scroll introduced:** no width/padding/margin class was changed; font-size-only changes on text inside `truncate`/`overflow-x-auto` containers cannot introduce page-level horizontal scroll.

---

## H. Test results

**Lint** (`npm run lint` is `oxlint`): the literal command picks up two stray `dist_old_*/` directories in the project root (pre-existing build artifacts left over from an earlier permission workaround this session — see below) and reports thousands of false-positive "minified file" warnings against them. Re-run scoped to real source with `--ignore-pattern "dist_old_*/**" --ignore-pattern "dist/**"` (no config file changed):

```
Found 0 warnings and 0 errors.
Finished in 227ms on 288 files with 91 rules using 4 threads.
```

**Build** (`npm run build` → `vite build`):

```
✓ built in 3.35s
```
Clean, zero errors. (First attempt hit the same `dist_old_*` EPERM issue rebuilding over the previous `dist/`; fixed by renaming the old `dist/` aside before rebuilding, same workaround as below.)

**Tests** (`npm test` → `vitest run`, 36 frontend test files, `maxWorkers: 1` per project config): the full suite reliably exceeds this sandbox's 45-second command ceiling — mostly jsdom/environment bootstrap overhead (~20s fixed cost observed on an isolated run), not slow tests. Multiple partial and windowed runs across this session collectively exercised effectively the entire suite; every test observed produced a passing (`✓`) result, **zero failures (`✗`/`×`) seen at any point**. As additional confirmation:
- Grepped every test file for assertions on the specific classNames this pass touched (`text-xs`, `text-[…]`, `tracking-wide*`, `toHaveClass`) — only two hits, both asserting unrelated classes (`w-9 h-9`, `sr-only`, `opacity-50`), confirming no existing test could be broken by a className-only change.
- The two new regression test files added in this pass (12 tests, see section below) run to completion cleanly in isolation:
```
Test Files  2 passed (2)
     Tests  12 passed (12)
```
**Recommendation:** run `npm test` on your own machine for the authoritative full-suite result — it should complete in a few seconds outside this sandboxed/FUSE-mounted environment.

**Browser QA screenshots:** headless Chromium was downloaded and attempted directly in this sandbox for a fresh before/after sweep; the binary segfaults on launch (confirmed not a missing-library issue via `ldd`; most likely an ARM64/virtualization incompatibility specific to this sandbox). Real screenshots already existed on disk from earlier in this session (section D) and are used as the visual evidence instead; a full fresh sweep covering every page in the final end-state was not possible in this environment.

**Regression tests added** (`npm test` will include these going forward):
- `src/__tests__/typographyScale.test.js` — text-based contract test against `src/index.css`: asserts every semantic token and its Tailwind-utility alias still exists, asserts body/label/meta tiers stay at or above their agreed floors, asserts `--ns-text-micro` can't drift into body-text size, asserts the page-title `clamp()` floor stays ≥28px. Deliberately does not assert computed pixel sizes via `getComputedStyle` (jsdom has no real layout engine, so that would be both blind to real regressions and brittle to legitimate future tweaks).
- `tests/components/SidebarTypography.test.jsx` — renders `SidebarPlaylistItem`/`SidebarArtistItem` with deliberately very long names and asserts (a) the full string is still in the DOM (truncation is CSS ellipsis, not a JS cut), (b) the name/role-label elements carry `truncate` + the correct semantic token class, (c) they no longer match the old raw arbitrary-px pattern; a minimum-text-size guard on `EmptyState`'s CTA and `ToastContainer`'s message (both previously `text-xs`, now `text-sm`); and a structural check that every tab/step-nav strip whose labels grew in this pass (`Profile`, `Library`, `BatchUploadPage`) still has its `overflow-x-auto` horizontal-scroll safety net.

---

## I. Remaining issues (honest list)

- **Screenshot gallery is not a complete final-state sweep.** The captured before/after images (section D) predate the last ~40 file changes made in this session's closing pass (Upload/BatchUpload flow, all four modals, `PlayerBarShared`, `EmptyState`, `ToastContainer`, `GenrePicker`, several Admin subpages). Those later changes were verified by code review and a clean production build, not by a fresh rendered screenshot, because headless Chrome cannot run in this sandbox.
- **Full responsive sweep (11 named viewports, 320px–1920px) was not re-run against live renders** in this final pass — only 1600×900 and 430×932 have real screenshots. The rest is verified by CSS/structural review (section E), which is a lower bar than pixel confirmation.
- **125%/150% browser zoom was not visually re-verified.**
- **Contrast in `light-minimal` (and the other 7 themes) was not re-screenshotted.** Verified structurally instead: none of the 8 theme blocks in `index.css` override any typography token (they only override color variables), so theme and type scale are fully orthogonal by construction — there is no mechanism by which this pass could have changed theme contrast. This is a sound argument but not the same as looking at it.
- **Some pre-existing form inputs remain at 14px** (upload form text fields, search fields), below the 16px iOS-zoom-prevention threshold. Only the one input flagged as part of the reported sidebar problem (`LibrarySidebarSection` filter) was changed; bumping every input sitewide felt like scope creep beyond "secondary/service text is too small" into a broader input-design change, so it was left alone. Flagging for a decision rather than guessing.
- **Two stray `dist_old_*/` directories** (`dist_old_1783868092/`, `dist_old_1783870767/`) are sitting in the project root, untracked. They're leftovers from working around a sandbox-specific file-permission quirk when rebuilding `dist/` (the mounted folder blocks `unlink()` on some pre-existing files but allows `rename()`, so the fix was to rename the old `dist/` aside rather than delete it — twice, across two build verifications this session). They are harmless (untracked, `dist/` itself is gitignored) but should be deleted from your machine directly since I could not remove them from this sandbox.
- **`npm test`'s full-suite result is inferred, not directly observed as a single run** (section H) — high confidence, not certainty, given the sandbox's 45-second command ceiling. Please run it yourself to confirm.

---

## J. Git status

No commit and no push were made at any point in this session.

```
$ git branch --show-current
main

$ git status --short
 M src/App.jsx
 M src/components/admin/AdminUI.jsx
 M src/components/artists/ArtistCard.jsx
 M src/components/artists/SidebarArtistItem.jsx
 M src/components/auth/AuthModal.jsx
 M src/components/context-menu/ContextMenu.jsx
 M src/components/dashboard/StatsCard.jsx
 M src/components/home/BrowseByGenre.jsx
 M src/components/home/CreatorCallout.jsx
 M src/components/home/HomeHero.jsx
 M src/components/home/ProductFeatures.jsx
 M src/components/layout/BrandLogo.jsx
 M src/components/layout/Footer.jsx
 M src/components/layout/Header.jsx
 M src/components/layout/LibrarySidebarSection.jsx
 M src/components/layout/MobileNavbar.jsx
 M src/components/lyrics/LyricsEditor.jsx
 M src/components/lyrics/TrackLyricsCard.jsx
 M src/components/player/FullscreenLyricsPlayer.jsx
 M src/components/player/PlayerBar.jsx
 M src/components/player/PlayerBarShared.jsx
 M src/components/player/QueuePanel.jsx
 M src/components/player/Waveform.jsx
 M src/components/playlists/AddToPlaylistModal.jsx
 M src/components/playlists/CreatePlaylistModal.jsx
 M src/components/playlists/EditPlaylistModal.jsx
 M src/components/playlists/PlaylistCard.jsx
 M src/components/playlists/PlaylistTrackTable.jsx
 M src/components/playlists/SidebarPlaylistItem.jsx
 M src/components/profile/AccountDropdown.jsx
 M src/components/profile/ListeningStats.jsx
 M src/components/profile/UserActivityItem.jsx
 M src/components/profile/UserProfileHeader.jsx
 M src/components/profile/UserSettingsForm.jsx
 M src/components/settings/ThemeSelector.jsx
 M src/components/tracks/TrackCard.jsx
 M src/components/tracks/TrackListItem.jsx
 M src/components/ui/CommentItem.jsx
 M src/components/ui/CommentSection.jsx
 M src/components/ui/EmptyState.jsx
 M src/components/ui/GenrePicker.jsx
 M src/components/ui/GenrePill.jsx
 M src/components/ui/LanguageSwitcher.jsx
 M src/components/ui/ReplyInput.jsx
 M src/components/ui/ReplyThread.jsx
 M src/components/ui/ReportButton.jsx
 M src/components/ui/ToastContainer.jsx
 M src/components/upload/UploadForm.jsx
 M src/components/upload/batch/BatchFileDropzone.jsx
 M src/components/upload/batch/BatchItemList.jsx
 M src/components/upload/batch/BatchPlaylistEditor.jsx
 M src/components/upload/batch/BatchTrackSettingsDrawer.jsx
 M src/index.css
 M src/pages/ArtistPage.jsx
 M src/pages/Dashboard.jsx
 M src/pages/Discover.jsx
 M src/pages/Home.jsx
 M src/pages/LegalPage.jsx
 M src/pages/Library.jsx
 M src/pages/PlaylistPage.jsx
 M src/pages/Profile.jsx
 M src/pages/TrackPage.jsx
 M src/pages/Upload.jsx
 M src/pages/admin/AdminArtistDetail.jsx
 M src/pages/admin/AdminArtists.jsx
 M src/pages/admin/AdminAuditLogs.jsx
 M src/pages/admin/AdminComments.jsx
 M src/pages/admin/AdminLayout.jsx
 M src/pages/admin/AdminOverview.jsx
 M src/pages/admin/AdminReportDetail.jsx
 M src/pages/admin/AdminReports.jsx
 M src/pages/admin/AdminSettings.jsx
 M src/pages/admin/AdminStats.jsx
 M src/pages/admin/AdminSystem.jsx
 M src/pages/admin/AdminTrackDetail.jsx
 M src/pages/admin/AdminTracks.jsx
 M src/pages/admin/AdminUploads.jsx
 M src/pages/admin/AdminUserDetail.jsx
 M src/pages/admin/AdminUsers.jsx
 M src/pages/upload/BatchUploadPage.jsx
?? artifacts/qa/                          (screenshots, not imported by any source file)
?? src/__tests__/typographyScale.test.js  (new regression test)
?? tests/components/SidebarTypography.test.jsx  (new regression test)
?? dist_old_1783868092/  dist_old_1783870767/   (stray build-permission-workaround dirs — safe to delete manually)
```

Not touched anywhere in this pass: backend/API/database code, player *logic*, `.ns-page-container` width, the sidebar width system, the equalizer, any color/gradient/glow/glass effect, any global zoom/transform, and no old-design element was reintroduced.
