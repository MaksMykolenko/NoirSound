# NoirSound — функціональна перевірка інтеграції лендінгу

Дата: 6 вересня 2026 року. Робочий каталог: `/Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration`. Гілка: `codex/noirsound-landing-integration`; базовий HEAD: `a2b3da55e9c18f5d97795362a7916f32a4a50598`. Зміни інтеграції локальні, без commit, push або deployment.

**LANDING INTEGRATED — LOCAL VERIFIED.** Фінальний `node scripts/run-integration.mjs all` завершився exit 0 на остаточному локальному коді: 491 frontend, 360 backend, 15 harness і 86 E2E passed. Failed/skipped/interrupted/not run — 0. Нижче збережено межі кожного виду доказу; локальний результат не є production verification.

## Підсумок виконаних перевірок

| Перевірка | Фактичний результат | Джерело та межа доказу |
| --- | --- | --- |
| Frontend unit/component, поточний фінальний `all` | **PASS — 71 файл, 491 тест** | `frontend-test.log` фінального ізольованого прогону; це перевірка коду та функцій у Vitest/jsdom, без screenshot assertions. |
| Backend, фінальний `all` | **PASS — 360 тестів** | [final-all.log][final-log]: 263 + 20 + 18 + 43 + 1 + 15 = 360. OAuth 14 входять у загальні групи та не додані вдруге. |
| E2E у фінальному `all` | **PASS — 86/86; failed 0, skipped 0, interrupted 0, not run 0** | [all-summary.json][all-summary] і [final-all.log][final-log]: усі cases виконано на остаточних файлах. Попередній окремий 86/86 E2E також збережено у [e2e-summary.json][e2e-summary]. |
| Склад цих 86 E2E | **70 real-service + 8 HTTP-fixture + 8 demo** | Класифікацію перевіряє [runner][runner]. Вісім HTTP-fixture і вісім demo не позначаються як persistence verification. |
| Docker build / локальний production-like HTTP | **PASS — 43 перевірки** | [HTTP summary][docker-summary]: поточні web/backend images, Caddy, початковий HTML, hashed assets, deep links, OG/robots/sitemap, security headers, OAuth origin та ETag shell refresh. DB/storage у цьому smoke — явні fixtures; це не persistence proof або VPS deployment. |
| Harness isolation/security guards | **PASS — 15/15** | [final-all.log][final-log]; runner відхиляє production/non-loopback scope, skips, retries і неповне E2E coverage. |
| Lint / web build / forbidden scan / diff check | **PASS** | [final-all.log][final-log]: lint 0 errors і 7 чинних попереджень; build, forbidden scan і diff check завершились успішно. |
| Остаточний сукупний `node scripts/run-integration.mjs all` | **PASS — exit 0; cleanup PASS** | [all-summary.json][all-summary]: `noirsound-verify-c5cf3b60e32e`, `2026-09-06T12:31:35.716Z` → `2026-09-06T12:38:24.052Z`. |
| Збереження початкового checkout | **PASS — 592 файли без зміни хешів; Git status незмінний** | [original-checkout-verification.json][original-checkout]. Оригінальна гілка і незавершена робота не перезаписані. |
| Google OAuth у справжнього провайдера | **NOT RUN** | Перевірено локальні URL/HTTP boundaries та попередження про втрату File, але live Google authorization не виконувалася. |
| Реальний телефон та його екранна клавіатура | **NOT VERIFIED** | Використано браузерні viewport 390×844 і 360×800; це не тест апаратного пристрою. |
| GitHub / production | **NOT RUN** | Commit, push, merge, release tag та deployment не виконувались. |

Повний збережений лог фінального прогону: [artifacts/landing/final-all.log][final-log]. Тимчасові redacted per-gate логи також залишені у `/var/folders/6v/9tj_8qqd4sb9bdy9q3wp0yw00000gn/T/noirsound-integration-XzIaSm/`; підсумок — у [all-summary.json][all-summary].

## Матриця вимог і доказів

`PASS (component)` означає виконаний тест React/store/HTTP handler із контрольованими залежностями. `PASS (real E2E)` нижче стосується завершеного фінального прогону з реальними ізольованими сервісами. Його aggregate і cleanup підтверджено у таблиці вище.

| № | Вимога | Результат і конкретний доказ |
| --- | --- | --- |
| 1 | `/` відкриває landing, `/discover` — застосунок | **PASS (component + real E2E).** [PublicRoutingPlayback][test-routing] перевіряє справжній `App`/router/layout, а [landing.spec.js][e2e-landing] проходить між публічними маршрутами у браузері. Гість і авторизований listener залишаються на `/`. |
| 2 | Попередня Home доступна | **PASS (component + real E2E).** Home перенесено на `/home` у [App.jsx][app]; Home-пункти sidebar/mobile navbar ведуть туди. Збережено [Home component tests][test-home] і [Home E2E][e2e-home] з їхніми попередніми функціональними assertions. |
| 3 | Внутрішні CTA та query/hash | **PASS (component + real E2E).** Посилання каталогу мають `/discover?content=MUSIC` і `/discover?content=BEAT`; зберігаються content, genre, sort і hash. SPA-переходи не відкривають другу вкладку. [Routing tests][test-routing], [listening tests][test-listen], [browser tests][e2e-landing]. |
| 4 | Music/Beats перемикає відповідні дані | **PASS (component + real E2E).** Таб-перемикач змінює групу реального showcase та URL каталогу; ArrowLeft/ArrowRight/Home/End керують фокусом і вибором. [LandingListen][test-listen], [landing E2E][e2e-landing]. |
| 5 | Loading, empty, API failure без фейкових треків | **PASS (component + ручна перевірка).** [LandingListen tests][test-listen] окремо перевіряють усі три стани, відсутність доступного Play і наявність посилання у каталог. Порожня реальна база та помилка API також оглянуті в браузері; API failure не видається за порожній успішний результат. |
| 6 | Showcase Play використовує чинний player | **PASS (component + real E2E).** Вибраний release і bounded queue передаються в `playTrack`; для активного треку викликається `togglePlay`. Браузерний тест відтворює справжній WAV із MinIO через чинний stream endpoint. [Listening implementation][listen-source], [tests][test-listen], [E2E][e2e-landing]. |
| 7 | Page load, scroll, hover, перемикання секцій не створюють прослуховувань | **PASS (real E2E).** Passive-сценарій рахує `PlayEvent` у PostgreSQL до/після, відстежує відсутність stream requests і перевіряє, що current track не з'явився. Component tests додатково перевіряють, що player actions не викликані. [landing.spec.js][e2e-landing]. |
| 8 | Єдиний audio та неперервний playback між layout | **PASS (component + real E2E).** Component test порівнює той самий `Audio`, той самий `ontimeupdate`, той самий DOM-вузол PlayerBar, track, queue, originalQueue, source, progress, volume, shuffle і repeat. Real E2E проходить `/ → /discover → /track/:id → / → /discover → /home`, порівнює audio за ідентичністю і перевіряє, що він не paused, а progress не відкотило. [Routing tests][test-routing], [E2E][e2e-landing]. |
| 9 | Motion toggle та live reduced-motion | **PASS (component + real E2E).** Перевірено manual off після remount/reload, зміну системної preference під час роботи та її пріоритет. Відмова localStorage не ламає motion control або player preference. [Motion tests][test-motion], [playerStorage][test-player-storage], [mobile E2E][e2e-landing]. |
| 10 | Cleanup і відмова animation enhancement | **PASS (component), додатково ручна перевірка навігації.** StrictMode mount/unmount очищує observers, RAF, scroll/resize/pageshow/media listeners; окремий failure-тест перевіряє `visibilitychange`, відсутність нових callbacks після unmount і читабельний fallback при винятку observer initialization. Scroll frame не спричиняє React rerender власника. [Motion tests][test-motion]. |
| 11 | Creator preview оновлюється, але нічого не публікує | **PASS (component + real E2E).** Назва/credit/contentType відображаються як React text; preview не має незалежного playback. До submit немає нового Track та upload-init request. [Creator tests][test-creator], [creator E2E][e2e-creator]. |
| 12 | File/dropzone не відправляє файл без явного submit | **PASS (component + real E2E).** Застосовуються чинні формати та ліміти upload. E2E контролює число POST `/uploads/track/init` і перевіряє нуль нових Track до підтвердження прав та submit. [Creator tests][test-creator], [creator E2E][e2e-creator]. |
| 13 | Draft передається в Upload без підміни owner | **PASS (component + real E2E).** SPA зберігає той самий `File`; allowlist draft не приймає owner/profile/return URL. Реальний upload доходить до worker і `PUBLISHED`; PostgreSQL підтверджує `artist.userId` та `upload.userId` поточного акаунта, а preview credit не стає owner. [Draft store][draft-store], [creator tests][test-creator], [creator E2E][e2e-creator]. |
| 14 | Guest, artist, listener, blocked artist та OAuth intent | **PASS (component + локальні HTTP boundaries; guest/artist/listener також real E2E).** Звичайний sign-in зберігає draft у SPA; listener бачить `Creator access required`, profile-blocked artist — чинний profile gate. Google redirect попереджає про втрату локального draft; same-origin return URL перевіряється на start і callback, включно з ASCII control characters та раніше підписаним cookie. Live Google — **NOT RUN**. [Creator tests][test-creator], [creator E2E][e2e-creator], [OAuth tests][test-oauth]. |
| 15 | Mobile menu, keyboard, Escape і focus | **PASS (real E2E + ручна перевірка).** Native modal menu має явний Tab wrap; Escape повертає фокус, закриття/перехід відновлює body scroll. Queue, context menu та fullscreen lyrics використовують наявні Escape/inert/focus механіки і на landing. [LandingHeader][header-source], [routing tests][test-routing], [player navigation][test-player-nav], [lyrics tests][test-lyrics], [landing E2E][e2e-landing]. |
| 16 | Root metadata, Track/Artist/Discover, початковий HTTP | **PASS (component/handler + real E2E + Docker/HTTP).** Root має canonical/title/description/OG/Twitter та читабельні CTA до JavaScript; landing content не додається на app routes. Перевірено оновлення bundle hash після rebuild, fallback shell, sitemap і metadata при SPA-навігації/refresh. [PageMeta tests][test-page-meta], [landing HTTP tests][test-http], [landing E2E][e2e-landing]. |

## Де саме є перевірка persistence

Шість нових browser cases містяться у [landing.spec.js][e2e-landing] та [landing-creator.spec.js][e2e-creator]. Вони працюють із чинними API, PostgreSQL, Redis, MinIO і processing worker ізольованого runner. У цих файлах немає підміни API/stream responses через `page.route`.

Showcase-фікстура навмисно створює локальні тестові Music/Beat записи й справжній WAV у тестовому storage, а також private/hidden/draft/unprocessed/missing/non-audio/hidden-author/inactive-author записи. Це справжні записи ізольованої БД, а не production-каталог. E2E звіряє видані ID та типи з цією фікстурою, обмеження трьох записів у групі та відсутність passive `PlayEvent`.

Creator E2E проходить існуючий upload-init → presigned PUT → complete → worker pipeline і читає кінцеві Track/Upload/owner з PostgreSQL. Саме цей сценарій підтверджує збереження даних і власника. Component tests із замоканою upload-функцією підтверджують контракт виклику, але окремо не доводять persistence.

Handler-тести [showcase HTTP contract][test-showcase] перевіряють query/serializer/обмеження storage checks із замоканими Prisma/storage залежностями. `Fastify.inject` у них не означає наявність реальної БД. Аналогічно [початкові HTTP metadata tests][test-http] перевіряють згенерований HTML, але самі не доводять роботу контейнерної мережі чи Caddy; для цього використано окремі Docker/HTTP перевірки.

Вісім existing `ui-interactions.spec.js` — HTTP-fixture tests. Вісім `chromium-demo` — явний mock/demo build. Їх збережено як окремі функціональні регресії; жоден із цих 16 тестів не зарахований до 70 real-service cases.

## Ручна браузерна перевірка

Нижче зафіксовано спостереження координатора у поточній сесії; додатковий протокол — [design-qa.md][design-qa]. Це ручна перевірка інтеграції, а не відновлена visual/screenshot suite. Тести не містять нових assertions на точні шрифти, кольори, геометрію або CSS-класи.

| Середовище/стан | Що перевірено | Доказ і межа |
| --- | --- | --- |
| Оригінальний інтерактивний HTML і React-інтеграція, 1440×900 | Hero, чорна палітра, вініл/конверт, manifesto, listening/artwork, interlude, creator preview, closing/footer | Відкрито оригінал і інтеграцію, оглянуто секції та прокручування. Це зіставлення з наданим прототипом, не нова дизайн-концепція. |
| 390×844 | Вертикальний потік, menu, native dialog, preview і доступність дій | Ручна браузерна перевірка; keyboard/menu поведінка додатково пройдена реальним E2E. |
| 360×800 | Компактна навігація, creator inputs/дії, відсутність довгих sticky-сцен | Фінальний ручний огляд українською: ширина вмісту 349 ≤ 360, listening/creator мають звичайне relative positioning. Додатково E2E переходить із mobile menu в Discover. Апаратна екранна клавіатура не перевірялась. |
| Низький desktop 1440×720 | Доступність creator editor та кнопок при короткому viewport | Ручний огляд після перенесення прототипу; не використано фіксовану sticky-висоту, яка ховає дії. |
| Desktop 1440×1080, sticky listening | Фактичне закріплення сцени та розвиток scroll progress | Після виправлення route-only `overflow-x: clip` при `scrollY=1776.5` верх сцени `−76.5`, верх sticky-вузла `0`, `--listen=0.0885`. Це діагностичне browser-спостереження, не точний розмір у test assertion. |
| en/uk/pl/ru | Коротка landing copy, заголовки, меню та editor | Ручний огляд усіх чотирьох локалей; E2E додатково перемикає мови й перевіряє незмінність назв реальних релізів і app theme. |
| Порожній real showcase та API failure | Чесний короткий стан, збережена композиція, каталог доступний, немає фейкового Play | Ручний огляд і окремі component scenarios. Порожній preview має реальний API та порожню тестову БД, а не demo fallback. |
| Motion off / system reduced / mobile | Вміст і CTA доступні без enhancement; preference не змінює тему | Ручний огляд; persistence та live media-query change перевірені component/E2E. |
| Menu і creator preview | Native dialogs, Escape, focus restore, scroll unlock | Ручна перевірка та E2E/component tests; fullscreen/queue залишаються чинними shared overlays. |

Landing CSS обмежений `.ns-landing`. Виняток — тимчасовий клас `ns-landing-document` на `html`/`body`, який лише замінює горизонтальне `overflow-x: hidden` на `clip`, щоб браузерна sticky-сцена слідувала viewport. [LandingLayout][landing-layout] додає та видаляє його разом із маршрутом; `dataset.theme` і theme preference не перезаписуються. Shared PlayerBar розміщено поза `.ns-landing`.

## Знайдені збої та повторна перевірка

Перший повний E2E завершився **84 passed / 2 failed**. Обидва результати збережено у первинних логах, assertions не приховано skip або ослабленням:

1. Native mobile menu дозволяв Tab вийти за внутрішній цикл елементів. Додано явний wrap першого/останнього control у `LandingHeader`; початковий сильний E2E assertion на focus containment залишено.
2. Старий admin-return demo test очікував порожній PlayerBar одразу на `/`. Оновлено сценарій відповідно до нового маршруту: `/` має landing без порожнього player, після реального CTA в `/discover` збережено початкове очікування видимого стандартного player.

Після цих змін окремий повний ізольований E2E завершився **86/86 PASS**. Після подальших вузьких виправлень motion failure cleanup, sticky overflow та OAuth return URL повторний фінальний `all` також завершився **PASS, exit 0** з усіма **86/86 E2E**. Первинні два збої не викреслено з історії перевірок; остаточний код перевірений повторно.

## Відтворення перевірок

Головна команда з кореня цього ізольованого worktree:

```bash
node scripts/run-integration.mjs all
```

Runner перевіряє loopback endpoints, окремі `*_test` бази, випадковий Compose project і `VITE_USE_MOCK_API=false`; не читає приватні `.env` поточного checkout. Він створює власне тестове оточення та виконує мінімальну тестову ініціалізацію лише в ньому. Existing development/production база не reset/seed-иться. Для завершеного E2E cleanup позначений PASS.

Окремий повтор у такому самому ізольованому scope:

```bash
node scripts/run-integration.mjs e2e
```

Функціональні frontend-тести можна запускати через `npm test`; `npm run lint`, `npm run build`, `npm run check:forbidden` та `git diff --check` входять у повний `all`. `playwright --list` використовувався лише для перевірки складу suite і ніде не зарахований як запуск тестів.

Поточний локальний real-mode preview зареєстрований у [preview-summary.json][preview-summary]. На момент складання документа це `http://127.0.0.1:50441` з API `http://127.0.0.1:50440/api`, ізольована тестова база без demo releases. Для нового запуску:

```bash
node scripts/run-integration.mjs preview
```

Порти виділяються динамічно; актуальну URL потрібно брати з повідомлення runner або summary. Цей preview не є production deployment; його тестові дані тимчасові.

## Неперевірені межі

- Live Google sign-in/consent/callback із реальним провайдером не виконано. Перевірені локальні URL boundaries, start/callback guards та чесне повідомлення про втрату File після full redirect.
- Реальні iOS/Android пристрої, їхні екранні клавіатури та системні safe-area не перевірені; viewport emulation цього не доводить.
- Окремого screen-reader walkthrough і вимірювання FPS на слабкому пристрої не проведено. Keyboard, ARIA/focus/inert і відсутність React rerender на scroll перевірені функціонально.
- У локальному preview немає live production-каталогу. Реальний stream/persistence перевірено з ізольованими тестовими записами; production recordings не змінювались.
- Production domain, зовнішній CDN/cache, VPS routing і live OAuth integration не можуть отримати статус PASS з локальних Docker/E2E результатів. Deployment не дозволявся і не виконувався.

[runner]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/scripts/run-integration.mjs>
[app]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/src/App.jsx:139>
[landing-layout]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/src/components/layout/LandingLayout.jsx>
[header-source]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/src/components/landing/LandingHeader.jsx>
[listen-source]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/src/components/landing/LandingListenSection.jsx>
[draft-store]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/src/store/landingDraftStore.js>
[test-routing]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/tests/components/PublicRoutingPlayback.test.jsx>
[test-home]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/tests/components/Home.test.jsx>
[test-listen]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/tests/components/LandingListen.test.jsx>
[test-motion]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/tests/components/LandingMotion.test.jsx>
[test-creator]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/tests/components/LandingCreator.test.jsx>
[test-player-storage]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/src/store/__tests__/playerStorage.test.js>
[test-player-nav]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/tests/components/PlayerBarNavigation.test.jsx>
[test-lyrics]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/tests/components/LyricsSystem.test.jsx>
[test-page-meta]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/src/components/meta/__tests__/PageMeta.test.jsx>
[test-http]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/backend/tests/landingPages.unit.test.js>
[test-showcase]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/backend/tests/landingShowcase.unit.test.js>
[test-oauth]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/backend/tests/googleOAuth.unit.test.js>
[e2e-landing]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/tests/e2e/landing.spec.js>
[e2e-creator]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/tests/e2e/landing-creator.spec.js>
[e2e-home]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/tests/e2e/home.spec.js>
[e2e-summary]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/test-results/integration/e2e-summary.json>
[all-summary]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/test-results/integration/all-summary.json>
[preview-summary]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/test-results/integration/preview-summary.json>

[final-log]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/artifacts/landing/final-all.log>
[docker-summary]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/artifacts/landing/production-http/summary.json>
[original-checkout]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/artifacts/landing/original-checkout-verification.json>
[design-qa]: </Users/maksymmikolenko/MyProjects/NoirSound/NoirSound Landing Integration/design-qa.md>
