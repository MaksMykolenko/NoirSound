# Підключення імпорту плейлистів NoirSound

Перевірено за офіційною документацією 16 жовтня 2026 року.

Імпортер переносить список композицій і пропонує відповідники з каталогу NoirSound та Audius. Після підтвердження він створює приватний плейлист. Максимум — 200 позицій за раз; відсутні записи можна пропустити. Аудіофайли зі Spotify, YouTube і SoundCloud не завантажуються. Оригінальний плейлист залишається без змін.

## YouTube

1. Відкрий [Google Cloud Console](https://console.cloud.google.com/) і створи проєкт, наприклад `NoirSound playlist import`.
2. У **APIs & Services → Library** знайди **YouTube Data API v3** і натисни **Enable**.
3. У **APIs & Services → Credentials → Create credentials → API key** створи ключ.
4. У налаштуваннях ключа вибери **API restrictions → Restrict key → YouTube Data API v3** і збережи. Для додаткового обмеження за IP використовуй перевірені вихідні адреси сервера, а не обмеження за браузерним доменом: запити робить бекенд.
5. Додай ключ як `YOUTUBE_API_KEY` у серверний файл нижче.

Ця реалізація працює з публічними плейлистами за посиланням `https://www.youtube.com/playlist?list=...`. OAuth-застосунок для неї не потрібний. Приватні плейлисти не підтримуються, видалені та приватні відео пропускаються. Назва каналу не завжди є виконавцем, тому збіги потрібно перевіряти вручну. [Офіційна інструкція Google](https://developers.google.com/youtube/registering_an_application).

## Spotify

Власник застосунку повинен мати активний **Spotify Premium**. Development Mode дозволяє до п’яти авторизованих користувачів із дозволеного списку; для ширшого запуску потрібний інший режим доступу Spotify. [Поточні умови Development Mode](https://developer.spotify.com/documentation/web-api/concepts/quota-modes).

1. Увійди в [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) і вибери **Create app**.
2. Вкажи назву `NoirSound Playlist Import`, сайт `https://noirsound.co` та правдивий опис, наприклад: `User-requested playlist metadata transfer to NoirSound, with manual catalog matching. No Spotify audio playback or downloading.` Якщо є вибір API, вибери **Web API**.
3. Додай **Redirect URI** точно в такому вигляді, без завершального `/`:

   ```text
   https://noirsound.co/api/playlist-import/spotify/callback
   ```

4. Збережи налаштування. У керуванні доступом застосунку додай Spotify-акаунти тестувальників до дозволеного списку.
5. Скопіюй **Client ID** у `SPOTIFY_CLIENT_ID`. Для реалізованого PKCE-підключення **Client Secret не потрібний**. [Створення застосунку](https://developer.spotify.com/documentation/web-api/concepts/apps), [PKCE](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow).
6. Після застосування налаштувань відкрий **Бібліотека → Імпорт плейлиста → Підключити Spotify** у NoirSound. Підтвердь читання плейлистів і встав повне посилання `https://open.spotify.com/playlist/...`.

Поточний endpoint Spotify дозволяє читати вміст плейлиста його власнику або співавтору. Довільний чужий публічний плейлист може повернути `403`. [Обмеження Get Playlist Items](https://developer.spotify.com/documentation/web-api/reference/get-playlists-items).

З’єднання в NoirSound діє до 15 хвилин, після чого його можна повторити. Запитуються лише `playlist-read-private` та `playlist-read-collaborative`; права на редагування Spotify не запитуються.

## SoundCloud

Для реєстрації API-застосунку SoundCloud зараз вимагає **Artist Pro**. [Офіційна інструкція отримання ключів](https://developers.soundcloud.com/docs/api/register-app).

1. Увійди в [SoundCloud Your Apps](https://soundcloud.com/you/apps) з акаунтом, який має доступ до реєстрації застосунків.
2. Створи застосунок з назвою `NoirSound Playlist Import`, сайтом `https://noirsound.co` і описом перенесення метаданих публічних плейлистів на запит користувача.
3. Скопіюй **Client ID** та **Client Secret** у `SOUNDCLOUD_CLIENT_ID` і `SOUNDCLOUD_CLIENT_SECRET`.
4. Після застосування налаштувань встав у NoirSound повне посилання `https://soundcloud.com/username/sets/playlist-name`.

Використовується серверний Client Credentials flow для публічних наборів треків. Авторизація слухача та OAuth callback у цьому імпортері SoundCloud не використовуються. Приватні набори й короткі share-посилання не підтримуються. Для записів, де API повертає лише ім’я завантажувача, NoirSound просить вручну вибрати відповідник.

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

Можна підключати сервіси по одному; для непідключених залиш змінні порожніми. Збережи наявні інші параметри. Ключі мають залишатися на сервері: не додавай їх до Git, змінних `VITE_` або повідомлень у чаті.

Зміна файлу не оновлює оточення вже запущеного контейнера. Застосовуй її звичайним workflow **Deploy to Hostinger VPS** для перевіреної release-гілки, із запущеним на Mac offsite-агентом, як описано в [інструкції розгортання](external-catalog-beta.md#ci-and-existing-user-device-offsite-transport). Workflow повторно перевіряє код і резервну копію та перестворює застосунок з новим оточенням. Звичайний `docker restart` нові змінні не підхопить.

Після розгортання увійди в NoirSound і відкрий **Бібліотека → Імпорт плейлиста**. Підключений сервіс стане доступним. Спочатку перевір невеликий плейлист: переглянь знайдені відповідники, пропусти відсутні та підтвердь створення. Позначка налаштування показує наявність конфігурації; фактичну придатність ключа підтверджує успішний попередній перегляд.

## Варіант без API-ключів

У цьому ж вікні можна завантажити UTF-8 CSV або TXT до 150 000 байтів (150 кБ) і 200 композицій. Наприклад:

```csv
title,artist,duration
Назва композиції,Виконавець,213
```

`duration` — секунди; також підтримується `3:33`. Підходять колонки експорту `Track Name`, `Artist Name(s)`, `Duration (ms)`. Для TXT використовуй по одному запису `Виконавець — Назва композиції` на рядок. Для списку без тривалості потрібний ручний вибір збігів. Імпорт не гарантує наявності кожної пісні в доступному каталозі.

Якщо сервіс повідомляє про відсутність доступу, перевір дозволений список Spotify, власника плейлиста та його видимість. Якщо вичерпано квоту, повтори пізніше; багаторазове натискання не збільшує доступну квоту. Для `redirect_uri` звір точну адресу з прикладом вище.
