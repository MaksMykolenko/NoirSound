# NoirSound Frontend — Evidence Matrix

Дата: 2026-07-12 · Область: production frontend (`src/`, `index.html`) · Референс: `DesignSystem/noirsound` (read-only)
Метод: oxlint, vitest, vite build, headless Chromium (Playwright) проти dev-сервера в mock-режимі (`VITE_USE_MOCK_API=true`), статичний аналіз.
Скриншоти: `artifacts/qa/evidence/`.

## Базові перевірки (усі пройдено)

| Перевірка | Команда | Результат |
|---|---|---|
| Lint | `npm run lint` (oxlint) | 0 warnings, 0 errors (286 файлів, 91 правило) |
| Unit/component tests | `vitest run` | 34 файли, **185/185 passed** |
| Production build | `vite build` | OK, built in 286ms |
| CSS-токени | усі `var(--ns-*)` з src/index.html ↔ визначення в `src/index.css` | 100/100 використаних визначено, розбіжностей 0 |
| Асети | усі `/images/*` з src ↔ `public/images/` | 5/5 існують |
| Роути | статичні `to="/..."` ↔ маршрути в `App.jsx` | усі валідні |
| t()-ключі | 666 використаних ключів ↔ `en/common.json` | 0 відсутніх у en |
| A11y (кнопки без імені) | DOM-скан home/terms/playlist/playerbar | 0 безіменних кнопок |
| Горизонтальний overflow | 430×932: `/`, `/discover`, `/playlist/p1` | 0 px на всіх |
| Runtime-помилки консолі | 14 маршрутів, desktop+mobile | 0 (крім env-аудіо, див. E7) |

## Матриця проблем

| ID | Проблема | Severity | Статус | Докази | Рішення |
|---|---|---|---|---|---|
| E1 | `useAnimatedFavicon` у else-гілці хардкодить `document.title = 'NoirSound — Discover music after dark.'` і перебиває титули PageMeta/SSR при монтуванні та після паузи/стопу | **Medium** | **Confirmed** | Код: `src/hooks/useAnimatedFavicon.js:34`, підключено глобально в `AppLayout.jsx:16`; конфліктує з контрактом `PageMeta.jsx` (docblock: «keeps the document title … accurate»). Браузер: `/library` → title `NoirSound — Discover music after dark.` замість дефолту; `/playlist/p1` мав коректний `Late Night Phonk — Playlist…`, після кліку Play/паузи → затерто маркетинговим рядком. `/terms` («Terms of Service · NoirSound») виграє лише через повторний рендер PageMeta після завантаження даних | **Fix**: зберігати/відновлювати базовий титул через спільний util; PageMeta лишається джерелом правди |
| E2 | Прогалини локалізації `common.json`: **uk −38**, **pl −55**, **ru −55** ключів проти en → англійський fallback у видимому UI (постійний player bar: `player.playerReady`, `player.selectTrackToStart`, `player.expand` для pl/ru; форма профілю `profile.*` для pl/ru; адмінка `admin.*` для всіх трьох) | **Medium** | **Confirmed** | Скрипт парності flatten-ключів (вивід збережено в аудит-лозі); `src/i18n/index.js:50` → `fallbackLng: 'en'`. Скриншот `home.png` показує рядок «Player ready • Select a track to start listening», який для pl/ru не має перекладу | **Fix**: додати відсутні переклади в uk/pl/ru |
| E3 | Мертвий ключ `actions.more` присутній лише в pl/ru (нема в en, не використовується в коді) | Low | Confirmed | Скрипт парності: `EXTRA-DEAD: actions.more` (pl, ru); grep по src — 0 використань | Прибрано разом із правкою E2 (ті самі файли) |
| E4 | SPA-навігація на сторінки без PageMeta (Library, Discover, Dashboard, admin/*) лишає титул попередньої сторінки (після усунення E1 — статичний дефолт з index.html при першому завантаженні) | Low | Confirmed (pre-existing) | PageMeta підключений лише на 5 сторінках (grep); для кролерів титули віддає SSR `<head>` (backend/src/routes/pages.js — поза скоупом) | Не виправляється (потрібен PageMeta на ~20 сторінках — поза скоупом Low) |
| E5 | Build-warning: чанк `lucide-react` 636 kB (> 500 kB) | Low | Confirmed | Вивід `vite build` | Не виправляється (перф-тюнінг чанків, Low) |
| E6 | Адмін-розділи в demo-режимі показують «Admin data could not be loaded» (Tracks/Reports/System) | — | **Refuted (не дефект)** | `src/api/admin.js:1` — «Admin operations intentionally have no mock implementation»; graceful error-state з Retry на скриншоті `admin-tracks.png` | Без дій |
| E7 | CORS-помилка аудіо (`soundhelix.com`) у пісочниці; `audio.crossOrigin='anonymous'` (`playerStore.js:23`, потрібно для Waveform) | — | Unconfirmed / Environmental | Мережа пісочниці блокує зовнішній хост (`ERR_FAILED`); продакшн-поведінку звідси перевірити неможливо | Без дій (не підтверджено) |
| E8 | Escape не закриває fullscreen lyrics | — | **Refuted (by design)** | Каскад підтверджено кодом (`FullscreenLyricsPlayer.jsx:130-140`: спершу закривається queue) і браузером: без відкритої queue Escape закриває dialog (count 1→0) | Без дій |
| E9 | Бейдж «LISTENER» на профілі при mock-ролі ADMIN | — | Refuted (не дефект) | `UserProfileHeader.jsx:46,65` — дихотомія Creator/Listener за `artistProfileId \|\| role==='ARTIST'`, а не за адмін-роллю | Без дій |

## High-проблем не виявлено

Збірка, тести, лінт, маршрути, асети, токени — чисті; runtime-крашів немає. До виправлення прийнято: **E1, E2 (Medium)** + супутньо E3 у тих самих файлах.

## Виправлення (виконано) і верифікація

| ID | Зміни | Верифікація |
|---|---|---|
| E1 | **Fixed.** Новий `src/utils/pageTitle.js` (спільний базовий титул, ініціалізується з SSR/index.html); `PageMeta.jsx` синхронізує його через `setBaseTitle()`; `useAnimatedFavicon.js` у else-гілці відновлює `getBaseTitle()` замість хардкоду. + Тест `src/utils/__tests__/pageTitle.test.jsx` | Браузер: `/library` → `NoirSound — Creator-first music platform` (дефолт index.html, було затерто маркетинговим рядком); `/playlist/p1` → титул `Late Night Phonk — Playlist…` зберігається до і після play/pause. Скриншот `artifacts/qa/evidence/verify-playlist.png`. 0 pageerrors |
| E2 | **Fixed.** Додано всі відсутні переклади: uk +38, pl +55, ru +55 (`src/i18n/locales/*/common.json`), секції вирівняні за порядком ключів en | Парність: missing=0/extra=0 для uk/pl/ru. Браузер: player bar → pl «Odtwarzacz gotowy», ru «Плеер готов», uk «Плеєр готовий»; uk `/admin/settings` рендерить «Обмеження безпеки для всіх адмін-операцій». Скриншоти `verify-pl-home.png`, `verify-uk-admin-settings.png` |
| E3 | **Fixed** (супутньо з E2): мертвий ключ `actions.more` видалено з pl/ru | Парність extra=0 |

Повторні прогони після виправлень: oxlint **0 warnings / 0 errors** (288 файлів); vitest **187/187 passed** (+2 нові тести); `vite build` **OK (277ms)**. Змінені файли: `PageMeta.jsx`, `useAnimatedFavicon.js`, `locales/{uk,pl,ru}/common.json`; нові: `utils/pageTitle.js`, `utils/__tests__/pageTitle.test.jsx`. Backend/API/схеми не торкалися; коммітів не робилося.
