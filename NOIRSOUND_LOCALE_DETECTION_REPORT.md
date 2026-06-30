# NoirSound Locale Detection & Region Mapping Report

## 1. Detection Priority Order

`src/i18n/index.js` implements a custom language detection hierarchy:

1. **User Manual Override**: Checked from `localStorage` (`noirsound_language`). Overrides browser detection once set.
2. **Backend User Preference**: For logged-in users, `user.preferredLanguage` syncs to i18n upon session fetch/login.
3. **Browser Languages**: Inspects `navigator.languages` / `navigator.language` and maps locale codes (`uk-UA` -> `uk`, `pl-PL` -> `pl`, `ru-RU` -> `ru`, `en-US` -> `en`).
4. **Fallback Language**: Defaults to English (`en`).

---

## 2. Dynamic Document Language & Formatting

- Synchronizes `<html lang="...">` dynamically via `i18n.on('languageChanged')`.
- Formats dates and numbers using standard `Intl.NumberFormat(lang)` and `Intl.DateTimeFormat(lang)` in `src/utils/formatLocale.js`.
