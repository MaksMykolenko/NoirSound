# NoirSound Translation Coverage Report

## 1. Localized UI Text Scope

All static platform UI text, navigation labels, headers, action buttons, player controls, form inputs, dashboard metrics, empty states, and error messages have been extracted and translated into `en`, `uk`, `pl`, and `ru`.

| Category | Coverage Status | Notes |
| :--- | :--- | :--- |
| **Navigation & Sidebar** | 100% Localized | Home, Discover, Library, Upload, Profile, Workspace badges. |
| **Header & Account Dropdown** | 100% Localized | Search placeholder, Sign in, Profile Settings, Creator Dashboard, Log Out. |
| **Music Player & Queue** | 100% Localized | Now Playing, Queue, Audio Unavailable, Open Player. |
| **Profile & Settings** | 100% Localized | Tabs (Overview, Liked, Playlists, Artists, Activity, Stats, Settings), Edit Profile, Followers. |
| **Creator Dashboard** | 100% Localized | Total Streams, Hearts, Creator Analytics empty state. |
| **Empty States & Actions** | 100% Localized | Follow, Following, Discover Music, Clear Filters, Save Changes. |

---

## 2. Platform Genre Category Translation

Platform genre categories are translated dynamically for display using `src/i18n/genreLabels.js` while keeping underlying backend database string values stable:
- `Phonk` → Phonk / Фонк / Phonk / Фонк
- `Electronic` → Electronic / Електроніка / Elektronika / Электроника
- `Rap` → Rap / Реп / Rap / Рэп
- `Lo-fi` → Lo-fi / Лоу-фай / Lo-fi / Лоу-фай

---

## 3. Preserved User-Generated Content

As required by product rules, user-generated content is left untranslated:
- Track titles & album titles
- Artist display names & usernames
- User bios & location strings
- User playlist titles & descriptions
- Comments & user activity text
