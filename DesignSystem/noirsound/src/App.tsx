/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import MiniPlayer from './components/MiniPlayer';
import DiscoverView from './components/DiscoverView';
import SearchView from './components/SearchView';
import TrackView from './components/TrackView';
import LyricsView from './components/LyricsView';
import ArtistView from './components/ArtistView';
import LibraryView from './components/LibraryView';
import UploadView from './components/UploadView';
import AuthorStudioView from './components/AuthorStudioView';
import AdminView from './components/AdminView';

import { 
  mockTracks, 
  mockArtists, 
  mockPlaylists, 
  mockComments, 
  mockUsers, 
  mockAuditLogs 
} from './data';
import { Track, Artist, Playlist, Comment, PlatformUser, AuditLog, UploadItem, ViewType } from './types';
import { User, Shield, Radio, Check, Info, AlertCircle, Search as SearchIcon } from 'lucide-react';

export default function App() {
  // Navigation State
  const [currentView, setCurrentView] = useState<ViewType>('discover');
  
  // Interactive Master Lists in State
  const [tracks, setTracks] = useState<Track[]>(mockTracks);
  const [users, setUsers] = useState<PlatformUser[]>(mockUsers);
  const [comments, setComments] = useState<Comment[]>(mockComments);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(mockAuditLogs);
  
  // Active User Persona Role (Listener, Creator, Admin)
  const [userRole, setUserRole] = useState<'Listener' | 'Creator' | 'Admin'>('Listener');

  // Interactive Personal Collection State
  const [likedTrackIds, setLikedTrackIds] = useState<string[]>(['tr-1', 'tr-5']);
  const [followedArtistIds, setFollowedArtistIds] = useState<string[]>(['art-1']);
  
  // Upload Studio Tracker State
  const [userUploadedTracks, setUserUploadedTracks] = useState<UploadItem[]>([
    {
      id: 'up-prev',
      title: 'Тіні в тумані',
      genre: 'Пост-панк / Колдвейв',
      description: 'Головний сингл з майбутнього альбому.',
      tags: 'Пост-панк, колдвейв',
      lyrics: 'Тіні блукають у густому тумані...',
      status: 'publish',
      progress: 100,
      coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&auto=format&fit=crop&q=80',
      date: '2026-07-06'
    }
  ]);

  // Audio Player State
  const [activeTrackId, setActiveTrackId] = useState<string>('tr-1');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackProgress, setPlaybackProgress] = useState<number>(0);
  const [volume, setVolume] = useState<number>(80);

  // Active Profile Navigation ID
  const [selectedArtistId, setSelectedArtistId] = useState<string>('art-1');

  // Resolve currently active items
  const activeTrack = tracks.find((t) => t.id === activeTrackId) || tracks[0];
  const activeArtist = mockArtists.find((a) => a.id === selectedArtistId) || mockArtists[0];

  // --- INTERACTION HANDLERS ---

  // Handle Play/Pause trigger
  const handlePlayPauseToggle = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Handle manual tracking scrubbing
  const handleProgressChange = useCallback((seconds: number) => {
    setPlaybackProgress(seconds);
  }, []);

  // Handle liking / unliking tracks
  const handleToggleLike = useCallback((trackId: string) => {
    setLikedTrackIds((prev) => {
      if (prev.includes(trackId)) {
        return prev.filter((id) => id !== trackId);
      } else {
        return [...prev, trackId];
      }
    });

    // Append to audit log if role is Creator or Admin for fidelity
    const track = tracks.find(t => t.id === trackId);
    if (track) {
      const isLiking = !likedTrackIds.includes(trackId);
      const newLog: AuditLog = {
        id: 'log-' + Date.now(),
        action: isLiking ? 'Позначено як улюблений' : 'Видалено з улюблених',
        target: track.title,
        actor: 'Максим Міколенко',
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        status: 'success'
      };
      setAuditLogs(prev => [newLog, ...prev]);
    }
  }, [likedTrackIds, tracks]);

  // Handle following / unfollowing artists
  const handleToggleFollow = useCallback((artistId: string) => {
    setFollowedArtistIds((prev) => {
      if (prev.includes(artistId)) {
        return prev.filter((id) => id !== artistId);
      } else {
        return [...prev, artistId];
      }
    });
  }, []);

  // Trigger loading a specific track into the player
  const handleSelectTrack = useCallback((trackId: string, playImmediately = false) => {
    setActiveTrackId(trackId);
    setPlaybackProgress(0);
    if (playImmediately) {
      setIsPlaying(true);
    }
    setCurrentView('track');
  }, []);

  // Trigger opening an artist profile
  const handleSelectArtist = useCallback((artistId: string) => {
    setSelectedArtistId(artistId);
    setCurrentView('artist');
  }, []);

  // Submit a comment dynamically
  const handleAddComment = useCallback((trackId: string, content: string) => {
    const newComment: Comment = {
      id: 'c-' + Date.now(),
      trackId,
      userName: 'Максим Міколенко',
      userAvatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80',
      content,
      timestamp: 'Щойно',
      likes: 0,
    };
    setComments((prev) => [newComment, ...prev]);
  }, []);

  // Dynamic Upload callback
  const handleAddTrackToMaster = useCallback((newTrackData: {
    title: string;
    genre: string;
    description: string;
    tags: string[];
    lyrics: string;
    coverUrl: string;
  }) => {
    const artist = mockArtists[0]; // Map to "Силует" for prototype purposes
    const newTrack: Track = {
      id: 'tr-' + Date.now(),
      title: newTrackData.title,
      artistId: artist.id,
      artistName: artist.name,
      coverUrl: newTrackData.coverUrl,
      duration: '3:30', // Default mock duration
      seconds: 210,
      streamCount: 0,
      likeCount: 0,
      commentsCount: 0,
      releaseDate: new Date().toISOString().split('T')[0],
      genre: newTrackData.genre,
      description: newTrackData.description,
      tags: newTrackData.tags,
      lyrics: newTrackData.lyrics ? newTrackData.lyrics.split('\n') : ['(Інструментальний сингл)'],
    };

    setTracks((prev) => [newTrack, ...prev]);

    // Append to audit logs
    const newLog: AuditLog = {
      id: 'log-' + Date.now(),
      action: 'Затвердження нового треку',
      target: `${artist.name} - ${newTrack.title}`,
      actor: 'Автоматичний скрипт NoirSound',
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: 'success'
    };
    setAuditLogs(prev => [newLog, ...prev]);
  }, []);

  const handleAddUploadItem = useCallback((item: UploadItem) => {
    setUserUploadedTracks((prev) => [item, ...prev]);
  }, []);

  const handleUpdateUploadItemStatus = useCallback((id: string, status: any, progress: number) => {
    setUserUploadedTracks((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status, progress } : item))
    );
  }, []);

  // --- ADMIN ACTIONS ---

  // Toggle user active/blocked status
  const handleToggleUserStatus = useCallback((userId: string) => {
    setUsers((prev) =>
      prev.map((user) => {
        if (user.id === userId) {
          const isCurrentlyActive = user.status === 'Активний';
          const newStatus = isCurrentlyActive ? 'Заблокований' : 'Активний';
          
          // Log the action
          const newLog: AuditLog = {
            id: 'log-' + Date.now(),
            action: isCurrentlyActive ? 'Блокування користувача' : 'Розблокування користувача',
            target: user.name,
            actor: 'Максим Міколенко',
            timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
            status: isCurrentlyActive ? 'warning' : 'success'
          };
          setAuditLogs(logs => [newLog, ...logs]);

          return { ...user, status: newStatus };
        }
        return user;
      })
    );
  }, []);

  // Admin delete a track
  const handleDeleteTrack = useCallback((trackId: string) => {
    const track = tracks.find((t) => t.id === trackId);
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
    
    if (track) {
      const newLog: AuditLog = {
        id: 'log-' + Date.now(),
        action: 'Видалення треку з платформи',
        target: `${track.artistName} - ${track.title}`,
        actor: 'Максим Міколенко',
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        status: 'warning'
      };
      setAuditLogs(prev => [newLog, ...prev]);
    }
  }, [tracks]);

  // Admin delete comment
  const handleDeleteComment = useCallback((commentId: string) => {
    const comment = comments.find((c) => c.id === commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));

    if (comment) {
      const newLog: AuditLog = {
        id: 'log-' + Date.now(),
        action: 'Видалення коментаря',
        target: `Коментар від ${comment.userName}: "${comment.content.slice(0, 20)}..."`,
        actor: 'Максим Міколенко',
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        status: 'success'
      };
      setAuditLogs(prev => [newLog, ...prev]);
    }
  }, [comments]);

  // Handle track indexing for MiniPlayer timeline skipping
  const handleNextTrack = useCallback(() => {
    const currentIndex = tracks.findIndex((t) => t.id === activeTrackId);
    if (currentIndex !== -1) {
      const nextIndex = (currentIndex + 1) % tracks.length;
      handleSelectTrack(tracks[nextIndex].id, isPlaying);
    }
  }, [tracks, activeTrackId, isPlaying, handleSelectTrack]);

  const handlePrevTrack = useCallback(() => {
    const currentIndex = tracks.findIndex((t) => t.id === activeTrackId);
    if (currentIndex !== -1) {
      const prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
      handleSelectTrack(tracks[prevIndex].id, isPlaying);
    }
  }, [tracks, activeTrackId, isPlaying, handleSelectTrack]);

  return (
    <div className="flex bg-[#0a0a0c] min-h-screen text-zinc-100">
      
      {/* Sidebar Navigation - Fixed on Left */}
      <Sidebar 
        currentView={currentView} 
        onViewChange={setCurrentView} 
        userRole={userRole} 
        onRoleChange={setUserRole}
      />

      {/* Main Right Content Layout Wrapper */}
      <div className="flex-1 pl-64 flex flex-col min-h-screen relative">
        
        {/* Top Editorial Utility Header Bar */}
        <header id="platform-top-bar" className="h-14 border-b border-white/[0.04] bg-[#0a0a0c]/80 backdrop-blur-md px-8 sticky top-0 z-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider font-mono">
              {currentView === 'discover' && 'Огляд'}
              {currentView === 'search' && 'Пошук'}
              {currentView === 'playlists' && 'Плейлисти'}
              {currentView === 'track' && 'Деталі треку'}
              {currentView === 'lyrics' && 'Текст пісні'}
              {currentView === 'artist' && 'Профіль митця'}
              {currentView === 'library' && 'Медіатека'}
              {currentView === 'upload' && 'Завантажити'}
              {currentView === 'author-studio' && 'Студія автора'}
              {currentView === 'admin' && 'Адмін-панель'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-[#111115] border border-white/[0.04] flex items-center justify-center text-[10px] font-mono text-zinc-400 select-none">
              M
            </div>
            <span className="text-[11px] font-sans font-medium text-zinc-500">Maks</span>
          </div>
        </header>

        {/* Dynamic Inner Page Switcher */}
        <main className="flex-1 w-full relative pb-28">
          
          {currentView === 'discover' && (
            <DiscoverView
              tracks={tracks}
              artists={mockArtists}
              playlists={mockPlaylists}
              onSelectTrack={handleSelectTrack}
              onSelectArtist={handleSelectArtist}
              likedTrackIds={likedTrackIds}
              onToggleLike={handleToggleLike}
              onViewChange={setCurrentView}
            />
          )}

          {currentView === 'search' && (
            <SearchView
              tracks={tracks}
              artists={mockArtists}
              onSelectTrack={handleSelectTrack}
              onSelectArtist={handleSelectArtist}
              likedTrackIds={likedTrackIds}
              onToggleLike={handleToggleLike}
            />
          )}

          {currentView === 'playlists' && (
            <LibraryView
              tracks={tracks}
              playlists={mockPlaylists}
              artists={mockArtists}
              likedTrackIds={likedTrackIds}
              onToggleLike={handleToggleLike}
              followedArtistIds={followedArtistIds}
              onToggleFollow={handleToggleFollow}
              onSelectTrack={handleSelectTrack}
              onSelectArtist={handleSelectArtist}
              onViewChange={setCurrentView}
              initialTab="playlists"
            />
          )}

          {currentView === 'track' && (
            <TrackView
              activeTrack={activeTrack}
              isPlaying={isPlaying}
              onPlayPauseToggle={handlePlayPauseToggle}
              playbackProgress={playbackProgress}
              onProgressChange={handleProgressChange}
              likedTrackIds={likedTrackIds}
              onToggleLike={handleToggleLike}
              onViewChange={setCurrentView}
              artists={mockArtists}
              tracks={tracks}
              comments={comments}
              onAddComment={handleAddComment}
              onSelectTrack={handleSelectTrack}
            />
          )}

          {currentView === 'lyrics' && (
            <LyricsView
              activeTrack={activeTrack}
              isPlaying={isPlaying}
              onPlayPauseToggle={handlePlayPauseToggle}
              playbackProgress={playbackProgress}
              onProgressChange={handleProgressChange}
              likedTrackIds={likedTrackIds}
              onToggleLike={handleToggleLike}
              onNextTrack={handleNextTrack}
              onPrevTrack={handlePrevTrack}
            />
          )}

          {currentView === 'artist' && (
            <ArtistView
              activeArtist={activeArtist}
              tracks={tracks}
              onSelectTrack={handleSelectTrack}
              followedArtistIds={followedArtistIds}
              onToggleFollow={handleToggleFollow}
              likedTrackIds={likedTrackIds}
              onToggleLike={handleToggleLike}
              onSelectArtist={handleSelectArtist}
              allArtists={mockArtists}
            />
          )}

          {currentView === 'library' && (
            <LibraryView
              tracks={tracks}
              playlists={mockPlaylists}
              artists={mockArtists}
              likedTrackIds={likedTrackIds}
              onToggleLike={handleToggleLike}
              followedArtistIds={followedArtistIds}
              onToggleFollow={handleToggleFollow}
              onSelectTrack={handleSelectTrack}
              onSelectArtist={handleSelectArtist}
              onViewChange={setCurrentView}
              initialTab="liked"
            />
          )}

          {currentView === 'upload' && (
            <UploadView
              onAddTrackToMaster={handleAddTrackToMaster}
              userUploadedTracks={userUploadedTracks}
              onAddUploadItem={handleAddUploadItem}
              onUpdateUploadItemStatus={handleUpdateUploadItemStatus}
            />
          )}

          {currentView === 'author-studio' && (
            <AuthorStudioView
              tracks={tracks}
              userUploadedTracks={userUploadedTracks}
              onViewChange={setCurrentView}
              artists={mockArtists}
            />
          )}

          {currentView === 'admin' && (
            <AdminView
              users={users}
              onToggleUserStatus={handleToggleUserStatus}
              tracks={tracks}
              onDeleteTrack={handleDeleteTrack}
              artists={mockArtists}
              comments={comments}
              onDeleteComment={handleDeleteComment}
              auditLogs={auditLogs}
              uploadedItems={userUploadedTracks}
            />
          )}

        </main>

        {/* Persistent Premium Bottom Audio Player Control */}
        <MiniPlayer
          activeTrack={activeTrack}
          isPlaying={isPlaying}
          onPlayPauseToggle={handlePlayPauseToggle}
          playbackProgress={playbackProgress}
          onProgressChange={handleProgressChange}
          currentView={currentView}
          onViewChange={setCurrentView}
          volume={volume}
          onVolumeChange={setVolume}
          onNextTrack={handleNextTrack}
          onPrevTrack={handlePrevTrack}
          likedTrackIds={likedTrackIds}
          onToggleLike={handleToggleLike}
        />

      </div>
    </div>
  );
}
