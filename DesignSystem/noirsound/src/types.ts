/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Track {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  coverUrl: string;
  duration: string; // e.g. "3:42"
  seconds: number; // e.g. 222
  streamCount: number;
  likeCount: number;
  commentsCount: number;
  releaseDate: string;
  genre: string;
  description: string;
  tags: string[];
  lyrics: string[];
}

export interface Artist {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string;
  bannerUrl: string;
  bio: string;
  followersCount: number;
  verified: boolean;
  socialLinks: {
    platform: 'Instagram' | 'Telegram' | 'Bandcamp' | 'SoundCloud' | 'Twitter';
    url: string;
  }[];
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  trackCount: number;
  tracks: string[]; // Track IDs
}

export interface Comment {
  id: string;
  trackId: string;
  userName: string;
  userAvatarUrl: string;
  content: string;
  timestamp: string; // e.g. "2 хвилини тому"
  likes: number;
}

export interface UploadItem {
  id: string;
  title: string;
  genre: string;
  description: string;
  tags: string;
  lyrics: string;
  status: 'upload' | 'processing' | 'review' | 'publish';
  progress: number; // 0 - 100
  coverUrl?: string;
  date: string;
}

export interface AuditLog {
  id: string;
  action: string;
  target: string;
  actor: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error';
}

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: 'Creator' | 'Listener' | 'Admin';
  joinedDate: string;
  avatarUrl: string;
  status: 'Активний' | 'Тимчасово заблокований' | 'Заблокований';
}

export type ViewType =
  | 'discover'
  | 'search'
  | 'playlists'
  | 'track'
  | 'lyrics'
  | 'artist'
  | 'library'
  | 'upload'
  | 'author-studio'
  | 'admin';
