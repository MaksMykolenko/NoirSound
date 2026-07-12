/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  Users, Music, User, MessageSquare, AlertCircle, ShieldCheck, 
  Settings, Trash, BarChart2, CheckCircle, Ban, ArrowUpRight, Search 
} from 'lucide-react';
import { useState } from 'react';
import { PlatformUser, Track, Artist, Comment, AuditLog, UploadItem } from '../types';

interface AdminViewProps {
  users: PlatformUser[];
  onToggleUserStatus: (id: string) => void;
  tracks: Track[];
  onDeleteTrack: (id: string) => void;
  artists: Artist[];
  comments: Comment[];
  onDeleteComment: (id: string) => void;
  auditLogs: AuditLog[];
  uploadedItems: UploadItem[];
}

type AdminSubTab = 
  | 'overview' 
  | 'users' 
  | 'tracks' 
  | 'artists' 
  | 'comments' 
  | 'logs' 
  | 'statistics' 
  | 'settings';

export default function AdminView({
  users,
  onToggleUserStatus,
  tracks,
  onDeleteTrack,
  artists,
  comments,
  onDeleteComment,
  auditLogs,
  uploadedItems,
}: AdminViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<AdminSubTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');

  // Total metrics
  const totalStreams = tracks.reduce((sum, t) => sum + t.streamCount, 0);
  const totalLikes = tracks.reduce((sum, t) => sum + t.likeCount, 0);

  const subMenuItems = [
    { id: 'overview' as AdminSubTab, label: 'Загальний огляд', icon: BarChart2 },
    { id: 'users' as AdminSubTab, label: 'Користувачі', icon: Users, badge: users.length },
    { id: 'tracks' as AdminSubTab, label: 'Композиції', icon: Music, badge: tracks.length },
    { id: 'artists' as AdminSubTab, label: 'Митці', icon: User, badge: artists.length },
    { id: 'comments' as AdminSubTab, label: 'Коментарі', icon: MessageSquare, badge: comments.length },
    { id: 'logs' as AdminSubTab, label: 'Журнал аудиту', icon: ShieldCheck },
    { id: 'statistics' as AdminSubTab, label: 'Цілісність даних', icon: AlertCircle },
    { id: 'settings' as AdminSubTab, label: 'Система', icon: Settings },
  ];

  return (
    <div className="flex-1 min-h-screen pb-32 pt-6 px-8 max-w-5xl mx-auto flex flex-col md:flex-row gap-8">
      {/* Inner Admin Sidebar */}
      <div className="w-full md:w-56 flex-shrink-0">
        <div className="sticky top-6 space-y-5">
          <div>
            <h1 className="font-display font-bold text-xl tracking-tight text-white">Адмін-панель</h1>
            <p className="text-[10px] text-zinc-500 font-mono mt-1 uppercase">Консоль NoirSound</p>
          </div>

          <nav className="space-y-1">
            {subMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSubTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSubTab(item.id);
                    setSearchQuery('');
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-zinc-900 text-white'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-brand' : 'text-zinc-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className="text-[9px] font-mono bg-zinc-850 px-1.5 py-0.5 rounded text-zinc-500 border border-white/[0.01]">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Admin Content Block */}
      <div className="flex-1 min-w-0">
        
        {/* TAB: OVERVIEW */}
        {activeSubTab === 'overview' && (
          <div className="space-y-8 animate-fadeIn">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">Панель показників</h2>
              <p className="text-xs text-zinc-500 mt-1">Огляд активності платформи NoirSound</p>
            </div>

            {/* Micro bento indicators */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-[#111115]/30 border border-white/[0.03] rounded-sm">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Слухачі</span>
                <p className="text-xl font-display font-bold text-white mt-1">{(1420).toLocaleString()}</p>
                <span className="text-[9px] font-mono text-emerald-500 flex items-center gap-0.5 mt-1.5">
                  <ArrowUpRight className="w-2.5 h-2.5" /> +12.4% за тиждень
                </span>
              </div>
              <div className="p-4 bg-[#111115]/30 border border-white/[0.03] rounded-sm">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Стріми треків</span>
                <p className="text-xl font-display font-bold text-white mt-1">{totalStreams.toLocaleString()}</p>
                <span className="text-[9px] font-mono text-emerald-500 flex items-center gap-0.5 mt-1.5">
                  <ArrowUpRight className="w-2.5 h-2.5" /> +8.1% за тиждень
                </span>
              </div>
              <div className="p-4 bg-[#111115]/30 border border-white/[0.03] rounded-sm">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Оцінки (лайки)</span>
                <p className="text-xl font-display font-bold text-white mt-1">{totalLikes.toLocaleString()}</p>
                <span className="text-[9px] font-mono text-zinc-500 mt-1.5 block">Загальна симпатія</span>
              </div>
              <div className="p-4 bg-[#111115]/30 border border-white/[0.03] rounded-sm">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">На модерації</span>
                <p className="text-xl font-display font-bold text-brand mt-1">
                  {uploadedItems.filter(i => i.status !== 'publish').length}
                </p>
                <span className="text-[9px] font-mono text-zinc-500 mt-1.5 block">Нові завантаження</span>
              </div>
            </div>

            {/* Quick Upload Pipeline Summary */}
            <div className="bg-[#111115]/20 border border-white/[0.03] p-5 rounded-sm">
              <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-3">Черга обробки релізів</h3>
              
              <div className="space-y-2">
                {uploadedItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-xs p-3.5 bg-zinc-950/40 rounded border border-white/[0.01]">
                    <div>
                      <span className="font-semibold text-zinc-200">{item.title}</span>
                      <span className="text-[10px] font-mono text-zinc-500 ml-2">({item.genre})</span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-mono text-zinc-400">
                        {item.status === 'publish' ? 'Перевірено' : `Обробка: ${item.progress}%`}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${item.status === 'publish' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                    </div>
                  </div>
                ))}
                {uploadedItems.length === 0 && (
                  <p className="text-xs text-zinc-500 py-2">Наразі немає активних завантажень у черзі.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: USERS */}
        {activeSubTab === 'users' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-200">Керування користувачами</h2>
                <p className="text-xs text-zinc-500 mt-1">Клієнти, митці та модератори платформи</p>
              </div>
            </div>

            {/* Users Table */}
            <div className="border border-white/[0.03] bg-zinc-950/20 rounded-md overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.04] bg-[#111115]/60 text-zinc-400 font-mono text-[10px]">
                    <th className="p-4 font-normal">Користувач</th>
                    <th className="p-4 font-normal">Електронна пошта</th>
                    <th className="p-4 font-normal">Роль</th>
                    <th className="p-4 font-normal">Статус</th>
                    <th className="p-4 font-normal text-right">Дія</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <img src={user.avatarUrl} alt={user.name} className="w-7 h-7 rounded-full object-cover border border-white/[0.05]" />
                          <span className="font-medium text-white">{user.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-zinc-400 font-mono">{user.email}</td>
                      <td className="p-4">
                        <span className="bg-zinc-900 text-zinc-400 px-2 py-0.5 rounded text-[10px] border border-white/[0.02]">
                          {user.role}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 border px-2 py-0.5 rounded text-[10px] font-medium ${
                          user.status === 'Активний' 
                            ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' 
                            : 'bg-rose-500/5 border-rose-500/20 text-rose-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'Активний' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {user.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => onToggleUserStatus(user.id)}
                          className="text-[10px] font-mono text-zinc-400 hover:text-white bg-zinc-900 px-2 py-1 rounded border border-white/[0.04] transition-all cursor-pointer"
                        >
                          {user.status === 'Активний' ? 'Блокувати' : 'Активувати'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: TRACKS */}
        {activeSubTab === 'tracks' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">Каталог треків</h2>
              <p className="text-xs text-zinc-500 mt-1">Огляд та модерація завантажених композицій</p>
            </div>

            <div className="border border-white/[0.03] bg-zinc-950/20 rounded-md overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.04] bg-[#111115]/60 text-zinc-400 font-mono text-[10px]">
                    <th className="p-4 font-normal">Трек</th>
                    <th className="p-4 font-normal">Жанр</th>
                    <th className="p-4 font-normal">Прослуховування</th>
                    <th className="p-4 font-normal">Реліз</th>
                    <th className="p-4 font-normal text-right">Модерація</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {tracks.map((track) => (
                    <tr key={track.id} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img src={track.coverUrl} alt={track.title} className="w-8 h-8 rounded object-cover border border-white/[0.05]" />
                          <div>
                            <p className="font-semibold text-white">{track.title}</p>
                            <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{track.artistName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-zinc-400">{track.genre}</span>
                      </td>
                      <td className="p-4 text-zinc-400 font-mono">{track.streamCount.toLocaleString()}</td>
                      <td className="p-4 text-zinc-500 font-mono">{track.releaseDate}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => onDeleteTrack(track.id)}
                          className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-500/10 transition-all cursor-pointer"
                          title="Видалити трек"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: ARTISTS */}
        {activeSubTab === 'artists' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">Кабінет виконавців</h2>
              <p className="text-xs text-zinc-500 mt-1">Перевірка статусів та керування підписками авторів</p>
            </div>

            <div className="border border-white/[0.03] bg-zinc-950/20 rounded-md overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.04] bg-[#111115]/60 text-zinc-400 font-mono text-[10px]">
                    <th className="p-4 font-normal">Виконавець</th>
                    <th className="p-4 font-normal">Юзернейм</th>
                    <th className="p-4 font-normal">Підписники</th>
                    <th className="p-4 font-normal">Верифікація</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {artists.map((artist) => (
                    <tr key={artist.id} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <img src={artist.avatarUrl} alt={artist.name} className="w-7 h-7 rounded-full object-cover border border-white/[0.05]" />
                          <span className="font-medium text-white">{artist.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-zinc-400 font-mono">{artist.handle}</td>
                      <td className="p-4 text-zinc-400 font-mono">{artist.followersCount.toLocaleString()}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border ${
                          artist.verified 
                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                            : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                        }`}>
                          {artist.verified ? 'Офіційний' : 'Базовий'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: COMMENTS */}
        {activeSubTab === 'comments' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">Модерація коментарів</h2>
              <p className="text-xs text-zinc-500 mt-1">Останні коментарі та скарги від слухачів</p>
            </div>

            <div className="space-y-3">
              {comments.map((comment) => (
                <div 
                  key={comment.id}
                  className="p-4 bg-zinc-950/40 border border-white/[0.02] rounded-sm flex items-start justify-between gap-4"
                >
                  <div className="flex gap-3">
                    <img src={comment.userAvatarUrl} alt={comment.userName} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                    <div>
                      <div className="flex items-center gap-2 text-[10px] font-mono">
                        <span className="font-semibold text-white">{comment.userName}</span>
                        <span className="text-zinc-600">•</span>
                        <span className="text-zinc-500">{comment.timestamp}</span>
                      </div>
                      <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed font-sans">{comment.content}</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => onDeleteComment(comment.id)}
                    className="text-zinc-500 hover:text-rose-400 p-1.5 rounded hover:bg-rose-500/10 transition-all cursor-pointer flex-shrink-0"
                    title="Видалити коментар"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-xs text-zinc-500 text-center py-12">Коментарі відсутні.</p>
              )}
            </div>
          </div>
        )}

        {/* TAB: LOGS */}
        {activeSubTab === 'logs' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">Журнал аудиту системи</h2>
              <p className="text-xs text-zinc-500 mt-1">Усі адміністративні та автоматичні дії у системі</p>
            </div>

            <div className="border border-white/[0.03] bg-zinc-950/20 rounded-md overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.04] bg-[#111115]/60 text-zinc-400 font-mono text-[10px]">
                    <th className="p-4 font-normal">Час</th>
                    <th className="p-4 font-normal">Дія</th>
                    <th className="p-4 font-normal">Об'єкт</th>
                    <th className="p-4 font-normal">Адміністратор</th>
                    <th className="p-4 font-normal">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02] font-mono text-[11px]">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-900/30">
                      <td className="p-4 text-zinc-500">{log.timestamp}</td>
                      <td className="p-4 text-zinc-300 font-semibold">{log.action}</td>
                      <td className="p-4 text-zinc-400 max-w-[150px] truncate">{log.target}</td>
                      <td className="p-4 text-zinc-500">{log.actor}</td>
                      <td className="p-4">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                          log.status === 'success' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' 
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/10'
                        }`}>
                          {log.status === 'success' ? 'УСПІШНО' : 'ПОПЕРЕДЖЕННЯ'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: STATISTICS INTEGRITY */}
        {activeSubTab === 'statistics' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">Цілісність даних та лічильників</h2>
              <p className="text-xs text-zinc-500 mt-1">Автоматичні звіти та перевірки коректності статистики</p>
            </div>

            <div className="space-y-4">
              <div className="p-5 bg-zinc-950/45 border border-white/[0.02] rounded-sm text-xs space-y-3">
                <div className="flex items-center justify-between text-zinc-300 border-b border-white/[0.03] pb-2">
                  <span className="font-semibold">Тест цілісності лічильників стрімів</span>
                  <span className="text-emerald-400 font-mono font-bold">НОРМА</span>
                </div>
                <p className="text-zinc-400 leading-relaxed font-sans">
                  Перевірка виявила нуль невідповідностей між унікальними сесіями та загальною сумою відтворень у базі даних. Усі унікальні IP-адреси коректно зафіксовані.
                </p>
              </div>

              <div className="p-5 bg-zinc-950/45 border border-white/[0.02] rounded-sm text-xs space-y-3">
                <div className="flex items-center justify-between text-zinc-300 border-b border-white/[0.03] pb-2">
                  <span className="font-semibold">Перевірка дублікатів метаданих</span>
                  <span className="text-emerald-400 font-mono font-bold">НОРМА</span>
                </div>
                <p className="text-zinc-400 leading-relaxed font-sans">
                  Аналіз бази не зафіксував копій ідентичних файлів за хешами SHA-256. Права інтелектуальної власності на початкові релізи підтверджено.
                </p>
              </div>

              <div className="p-5 bg-zinc-950/45 border border-white/[0.02] rounded-sm text-xs space-y-3">
                <div className="flex items-center justify-between text-zinc-300 border-b border-white/[0.03] pb-2">
                  <span className="font-semibold">Стан серверного сховища (CDN)</span>
                  <span className="text-amber-400 font-mono font-bold">89% ВІЛЬНО</span>
                </div>
                <p className="text-zinc-400 leading-relaxed font-sans">
                  Розподіл медіафайлів працює стабільно. Використано 2.4 TB з 24 TB. Резервні копії створюються щоночі автоматично.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB: SETTINGS */}
        {activeSubTab === 'settings' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">Системні налаштування консолі</h2>
              <p className="text-xs text-zinc-500 mt-1">Параметри конфігурації NoirSound Beta</p>
            </div>

            <div className="bg-[#111115]/30 border border-white/[0.03] rounded-sm p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.03]">
                <div>
                  <p className="text-xs font-semibold text-white">Режим автоматичного затвердження треків</p>
                  <p className="text-[10px] text-zinc-500 font-sans mt-0.5">Всі нові релізи миттєво з\'являються на платформі</p>
                </div>
                <input type="checkbox" defaultChecked className="rounded text-brand focus:ring-brand cursor-pointer" />
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-white/[0.03]">
                <div>
                  <p className="text-xs font-semibold text-white">Автоматична фільтрація нецензурної лірики</p>
                  <p className="text-[10px] text-zinc-500 font-sans mt-0.5">Приховування образливих слів у текстах пісень</p>
                </div>
                <input type="checkbox" defaultChecked={false} className="rounded text-brand focus:ring-brand cursor-pointer" />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white">Дозволити завантаження треків без заповнення тексту</p>
                  <p className="text-[10px] text-zinc-500 font-sans mt-0.5">Текст пісні стає повністю опціональним кроком</p>
                </div>
                <input type="checkbox" defaultChecked className="rounded text-brand focus:ring-brand cursor-pointer" />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
