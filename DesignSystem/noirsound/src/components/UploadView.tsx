/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Upload, Music, Image as ImageIcon, Check, AlertCircle, Info, RefreshCw, Layers } from 'lucide-react';
import { UploadItem } from '../types';

interface UploadViewProps {
  onAddTrackToMaster: (newTrackData: {
    title: string;
    genre: string;
    description: string;
    tags: string[];
    lyrics: string;
    coverUrl: string;
  }) => void;
  userUploadedTracks: UploadItem[];
  onAddUploadItem: (item: UploadItem) => void;
  onUpdateUploadItemStatus: (id: string, status: any, progress: number) => void;
}

export default function UploadView({
  onAddTrackToMaster,
  userUploadedTracks,
  onAddUploadItem,
  onUpdateUploadItemStatus,
}: UploadViewProps) {
  const [dragActive, setDragActive] = useState(false);
  const [audioFileSelected, setAudioFileSelected] = useState(false);
  const [audioFileName, setAudioFileName] = useState('');
  
  const [coverUrl, setCoverUrl] = useState('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80');
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('Пост-панк');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);

  // Active simulated uploads state
  const [simulatedUpload, setSimulatedUpload] = useState<{
    id: string;
    title: string;
    status: 'upload' | 'processing' | 'review' | 'publish';
    progress: number;
  } | null>(null);

  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setAudioFileSelected(true);
      setAudioFileName(e.dataTransfer.files[0].name);
      if (!title) {
        // Strip extension for default title
        setTitle(e.dataTransfer.files[0].name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAudioFileSelected(true);
      setAudioFileName(e.target.files[0].name);
      if (!title) {
        setTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  // Pre-configured cover art list for quick selection in prototype
  const placeholderCovers = [
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=500&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop&q=80',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioFileSelected || !title.trim() || !rightsConfirmed) return;

    const newUploadId = 'up-' + Date.now();
    
    // Setup simulated workflow sequence
    setSimulatedUpload({
      id: newUploadId,
      title: title,
      status: 'upload',
      progress: 0,
    });

    const uploadItem: UploadItem = {
      id: newUploadId,
      title: title,
      genre: genre,
      description: description,
      tags: tags,
      lyrics: lyrics,
      status: 'upload',
      progress: 0,
      coverUrl: coverUrl,
      date: new Date().toISOString().split('T')[0],
    };

    onAddUploadItem(uploadItem);

    // Simulate progress pipeline
    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      
      if (progress <= 35) {
        // Stage 1: Uploading
        setSimulatedUpload(prev => prev ? { ...prev, progress, status: 'upload' } : null);
        onUpdateUploadItemStatus(newUploadId, 'upload', progress);
      } else if (progress <= 70) {
        // Stage 2: Audio Transcoding & Waveform extraction
        setSimulatedUpload(prev => prev ? { ...prev, progress, status: 'processing' } : null);
        onUpdateUploadItemStatus(newUploadId, 'processing', progress);
      } else if (progress <= 95) {
        // Stage 3: Auto AI Guard / Content Moderation
        setSimulatedUpload(prev => prev ? { ...prev, progress, status: 'review' } : null);
        onUpdateUploadItemStatus(newUploadId, 'review', progress);
      } else if (progress >= 100) {
        // Stage 4: Ready and Published!
        setSimulatedUpload(prev => prev ? { ...prev, progress: 100, status: 'publish' } : null);
        onUpdateUploadItemStatus(newUploadId, 'publish', 100);
        
        // Add item to global playable master tracks!
        onAddTrackToMaster({
          title: title,
          genre: genre,
          description: description || 'Сингл завантажений через студію авторів NoirSound.',
          tags: tags ? tags.split(',').map(t => t.trim()) : ['Новий реліз'],
          lyrics: lyrics || 'Текст пісні не було надано автором.',
          coverUrl: coverUrl,
        });

        clearInterval(interval);
        
        // Reset form inputs after delay
        setTimeout(() => {
          setSimulatedUpload(null);
          setAudioFileSelected(false);
          setAudioFileName('');
          setTitle('');
          setDescription('');
          setTags('');
          setLyrics('');
          setRightsConfirmed(false);
        }, 3000);
      }
    }, 200);
  };

  return (
    <div className="flex-1 min-h-screen pb-32 pt-6 px-8 max-w-5xl mx-auto">
      {/* View Header */}
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl tracking-tight text-white">Студія авторів</h1>
        <p className="text-xs text-zinc-500 font-mono mt-1">Опублікуйте свої композиції без посередників</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Main Form Area (Span 8) */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Active Simulating Status Alert */}
          {simulatedUpload && (
            <div className="p-5 bg-zinc-950 border border-brand/20 rounded-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 text-brand animate-spin" />
                  <span className="text-xs font-mono font-medium text-white uppercase">
                    {simulatedUpload.status === 'upload' && 'Завантаження аудіофайлу...'}
                    {simulatedUpload.status === 'processing' && 'Аналіз та конвертація...'}
                    {simulatedUpload.status === 'review' && 'Автоматична модерація прав...'}
                    {simulatedUpload.status === 'publish' && 'Опубліковано! Додано до списків'}
                  </span>
                </div>
                <span className="text-xs font-mono text-brand">{simulatedUpload.progress}%</span>
              </div>
              
              {/* Process Progress Bar */}
              <div className="w-full h-1 bg-zinc-900 rounded overflow-hidden">
                <div 
                  className="h-full bg-brand progress-glow transition-all duration-150"
                  style={{ width: `${simulatedUpload.progress}%` }}
                />
              </div>

              {/* Steps visual state */}
              <div className="grid grid-cols-4 gap-2 mt-4 text-[9px] font-mono uppercase text-center">
                <span className={simulatedUpload.status === 'upload' ? 'text-brand font-bold' : 'text-zinc-600'}>1. Завантаження</span>
                <span className={simulatedUpload.status === 'processing' ? 'text-brand font-bold' : 'text-zinc-600'}>2. Обробка</span>
                <span className={simulatedUpload.status === 'review' ? 'text-brand font-bold' : 'text-zinc-600'}>3. Модерація</span>
                <span className={simulatedUpload.status === 'publish' ? 'text-brand font-bold' : 'text-zinc-600'}>4. Публікація</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Audio File Selection / Drag and Drop Area */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => audioInputRef.current?.click()}
              className={`border border-dashed p-8 rounded-sm text-center cursor-pointer transition-all ${
                dragActive 
                  ? 'border-brand bg-brand/5' 
                  : 'border-white/[0.04] bg-[#111115]/20 hover:bg-[#111115]/50'
              }`}
            >
              <input 
                ref={audioInputRef}
                type="file" 
                accept="audio/*" 
                className="hidden" 
                onChange={handleAudioSelect}
              />
              
              {audioFileSelected ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-brand/10 text-brand flex items-center justify-center mb-1">
                    <Check className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-medium text-white">{audioFileName}</p>
                  <p className="text-[10px] text-zinc-500 font-mono">Файл вибрано успішно. Натисніть для зміни.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-zinc-900 text-zinc-400 flex items-center justify-center mb-1">
                    <Upload className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-medium text-zinc-300">Перетягніть аудіофайл сюди або натисніть для вибору</p>
                  <p className="text-[10px] text-zinc-500 font-mono">Підтримуються формати: WAV, FLAC, MP3 (до 100 МБ)</p>
                </div>
              )}
            </div>

            {/* Core Metadata Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-2">Назва треку</label>
                <input
                  type="text"
                  required
                  placeholder="Введіть назву композиції"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={!!simulatedUpload}
                  className="w-full bg-[#111115] text-xs text-zinc-200 px-4 py-2.5 rounded border border-white/[0.04] focus:outline-none focus:border-brand/40 font-sans"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-2">Жанр</label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  disabled={!!simulatedUpload}
                  className="w-full bg-[#111115] text-xs text-zinc-200 px-4 py-2.5 rounded border border-white/[0.04] focus:outline-none focus:border-brand/40 font-sans cursor-pointer"
                >
                  <option value="Пост-панк">Пост-панк</option>
                  <option value="Колдвейв">Колдвейв</option>
                  <option value="Лоу-фай Хаус">Лоу-фай Хаус</option>
                  <option value="Ембієнт">Ембієнт</option>
                  <option value="Дарк-фолк">Дарк-фолк</option>
                  <option value="Шугейз">Шугейз</option>
                  <option value="Дрім-поп">Дрім-поп</option>
                </select>
              </div>
            </div>

            {/* Description and tags */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-2">Опис релізу (необов\'язково)</label>
                <textarea
                  placeholder="Розкажіть про створення композиції, джерела натхнення або обладнання..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  disabled={!!simulatedUpload}
                  className="w-full bg-[#111115] text-xs text-zinc-200 px-4 py-2.5 rounded border border-white/[0.04] focus:outline-none focus:border-brand/40 font-sans resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-2">Теги (через кому)</label>
                <input
                  type="text"
                  placeholder="постпанк, аналог, київ, туман"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  disabled={!!simulatedUpload}
                  className="w-full bg-[#111115] text-xs text-zinc-200 px-4 py-2.5 rounded border border-white/[0.04] focus:outline-none focus:border-brand/40 font-sans"
                />
                <p className="text-[9px] text-zinc-500 font-mono mt-1.5 leading-relaxed">
                  Теги допомагають вашій музиці потрапити у тематичні плейлисти слухачів.
                </p>
              </div>
            </div>

            {/* Optional Lyrics */}
            <div>
              <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-2">Текст пісні (необов\'язково)</label>
              <textarea
                placeholder="Вставте слова композиції. Кожен рядок з нового абзацу. Це увімкне функцію синхронізації караоке під час програвання."
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                rows={5}
                disabled={!!simulatedUpload}
                className="w-full bg-[#111115] text-xs text-zinc-200 px-4 py-2.5 rounded border border-white/[0.04] focus:outline-none focus:border-brand/40 font-sans resize-none"
              />
            </div>

            {/* Visual Cover Art Selection Block */}
            <div className="bg-[#111115]/30 border border-white/[0.02] p-5 rounded-sm">
              <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-3">Обкладинка релізу</label>
              
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="w-24 h-24 rounded bg-zinc-900 border border-white/[0.05] overflow-hidden flex-shrink-0">
                  <img src={coverUrl} alt="Cover preview" className="w-full h-full object-cover" />
                </div>
                
                <div className="flex-1">
                  <p className="text-[11px] text-zinc-400 leading-relaxed font-sans mb-3">
                    Виберіть один із автентичних пресетів NoirSound для бета-тесту або залиште базовий:
                  </p>
                  
                  <div className="flex gap-2">
                    {placeholderCovers.map((url, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setCoverUrl(url)}
                        disabled={!!simulatedUpload}
                        className={`w-10 h-10 rounded border overflow-hidden cursor-pointer transition-all ${coverUrl === url ? 'border-brand scale-105' : 'border-transparent hover:border-zinc-700'}`}
                      >
                        <img src={url} alt={`Preset ${i}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Rights confirmation */}
            <div className="flex items-start gap-3 p-4 bg-zinc-950/45 rounded border border-white/[0.02]">
              <input
                id="copyright"
                type="checkbox"
                required
                checked={rightsConfirmed}
                onChange={(e) => setRightsConfirmed(e.target.checked)}
                disabled={!!simulatedUpload}
                className="mt-0.5 rounded border-white/[0.05] text-brand focus:ring-brand cursor-pointer"
              />
              <label htmlFor="copyright" className="text-xs text-zinc-400 leading-relaxed font-sans cursor-pointer select-none">
                Я підтверджую, що я є автором або володію всіма виключними правами на аудіоматеріал та обкладинку, і надаю NoirSound право на їх розповсюдження.
              </label>
            </div>

            {/* Submit CTA */}
            <button
              type="submit"
              disabled={!audioFileSelected || !title.trim() || !rightsConfirmed || !!simulatedUpload}
              className="w-full bg-brand hover:bg-brand-hover disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white text-xs font-semibold py-3 rounded transition-all cursor-pointer text-center font-sans shadow-md"
            >
              {!audioFileSelected 
                ? 'Виберіть аудіофайл для початку' 
                : !rightsConfirmed 
                  ? 'Підтвердіть авторські права' 
                  : 'Запустити процес публікації'
              }
            </button>
          </form>
        </div>

        {/* Informative sidebar: "What happens next" (Span 4) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#111115]/40 border border-white/[0.03] rounded p-5">
            <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-brand" />
              <span>Правила дистрибуції</span>
            </h3>

            <div className="space-y-4 text-xs leading-relaxed font-sans text-zinc-400">
              <div>
                <p className="font-semibold text-zinc-200 mb-1">Безкоштовне поширення</p>
                <p>Ми не беремо комісію за перші 10 завантажених треків. Ваша музика залишається безкоштовною для прослуховування назавжди.</p>
              </div>
              
              <div>
                <p className="font-semibold text-zinc-200 mb-1">Технічні вимоги</p>
                <p>Рекомендовано заливати файли у форматі WAV (24-bit, 44.1kHz). Це гарантує максимальну якість звуку в плеєрі.</p>
              </div>

              <div>
                <p className="font-semibold text-zinc-200 mb-1">Сувора модерація</p>
                <p>NoirSound виступає проти піратства та крадіжки контенту. Будь-які скарги на порушення авторських прав розглядаються вручну протягом 24 годин.</p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-950/40 border border-white/[0.02] p-5 rounded">
            <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-3">
              Ваші завантаження ({userUploadedTracks.length})
            </h3>
            
            <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
              {userUploadedTracks.map((item) => (
                <div 
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded bg-zinc-900/30 border border-white/[0.01]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-white truncate">{item.title}</p>
                    <p className="text-[9px] font-mono text-zinc-500">{item.date} • {item.genre}</p>
                  </div>
                  
                  <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded border uppercase flex-shrink-0 ${
                    item.status === 'publish' 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  }`}>
                    {item.status === 'publish' ? 'Активний' : 'Модерація'}
                  </span>
                </div>
              ))}
              
              {userUploadedTracks.length === 0 && (
                <p className="text-xs text-zinc-600">Ви ще не завантажили жодного треку.</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
