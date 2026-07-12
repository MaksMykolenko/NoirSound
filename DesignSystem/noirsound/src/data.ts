/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Artist, Track, Playlist, Comment, PlatformUser, AuditLog } from './types';

export const mockArtists: Artist[] = [
  {
    id: 'art-1',
    name: 'Силует',
    handle: '@siluet_band',
    avatarUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&auto=format&fit=crop&q=80',
    bio: 'Київський пост-панк та колдвейв проект. Темні басові лінії, аналогові синтезатори та відверта лірика про урбаністичну самотність і нічні вулиці столиці.',
    followersCount: 14205,
    verified: true,
    socialLinks: [
      { platform: 'Instagram', url: 'https://instagram.com/siluet' },
      { platform: 'Bandcamp', url: 'https://siluet.bandcamp.com' },
      { platform: 'SoundCloud', url: 'https://soundcloud.com/siluet' }
    ]
  },
  {
    id: 'art-2',
    name: 'Касета',
    handle: '@kaseta_lofi',
    avatarUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80',
    bio: 'Львівський електронний продюсер. Поєднує естетику лоу-фай хаусу, глибокого ембієнту та теплих аналогових касетних шумів з відгомонами української естради 70-х.',
    followersCount: 8940,
    verified: true,
    socialLinks: [
      { platform: 'Instagram', url: 'https://instagram.com/kaseta' },
      { platform: 'Telegram', url: 'https://t.me/kaseta_music' },
      { platform: 'Bandcamp', url: 'https://kaseta.bandcamp.com' }
    ]
  },
  {
    id: 'art-3',
    name: 'Світлотінь',
    handle: '@svitlotin',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80',
    bio: 'Дніпровський дует акустичного неофолку та дарк-фолку. Меланхолійний жіночий вокал, дрим-поп гітари та глибока містична атмосфера прадавніх лісів.',
    followersCount: 6120,
    verified: false,
    socialLinks: [
      { platform: 'Instagram', url: 'https://instagram.com/svitlotin' },
      { platform: 'SoundCloud', url: 'https://soundcloud.com/svitlotin' }
    ]
  },
  {
    id: 'art-4',
    name: 'Океан Смутку',
    handle: '@ocean_smutku',
    avatarUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1487180142328-0c4e37023af5?w=1200&auto=format&fit=crop&q=80',
    bio: 'Одеський шугейз / дрім-поп колектив. Стіна перевантаженого звуку, занурена в реверберацію, шепіт та морські тумани.',
    followersCount: 11050,
    verified: true,
    socialLinks: [
      { platform: 'Instagram', url: 'https://instagram.com/oceansmutku' },
      { platform: 'Twitter', url: 'https://twitter.com/oceansmutku' }
    ]
  }
];

export const mockTracks: Track[] = [
  {
    id: 'tr-1',
    title: 'Тіні в тумані',
    artistId: 'art-1',
    artistName: 'Силует',
    coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&auto=format&fit=crop&q=80',
    duration: '3:45',
    seconds: 225,
    streamCount: 142980,
    likeCount: 5410,
    commentsCount: 42,
    releaseDate: '2026-02-12',
    genre: 'Пост-панк / Колдвейв',
    description: 'Головний сингл з майбутнього однойменного міні-альбому. Записано на напівзакинутому складі в передмісті Києва холодного листопада.',
    tags: ['Пост-панк', 'Колдвейв', 'Інді-музика', 'Нічний Київ', 'Аналог'],
    lyrics: [
      'Тіні блукають у густому тумані',
      'Наші серця розбиті й сонні',
      'Місто мовчить, ліхтарі засинають',
      'Мить промине — нас тут більше немає.',
      '',
      'Тільки звук кроків по мокрому бруку',
      'Простягни мені свою втомлену руку',
      'Темрява знову ховає обличчя',
      'Ця довга ніч закликає у вічність.',
      '',
      'Ми шукаємо світло в згаслих вікнах',
      'Серед бетону і мокрих афіш',
      'Холодний вітер шепоче нам стиха:',
      'Ти вже ніколи сюди не прийдеш.',
      '',
      'Тіні зникають під ранок у димі',
      'Ми залишаємось вічно чужими.'
    ]
  },
  {
    id: 'tr-2',
    title: 'Останній трамвай',
    artistId: 'art-1',
    artistName: 'Силует',
    coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop&q=80',
    duration: '4:12',
    seconds: 252,
    streamCount: 98110,
    likeCount: 3890,
    commentsCount: 29,
    releaseDate: '2026-03-20',
    genre: 'Пост-панк',
    description: 'Енергійна та водночас тужлива композиція про останній нічний рейс міського транспорту, що забирає залишки надій.',
    tags: ['Пост-панк', 'Українська готика', 'Драм-машина', 'Лобове скло'],
    lyrics: [
      'Останні іскри на рейках синіх',
      'Ми їдемо в нікуди у кабіні пустій',
      'За вікнами миготять нічні магазини',
      'Кондуктор заснув, зажурений і німий.',
      '',
      'Останній трамвай, зачекай хоч хвилину',
      'Дай мені шанс повернути тепло',
      'Я бачу в дзеркалах далеку картину',
      'Там де нас двоє ще колись було.',
      '',
      'Дроти гудуть від втоми і напруги',
      'Шофер веде свій примарний корабель',
      'Немає більше ні болю, ні туги',
      'Тільки маршрути невідомих земель.'
    ]
  },
  {
    id: 'tr-3',
    title: 'Реверберація спогадів',
    artistId: 'art-2',
    artistName: 'Касета',
    coverUrl: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=500&auto=format&fit=crop&q=80',
    duration: '5:20',
    seconds: 320,
    streamCount: 65430,
    likeCount: 2950,
    commentsCount: 18,
    releaseDate: '2026-01-05',
    genre: 'Лоу-фай Хаус / Ембієнт',
    description: 'Глибоке занурення в аналогову ностальгію з використанням записаних на старий мікрофон вуличних шумів Львова.',
    tags: ['Лоу-фай', 'Хаус', 'Теплий звук', 'Електроніка', 'Ембієнт'],
    lyrics: [
      'Час уповільнює свій нескінченний біг',
      'Знову згадаю все те, що зберегти не зміг.',
      'Ехо лунає у порожній кімнаті',
      'Ми знову разом на старій касетній платі.',
      '',
      'Шум магнітної стрічки, тепло ламп',
      'Залишився тільки цей повільний темп.',
      'Реверберація повертає слова',
      'Хоч історія наша давно не жива.',
      '',
      '(Інструментальний програш - теплий саб-бас та касетний аналоговий шум)'
    ]
  },
  {
    id: 'tr-4',
    title: 'Нічний Рейс',
    artistId: 'art-2',
    artistName: 'Касета',
    coverUrl: 'https://images.unsplash.com/photo-1486591978090-58e619d37fe7?w=500&auto=format&fit=crop&q=80',
    duration: '4:40',
    seconds: 280,
    streamCount: 43210,
    likeCount: 1720,
    commentsCount: 12,
    releaseDate: '2026-05-14',
    genre: 'Дип Хаус',
    description: 'Ритмічний нічний трек для затишних поїздок за кермом порожнім шосе.',
    tags: ['Хаус', 'Нічний рейс', 'Меланхолійний біт', 'Синтезатор'],
    lyrics: [
      'Фари малюють лінії на асфальті',
      'Твій голос звучить на низькій частоті',
      'Ми розчиняємось у цьому просторі й такті',
      'Шукаємо відповіді десь на самоті.',
      '',
      'Нічний рейс, дорога без кінця',
      'Відпускаємо контроль, забуваємо серця',
      'Тільки бас тримає нас докупи',
      'В обіймах темряви та електронної звуки.'
    ]
  },
  {
    id: 'tr-5',
    title: 'Голос вітру',
    artistId: 'art-3',
    artistName: 'Світлотінь',
    coverUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=500&auto=format&fit=crop&q=80',
    duration: '3:15',
    seconds: 195,
    streamCount: 31200,
    likeCount: 1540,
    commentsCount: 22,
    releaseDate: '2026-04-02',
    genre: 'Дарк-фолк',
    description: 'Повністю акустичний запис, зроблений в дерев\'яному котеджі в Карпатах під час зливи. Природні звуки грому залишено на фоні.',
    tags: ['Фолк', 'Акустика', 'Карпати', 'Атмосферно', 'Дарк-фолк'],
    lyrics: [
      'Голос вітру шепоче старі заклики',
      'Травами сухими заросли всі шляхи',
      'Хто покличе мене у глибокий яр?',
      'Хто розсіє над річкою чорний пар?',
      '',
      'Спи, моя земле, закрий свої очі',
      'Я співатиму тобі до самої ночі',
      'Прохолодна вода змиє сліди бід',
      'Завтра народиться новий світлий схід.',
      '',
      'Тільки місяць холодний світить з небес',
      'Охороняє мій тихий, забутий престол.'
    ]
  },
  {
    id: 'tr-6',
    title: 'Холодний дощ',
    artistId: 'art-4',
    artistName: 'Океан Смутку',
    coverUrl: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=500&auto=format&fit=crop&q=80',
    duration: '6:05',
    seconds: 365,
    streamCount: 112450,
    likeCount: 6120,
    commentsCount: 51,
    releaseDate: '2025-10-30',
    genre: 'Шугейз / Дрім-поп',
    description: 'Епічний шугейз трек із стіною дисторшну, що огортає слухача теплою ковдрою шуму.',
    tags: ['Шугейз', 'Дрім-поп', 'Гітарний шум', 'Стіна звуку', 'Одеса'],
    lyrics: [
      'Холодний дощ падає на море',
      'Ми дивимось вниз із крутих скель',
      'Забудь про все, що приносило горе',
      'Ми тонемо в шумі цих хвиль.',
      '',
      'Закрий очі, не бійся грози',
      'Цей гітарний гул врятує від сліз',
      'Розчиняємось у білому світлі смуги',
      'Назавжди лишаємось серед завіс.'
    ]
  }
];

export const mockPlaylists: Playlist[] = [
  {
    id: 'pl-1',
    name: 'Український Андеграунд: Початок',
    description: 'Найкращий вітчизняний колдвейв, пост-панк та експериментальний лоу-фай для довгих прогулянок містом.',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80',
    trackCount: 4,
    tracks: ['tr-1', 'tr-2', 'tr-3', 'tr-5']
  },
  {
    id: 'pl-2',
    name: 'Нічні Автостради',
    description: 'Лоу-фай хаус та глибока електроніка для нічних рейсів та усамітнення за кермом.',
    coverUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&auto=format&fit=crop&q=80',
    trackCount: 3,
    tracks: ['tr-3', 'tr-4', 'tr-1']
  },
  {
    id: 'pl-3',
    name: 'Шум та Меланхолія',
    description: 'Стіни гітарного шуму, дрім-поп та затишна осіння меланхолія біля моря.',
    coverUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop&q=80',
    trackCount: 3,
    tracks: ['tr-6', 'tr-1', 'tr-5']
  }
];

export const mockComments: Comment[] = [
  {
    id: 'c-1',
    trackId: 'tr-1',
    userName: 'Микола П.',
    userAvatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
    content: 'Цей бас буквально вібрує в моїй душі. Найкращий пост-панк реліз в Україні за останні роки!',
    timestamp: '2 години тому',
    likes: 24
  },
  {
    id: 'c-2',
    trackId: 'tr-1',
    userName: 'Софія Чорна',
    userAvatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
    content: 'Ідеальна атмосфера для нічної прогулянки Подолом. Дякую за цю щирість.',
    timestamp: '1 день тому',
    likes: 45
  },
  {
    id: 'c-3',
    trackId: 'tr-1',
    userName: 'Влад Реверб',
    userAvatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
    content: 'Текст пісні розриває на шматки. Чекаю повноформатний альбом!',
    timestamp: '3 дні тому',
    likes: 12
  },
  {
    id: 'c-4',
    trackId: 'tr-3',
    userName: 'Антон Саунд',
    userAvatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80',
    content: 'Цей касетний шум просто заворожує. Наче повернувся на 25 років назад у дитинство.',
    timestamp: '5 годин тому',
    likes: 8
  },
  {
    id: 'c-5',
    trackId: 'tr-6',
    userName: 'Ксенія М.',
    userAvatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&auto=format&fit=crop&q=80',
    content: 'Ця стіна звуку в кінці... Мене просто розчинило. Неймовірний шугейз світового рівня.',
    timestamp: '12 годин тому',
    likes: 31
  }
];

export const mockUsers: PlatformUser[] = [
  {
    id: 'usr-1',
    name: 'Арсеній Силует',
    email: 'siluet.band@noirsound.com',
    role: 'Creator',
    joinedDate: '2025-08-15',
    avatarUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=80',
    status: 'Активний'
  },
  {
    id: 'usr-2',
    name: 'Катерина Касета',
    email: 'kaseta@noirsound.com',
    role: 'Creator',
    joinedDate: '2025-09-01',
    avatarUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=100&auto=format&fit=crop&q=80',
    status: 'Активний'
  },
  {
    id: 'usr-3',
    name: 'Максим Міколенко',
    email: 'mikolenkomaksim11@gmail.com',
    role: 'Admin',
    joinedDate: '2025-01-01',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80',
    status: 'Активний'
  },
  {
    id: 'usr-4',
    name: 'Олексій Постпанк',
    email: 'postpunk_fan@ukr.net',
    role: 'Listener',
    joinedDate: '2026-01-10',
    avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&auto=format&fit=crop&q=80',
    status: 'Активний'
  },
  {
    id: 'usr-5',
    name: 'Дмитро Злий',
    email: 'spammer999@mail.com',
    role: 'Listener',
    joinedDate: '2026-05-20',
    avatarUrl: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=100&auto=format&fit=crop&q=80',
    status: 'Тимчасово заблокований'
  }
];

export const mockAuditLogs: AuditLog[] = [
  {
    id: 'log-1',
    action: 'Затвердження треку',
    target: 'Силует - Останній трамвай',
    actor: 'Максим Міколенко',
    timestamp: '2026-07-08 11:24',
    status: 'success'
  },
  {
    id: 'log-2',
    action: 'Блокування користувача',
    target: 'Дмитро Злий (Спам у коментарях)',
    actor: 'Максим Міколенко',
    timestamp: '2026-07-08 09:15',
    status: 'warning'
  },
  {
    id: 'log-3',
    action: 'Видалення коментаря',
    target: 'ID коментаря: #c-9182',
    actor: 'Максим Міколенко',
    timestamp: '2026-07-07 18:42',
    status: 'success'
  },
  {
    id: 'log-4',
    action: 'Зміна статусу системи',
    target: 'Оновлення правил модерації',
    actor: 'Максим Міколенко',
    timestamp: '2026-07-06 14:00',
    status: 'success'
  }
];
