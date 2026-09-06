# NoirSound — інтеграція мінімалістичного лендінгу

**LANDING INTEGRATED — LOCAL VERIFIED**

Дата локальної перевірки: 2026-09-06. Фінальний `node scripts/run-integration.mjs all` завершився exit 0: 491 frontend, 360 backend, 15 harness і 86 E2E passed; failed/skipped/not run — 0. Lint: 0 errors, 7 чинних попереджень; web build і forbidden scan PASS. Окремо Docker web/backend build та 43 HTTP checks PASS. Деталі зафіксовано в `NOIRSOUND_LANDING_FUNCTIONAL_QA.md`, `artifacts/landing/final-all.log` і `test-results/integration/all-summary.json`.

## Джерело, база й межі

Використано саме доступний інтерактивний прототип з `/Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Web/noirsound-landing-prototype/`: `index.html`, `source/index.template.html`, `source/style.css`, `source/app.js`, `assets`, `README.md`, `QA.md`. Перед реалізацією прочитано вихідні частини й відкрито прототип у браузері: hero, scroll-сцени, Music/Beats, creator editor, mobile menu та motion off. Попередні згенеровані картинки не були специфікацією.

SHA-256 вихідного `index.html`: `5cffe797853d415419bf59e89c5289376280b6fe250bcfcace9c82e4446618ff`. Контрольні суми інших джерел збережено в `artifacts/landing/original-checkout-snapshot.json`.

Оригінальний checkout був суттєво змінений: branch `feat/noirsound-connect-discord-presence`, HEAD `79b43b5a93f356e4cc4c6224ab9676dfe3713c73`. Для інтеграції створено ізольований worktree `/Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration`, branch `codex/noirsound-landing-integration`, на перевіреному `origin/main` **`a2b3da55e9c18f5d97795362a7916f32a4a50598`**, з чинними Music/Beats, Discover і серверним catalog search. Remote HEAD перевірено під час початку роботи; це provenance бази, а не CI доказ незакомічених змін.

Після реалізації всі **592** файли початкового snapshot мають ті самі хеші; Git status оригінального checkout також ідентичний. Доказ: `artifacts/landing/original-checkout-verification.json`. Reset, clean, stash, видалення lock-файлів, commit, push, merge, release tag і deployment не виконувалися. Schema, processing worker, статистика, upload pipeline і правила artist access не змінювалися. Нових залежностей немає.

## Локальний запуск

Поточний інтегрований preview: **http://127.0.0.1:50441/**, API: `http://127.0.0.1:50440/api`. Це real API mode із власними PostgreSQL/Redis/Minio/worker, а не production deployment. На момент передачі preview працює, PID runner `65160`, project `noirsound-verify-34a4c2986931`.

```sh
cd "/Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration"
node scripts/run-integration.mjs preview
```

При новому запуску runner обирає вільні loopback-порти; URL друкується в консолі й записується в `test-results/integration/preview-summary.json`. Потрібен запущений Docker. Встановлені залежності готові; для нового checkout потрібні `npm ci` у root і backend.

Preview має нову ізольовану тестову БД: мінімальні test accounts, **жодних demo releases**. Тому listening section чесно показує порожній стан. Дані живуть до зупинки preview; Ctrl+C прибирає лише ресурси цього запуску. Команди production/reset/seed вручну не виконувалися. Чинний integration runner сам ініціалізує дозволені тимчасові `*_test` бази; його backend regression suite також використовує власні minimal/demo fixtures. Ці дані не підключені до preview або production каталогу.

## Mapping і routing

| Частина прототипу | React / shared integration |
| --- | --- |
| Мінімальний header, brand, секції, motion, mobile menu | `src/components/landing/LandingHeader.jsx`, чинні AuthModal/user store |
| Hero, вініл/конверт, statement, interlude, closing, footer | `src/pages/LandingPage.jsx` |
| Music/Beats, компактні рядки, artwork deck | `src/components/landing/LandingListenSection.jsx` |
| Creator-кроки, поля, dropzone | `src/components/landing/LandingCreatorSection.jsx` |
| Нативний діалог візуального preview | `src/components/landing/LandingReleasePreview.jsx` |
| Паралакс, проявлення, прогрес і cleanup | `src/hooks/useLandingMotion.js` |
| Landing chrome без app sidebar/navbar | `src/components/layout/LandingLayout.jsx` |
| Єдиний player/queue/lyrics/context menu host | `src/components/layout/PublicAppShell.jsx` |

`/` — публічний landing для гостя й авторизованого користувача, без session redirect. `/home` — попередня корисна Home; Sidebar/MobileNavbar Home тепер ведуть сюди. Brand веде на `/`. `/discover`, `?content=MUSIC`, `?content=BEAT`, `/upload`, `/upload/batch` використовують чинний router і URL-контракти. Track/Artist/Playlist, legal, OAuth callback, admin та query parameters збережені. Внутрішні CTA — same-tab React Router Links, без нового router або піддомену.

## Композиція та motion

Збережено чорний фон, великі короткі заголовки, білу головну кнопку, рожевий акцент, CSS-вініл із конвертом, послідовний manifesto, compact showcase і багатошарові обкладинки, декоративний горизонтальний interlude, editor, closing wordmark та мінімальний footer. Використано чинний Commissioner/UI font NoirSound.

`requestAnimationFrame` змінює локальні CSS variables/transform/opacity: різні швидкості тексту, конверта й вінілу; `--listen` для шарів; `--create` для editor і активного кроку; page progress; reveal-on-scroll через IntersectionObserver. React state не оновлює всю сторінку на scroll frame. Wheel/touch не перехоплюються. Resize, pageshow, visibilitychange і unmount мають cleanup; StrictMode та ініціалізаційна помилка перевірені функціонально.

На mobile сцени стають звичайним потоком. На коротких desktop-вікнах creator відкріплений до висоти 1000px, listening — до 850px. Motion off і системний reduced-motion прибирають довгі sticky-сцени та transforms; всі тексти й дії залишаються доступними. Preference має захищений localStorage доступ. Помилка animation initialization відключає enhancement і розкриває контент.

CSS scoped під `.ns-landing`. Одна необхідна route-specific виняткова адаптація: `LandingLayout` на час mount додає `.ns-landing-document` до html/body, щоб `overflow-x:clip` не створював body scroll-container, який ламав native sticky. Cleanup прибирає тільки доданий ним клас; звичайний app overflow відновлюється. Ручна перевірка підтвердила sticky top=0 та очищення при переході в Discover. Theme dataset і preference не змінюються; global scroll behavior не перезаписується. Native dialog scroll lock відновлює попереднє inline значення.

## Реальний каталог і один player

Мінімальний `GET /api/tracks/showcase` вибирає до 12 кандидатів окремо для MUSIC/BEAT через shared public visibility helper, перевіряє наявність ненульового processed audio object з audio MIME та повертає максимум **3 + 3** через існуючий public serializer і frontend track mapper. Published/public/not hidden/visible active author policy збережена. Список обмежений навіть при недоступному storage; помилка повертає чесний API failure, без fallback-треків.

Запит каталогу не затримує початковий hero. Loading/empty/error живуть тільки в listening section; каталожний CTA доступний. Storage HEAD перевірки не завантажують аудіо; hover і tab switch не запускають stream або PlayEvent. Для реального релізу використовується його cover/shared fallback. SVG прототипу показані тільки як явно підписана декоративна графіка. Demo MP3, `demoAudio`, `audioDock`, `window.NoirSoundPrototype`, inline bridge чи synthesized fallback не перенесено.

Play викликає поточний player action з обмеженою showcase queue. `PublicAppShell` залишається змонтованим при переходах landing/app/track/home; shared PlayerBar, queue, fullscreen lyrics, context menus і audio singleton збережені. Без current track на `/` немає порожнього playerbar. З активним треком є player і нижній відступ, включно з mobile safe area. Vinyl лише читає `isPlaying`.

## Creator, draft, auth і upload

Title, preview credit, Music/Beat та File зберігаються в `landingDraftStore` **лише у пам’яті вкладки**. SessionStorage містить тільки marker `1` для пояснення втрати draft після refresh; аудіо/назви не записуються у storage/URL/cookies. Preview використовує React text, а не innerHTML. Поле credit не передається як owner/ArtistProfile.

File validation повторно використовує чинні upload utilities, формати та ліміт 50MB. Вибір файла й preview не створюють серверного Upload/Track. `Продовжити завантаження` фіксує intent і веде на `/upload`; форма бере title/contentType/File, проходить чинний sign-in/access flow, вимагає права на аудіо/lyrics і лише explicit submit відправляє файл. Успіх очищує draft. Звичайна SPA-навігація зберігає заповнення; refresh/full OAuth redirect пояснюють повторний вибір файла.

Окремого local-audio engine для editor немає: залишено чесне **візуальне** preview, прослуховування й обробка належать чинному upload/product flow. Це свідома адаптація прототипу до вимоги одного плеєра.

Перевірка upload intent виявила старий open-redirect edge case в OAuth return path з control characters. Вузько виправлено `safeReturnTo`: control characters відхиляються, resolved URL перевіряється same-origin, valid path/query/hash збережені. Докази й 14 регресійних кейсів — `artifacts/landing/OAUTH_RETURN_TO_REMEDIATION.md`. Live Google provider login не виконувався.

## Теми, i18n, accessibility і SEO

Landing tokens локальні; звичайна app theme працює після виходу. Copy додано до чинного i18n через `landingResources.js` та `landingCreatorResources.js`: en/uk/pl/ru, без окремого locale store. Назви авторських треків та credit не перекладаються; жанри залишаються англійськими. Порожніх `href="#"`, вигаданих counts/socials/licences/testimonials немає; footer веде на `/terms`, `/privacy`, `/abuse`.

Skip link, видимий focus, native dialog, Escape/focus restore, mobile menu focus wrap, keyboard Music/Beats tabs, radio/input labels, safe-area padding та native text-input context menu збережено. React useId для editor/dialog зв’язків; декоративні SVG ізольовані як зовнішні img, без спільних inline ID.

Backend metadata renderer додає root-only читабельний початковий HTML з головним змістом і реальними CTA. App routes його не отримують. Root canonical, description, OG/Twitter відповідають лендінгу; на raw HTTP початкова мова EN, після hydration чинна UI-мова оновлює metadata. Існуюча OG image перевірена й доступна. PageMeta очищує застарілі managed tags/JSON-LD на переходах, Artist image має коректний fallback.

Caddy передає root і Discover у чинний metadata renderer. Backend revalidate app shell через ETag, тому новий web build не лишає старі JS references до restart. Перебудовані локальні Docker images пройшли 43 HTTP checks: root content/meta, current hashed assets, Track/Artist/Playlist/legal, query/deep refresh, robots/sitemap, OG PNG, security headers та shell update. Fixture HTTP smoke перевіряє routing/template, а persistence доводиться окремим real-service E2E.

## Відмінності від standalone HTML

- Demo records/audio/dock замінено реальною bounded вибіркою, singleton player та чесними empty/error states.
- App Home доступна на `/home`; додані чинні sign-in/account і legal routes.
- Creator має explicit local preview + real upload, credit-only поле, права й пояснення втрати File; синтезований «власний реліз» прибрано.
- Використано чинний шрифт і чотири UI-мови; декоративні assets винесено в `public/landing`, JS bridge не перенесено.
- Sticky вимикається на коротких/mobile екранах заради доступності полів і CTA; animation failure працює як progressive enhancement fallback.
- Публічний HTML/metatags, safe return URL і збереження актуального build реалізовані в чинній архітектурі.

## Перевірки й залишкові межі

Актуальні passed/failed/skipped/not-run числа, початкові виявлені помилки, їх виправлення та докази наведено в **`NOIRSOUND_LANDING_FUNCTIONAL_QA.md`**. Локальна перевірка не є GitHub CI або production smoke: зміни незакомічені, remote не змінювався.

Не виконувались: VPS deployment/live production smoke; зовнішній Google OAuth consent/login; реальний телефон із системною екранною клавіатурою; окремий screen-reader audit і Safari/Firefox runtime. Mobile розміри та focus/input/menu перевірено у Chromium viewport. Не відновлювались screenshot/CSS/font/color regression suites. Ці межі не підмінені позитивним результатом.
