# NoirSound Platform-Inspired Themes Report

Date: 2026-06-28  
Verdict: **PLATFORM THEMES PUBLIC-BETA READY**

## Delivered themes

| Internal ID | English UI name | Ukrainian | Polish | Russian |
| --- | --- | --- | --- | --- |
| `green-stream` | Green Stream | Зелений потік | Zielony strumień | Зелёный поток |
| `orange-wave` | Orange Wave | Помаранчева хвиля | Pomarańczowa fala | Оранжевая волна |

Both themes are part of the existing nine-option theme system:

`noir-pink`, `midnight-blue`, `crimson-red`, `royal-purple`, `emerald-dark`, `light-minimal`, `green-stream`, `orange-wave`, `system`.

Selection applies immediately, writes `data-theme` and `data-theme-preference` on the root element, persists under `noirsound.theme`, survives reload, and is available in both the full Settings selector and compact account selector.

## Palettes

### Green Stream

- Background: `#050706`
- Elevated background: `#0b0f0d`
- Card: `#111512`
- Soft card: `#171d19`
- Border: `#26332b`
- Text: `#f7fff9`
- Muted text: `#a2afa7`
- Accent: `#1ed760`
- Strong accent: `#22c55e`
- On-accent text: `#031108`

### Orange Wave

- Background: `#080604`
- Elevated background: `#110d09`
- Card: `#17110d`
- Soft card: `#211710`
- Border: `#3b2a1d`
- Text: `#fffaf5`
- Muted text: `#b9aaa0`
- Accent: `#ff6a00`
- Strong accent: `#ff8a1d`
- On-accent text: `#1b0b02`

The `--ns-on-accent` token keeps labels and icons readable on the bright green/orange primary surfaces.

## Surface integration

The shared semantic token layer now drives:

- app background, elevated surfaces, cards, borders, and scrollbars;
- desktop sidebar, active navigation, top header, and mobile bottom navigation;
- primary/secondary buttons, focus rings, selected tabs, pills, and filters;
- bottom player, player indicators, progress and volume sliders;
- Home hero, release cards, playlists, artists, and library items;
- Discover filters and GenrePicker;
- Upload form, file zones, controls, and submit CTA;
- profile/settings, dashboard/stat cards, empty states, modals, and dropdowns.

Default pink literals are absent from the audited key theme surfaces. The magenta account avatar and red-toned hero photography remain content/identity assets, not theme chrome.

## Accessibility and readability

Calculated WCAG contrast ratios:

| Pair | Ratio |
| --- | ---: |
| Green primary text / app background | 19.84:1 |
| Green muted text / app background | 8.88:1 |
| Green on-accent text / green accent | 10.06:1 |
| Orange primary text / app background | 19.50:1 |
| Orange muted text / app background | 8.98:1 |
| Orange on-accent text / orange accent | 6.68:1 |

All listed pairs pass WCAG AA for normal text. Theme cards use native buttons with radio semantics, selected state, a global accent-driven `:focus-visible` treatment, localized accessible names, and keyboard reachability.

## Screenshots captured and reviewed

Desktop captures are 1440×900 unless noted:

- `design-audit-screenshots/themes/green-stream-home.png`
- `design-audit-screenshots/themes/green-stream-discover.png`
- `design-audit-screenshots/themes/green-stream-player.png` — 1440×48 player crop
- `design-audit-screenshots/themes/orange-wave-home.png`
- `design-audit-screenshots/themes/orange-wave-upload.png`
- `design-audit-screenshots/themes/orange-wave-player.png` — 1440×48 player crop
- `design-audit-screenshots/themes/mobile-green-stream-390x844.png`
- `design-audit-screenshots/themes/mobile-orange-wave-390x844.png`
- `design-audit-screenshots/themes/mobile-theme-selector-390x844.png`

The final images were reviewed after font readiness and animation stabilization. Home, Discover, Upload, player, navigation, theme cards, and 390×844 mobile layouts are complete and have no horizontal overflow.

## Tests

| Command | Result |
| --- | --- |
| `npm run test` | 17 files, 66 tests passed |
| `npm run build` | Passed |
| `npm run test:e2e` | 28 tests passed |
| `npm run lint` | Exit 0; existing unrelated warnings remain |

Theme-specific coverage includes:

- both themes exist in configuration and render in ThemeSelector;
- immediate selection and root `data-theme` application;
- localStorage persistence and reload restoration;
- localized names in English, Ukrainian, Polish, and Russian;
- required semantic CSS variables;
- compact account selector;
- system light/dark resolution;
- green/orange propagation to buttons, active nav, player, and Upload;
- mobile selector count/accessibility and overflow checks;
- automated screenshot generation.

Existing authenticated E2E specs now reuse one cookie session per serial group, so the standard parallel `npm run test:e2e` command respects the unchanged backend login rate limit.

Backend theme preference was not changed, so backend tests were not required. Theme preference remains intentionally local to the current device.

## Brand safety

These themes are platform-inspired color moods only. They do not use third-party logos, names, assets, or exact layouts.

The theme configuration, selector, translations, and theme tests expose only `Green Stream` and `Orange Wave`. The pre-existing Artist page can display a user-provided SoundCloud social link; that is profile metadata and is not connected to either theme.

## Files changed

Core theme system:

- `index.html`
- `src/App.jsx`
- `src/index.css`
- `src/theme/themes.js`
- `src/theme/themeUtils.js`
- `src/store/themeStore.js`

Selector and localization:

- `src/components/settings/ThemeSelector.jsx`
- `src/components/profile/UserSettingsForm.jsx`
- `src/components/profile/AccountDropdown.jsx`
- `src/i18n/locales/en/common.json`
- `src/i18n/locales/uk/common.json`
- `src/i18n/locales/pl/common.json`
- `src/i18n/locales/ru/common.json`

Theme-token consumers audited/adjusted:

- `src/components/layout/BrandLogo.jsx`
- `src/components/layout/Header.jsx`
- `src/components/layout/LibrarySidebarSection.jsx`
- `src/components/player/PlayerBar.jsx`
- `src/components/tracks/TrackCard.jsx`
- `src/components/playlists/PlaylistCard.jsx`
- `src/components/ui/GenrePill.jsx`
- `src/components/ui/LanguageSwitcher.jsx`
- `src/components/profile/UserProfileHeader.jsx`
- `src/components/playlists/CreatePlaylistModal.jsx`
- `src/components/artists/ArtistCard.jsx`
- `src/pages/ArtistPage.jsx`
- `src/components/ui/ReplyInput.jsx`
- `src/components/ui/CommentSection.jsx`

Tests:

- `src/store/__tests__/themeStore.test.js`
- `tests/components/ThemeSelector.test.jsx`
- `tests/e2e/theme-system.spec.js`
- `tests/e2e/mobile-design.spec.js`
- `tests/e2e/genre-design.spec.js`

## Remaining issues

No blocking visual issue was found on the reviewed platform-theme surfaces.

Non-blocking repository notes:

- preferences are device-local rather than account-synced;
- the production build reports the existing `lucide-react` chunk-size advisory;
- lint still reports pre-existing unrelated warnings elsewhere in the repository.
