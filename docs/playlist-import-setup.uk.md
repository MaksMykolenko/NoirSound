# Підключення імпорту плейлистів NoirSound

Перевірено за офіційною документацією 16 жовтня 2026 року.

Імпортер зберігає повний список композицій у приватному плейлисті NoirSound зі збереженням порядку й повторів. Підтримуються до 1000 позицій, зокрема плейлист із 717 треків. Відповідники у власному каталозі не потрібні. Недоступні записи залишаються позначеними; завеликі або неповністю отримані плейлисти не зберігаються частково. Оригінальний плейлист залишається без змін.

Усі треки керуються звичайною нижньою панеллю NoirSound. Плаваючі віджети, Spotify Embed і вибір YouTube-версій видалено. Збережені `youtubeId` попереднього варіанта більше не використовуються; список і порядок імпорту не змінюються.

Для Spotify використовується офіційний **Web Playback SDK** як аудіодвигун під кнопками NoirSound. Потрібні Spotify Premium, дозволений акаунт застосунку в Development Mode і окреме OAuth-підключення для відтворення. Кнопка **Підключити Spotify для відтворення** розташована у приватному імпортованому плейлисті. Пауза, перемотування, гучність, черга, повтор і перехід між позиціями працюють через наявну панель. Недоступні у Spotify позиції залишаються у списку, але не видаються за доступне аудіо.

SDK-токен передається лише авторизованому браузеру через `no-store` endpoint. Refresh token залишається в зашифрованому HttpOnly cookie, прив’язаному до сесії NoirSound. Підключення обмежене вісьмома годинами; оновлення токена не продовжує цей строк. Вихід з акаунта або вибір іншого джерела відключає SDK. Spotify-аудіо не завантажується в кеш NoirSound і не збільшує лічильники власного каталогу. Для комерційного використання SDK Spotify вимагає попереднє письмове схвалення; поточна перевірка стосується дозволеного тестового акаунта. [Вимоги SDK](https://developer.spotify.com/documentation/web-playback-sdk).

Для імпорту YouTube і SoundCloud плеєр перевіряє точний відповідник за назвою та виконавцем у доступному власному каталозі. Якщо повного аудіопотоку немає, показується повідомлення про недоступність; сторонні віджети та приховане аудіо з YouTube не запускаються. Сам імпорт метаданих не надає аудіофайл.

## YouTube

1. Відкрий [Google Cloud Console](https://console.cloud.google.com/) і створи проєкт, наприклад `NoirSound playlist import`.
2. У **APIs & Services → Library** знайди **YouTube Data API v3** і натисни **Enable**.
3. У **APIs & Services → Credentials → Create credentials → API key** створи ключ.
4. У налаштуваннях ключа вибери **API restrictions → Restrict key → YouTube Data API v3** і збережи. Для додаткового обмеження за IP використовуй перевірені вихідні адреси сервера, а не обмеження за браузерним доменом: запити робить бекенд.
5. Додай ключ як `YOUTUBE_API_KEY` у серверний файл нижче.

Ця реалізація працює з публічними плейлистами за посиланням `https://www.youtube.com/playlist?list=...`. OAuth-застосунок для неї не потрібний. Приватні плейлисти не підтримуються; видалені та приватні відео зберігаються як недоступні позиції. Відтворення залежить також від дозволу власника відео на вбудовування. [Офіційна інструкція Google](https://developers.google.com/youtube/registering_an_application).

## Spotify

Власник застосунку повинен мати активний **Spotify Premium**. Development Mode дозволяє до п’яти авторизованих користувачів із дозволеного списку; для ширшого запуску потрібний інший режим доступу Spotify. [Поточні умови Development Mode](https://developer.spotify.com/documentation/web-api/concepts/quota-modes).

1. Увійди в [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) і вибери **Create app**.
2. Вкажи назву `NoirSound Playlist Import`, сайт `https://noirsound.co` та правдивий опис, наприклад: `User-requested playlist metadata import to NoirSound. Private playback for authorized Spotify Premium testers using the Web Playback SDK and NoirSound controls. No audio downloading.` Якщо є вибір API, вибери **Web API** та **Web Playback SDK**.
3. Додай **Redirect URI** точно в такому вигляді, без завершального `/`:

   ```text
   https://noirsound.co/api/playlist-import/spotify/callback
   ```

4. Збережи налаштування. У керуванні доступом застосунку додай Spotify-акаунти тестувальників до дозволеного списку.
5. Скопіюй **Client ID** у `SPOTIFY_CLIENT_ID`. Для реалізованого PKCE-підключення **Client Secret не потрібний**. [Створення застосунку](https://developer.spotify.com/documentation/web-api/concepts/apps), [PKCE](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow).
6. Після застосування налаштувань відкрий **Бібліотека → Імпорт плейлиста → Підключити Spotify** у NoirSound. Підтвердь читання плейлистів і встав повне посилання `https://open.spotify.com/playlist/...`.

Поточний endpoint Spotify дозволяє читати вміст плейлиста його власнику або співавтору. Довільний чужий публічний плейлист може повернути `403`. [Обмеження Get Playlist Items](https://developer.spotify.com/documentation/web-api/reference/get-playlists-items).

Підключення для імпорту діє до 15 хвилин і запитує `playlist-read-private` та `playlist-read-collaborative`. Окреме підключення для відтворення додає `streaming`, `user-read-email`, `user-read-private`, `user-read-playback-state` та `user-modify-playback-state`. Редагування плейлистів і бібліотеки Spotify не запитується.

## SoundCloud

Для реєстрації API-застосунку SoundCloud зараз вимагає **Artist Pro**. [Офіційна інструкція отримання ключів](https://developers.soundcloud.com/docs/api/register-app).

Форма [створення застосунку](https://soundcloud.com/you/apps/new) окремо зазначає: сервіси перенесення плейлистів або бібліотек потребують **явного схвалення SoundCloud**. Самої підписки Artist Pro або наявності ключів недостатньо для запуску цього імпортера. До отримання дозволу залиш `SOUNDCLOUD_CLIENT_ID` і `SOUNDCLOUD_CLIENT_SECRET` порожніми. В описі заявки прямо вказуй перенесення метаданих плейлистів ; прослуховування можливе лише для доступних аудіоджерел; не описуй цю функцію як інший тип застосунку. [Умови API](https://developers.soundcloud.com/docs/api/terms-of-use).

1. Увійди в [SoundCloud Your Apps](https://soundcloud.com/you/apps) з акаунтом, який має доступ до реєстрації застосунків.
2. Створи застосунок з назвою `NoirSound Playlist Import`, сайтом `https://noirsound.co` і описом перенесення метаданих публічних плейлистів на запит користувача.
3. Після явного схвалення цього сценарію SoundCloud скопіюй **Client ID** та **Client Secret** у `SOUNDCLOUD_CLIENT_ID` і `SOUNDCLOUD_CLIENT_SECRET`.
4. Після застосування налаштувань встав у NoirSound повне посилання `https://soundcloud.com/username/sets/playlist-name`.

Використовується серверний Client Credentials flow для публічних наборів треків. Авторизація слухача та OAuth callback у цьому імпортері SoundCloud не використовуються. Приватні набори й короткі share-посилання не підтримуються. Ім’я завантажувача може відрізнятися від імені виконавця.

## Куди додати налаштування

На VPS вони зберігаються в `/opt/noirsound/NoirSound/.env.production`. Відкрий цей файл у редакторі через SSH:

```sh
ssh -i ~/.ssh/noirsound_hostinger -o IdentitiesOnly=yes root@46.202.143.125
nano /opt/noirsound/NoirSound/.env.production
```

Додай або зміни потрібні змінні. Значення нижче — заповнювачі, їх потрібно замінити власними:

```dotenv
SPOTIFY_CLIENT_ID=YOUR_SPOTIFY_CLIENT_ID
SPOTIFY_REDIRECT_URI=https://noirsound.co/api/playlist-import/spotify/callback
YOUTUBE_API_KEY=YOUR_YOUTUBE_API_KEY
SOUNDCLOUD_CLIENT_ID=YOUR_SOUNDCLOUD_CLIENT_ID
SOUNDCLOUD_CLIENT_SECRET=YOUR_SOUNDCLOUD_CLIENT_SECRET
```

Підтримуються лише Spotify, YouTube та SoundCloud; імпорт CSV/TXT прибрано. Можна підключати сервіси по одному; для непідключених залиш змінні порожніми. Збережи наявні інші параметри. Ключі мають залишатися на сервері: не додавай їх до Git, змінних `VITE_` або повідомлень у чаті.

Зміна файлу не оновлює оточення вже запущеного контейнера. Застосовуй її звичайним workflow **Deploy to Hostinger VPS** для перевіреної release-гілки, із запущеним на Mac offsite-агентом, як описано в [інструкції розгортання](external-catalog-beta.md#ci-and-existing-user-device-offsite-transport). Workflow повторно перевіряє код і резервну копію та перестворює застосунок з новим оточенням. Звичайний `docker restart` нові змінні не підхопить.

Після розгортання увійди в NoirSound і відкрий **Бібліотека → Імпорт плейлиста**. Підключений сервіс стане доступним. Встав посилання, перевір кількість завантажених позицій і підтвердь створення. Довгі списки показуються по 50 позицій на сторінці. Позначка налаштування показує наявність конфігурації; фактичну придатність ключа підтверджує успішний попередній перегляд.

Якщо сервіс повідомляє про відсутність доступу, перевір дозволений список Spotify, власника плейлиста та його видимість. Якщо вичерпано квоту, повтори пізніше; багаторазове натискання не збільшує доступну квоту. Для `redirect_uri` звір точну адресу з прикладом вище.
