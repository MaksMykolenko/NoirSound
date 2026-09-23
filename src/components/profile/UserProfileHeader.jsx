import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Edit2, Share2, MapPin, Calendar, Heart, ListMusic, UserCheck, Clock } from 'lucide-react';
import { useToastStore } from '../../store/toastStore';
import FallbackAvatar from '../ui/FallbackAvatar';
import { formatDate, formatNumber } from '../../utils/formatLocale';

function isRenderableBannerUrl(value) {
  if (typeof value !== 'string') return false;
  const url = value.trim();
  return /^https?:\/\//i.test(url) || /^\/(?!\/)/.test(url) || /^blob:/i.test(url);
}

export function UserProfileHeaderSkeleton({ label }) {
  return (
    <section
      className="ns-profile-hero"
      data-testid="user-profile-header-skeleton"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
      <div className="ns-profile-hero__banner-wrap" aria-hidden="true">
        <div
          className="ns-profile-hero__banner ns-profile-hero__skeleton-surface"
          data-profile-banner
          data-testid="profile-banner-skeleton"
        />
        <div
          className="ns-profile-hero__avatar ns-profile-hero__skeleton-surface"
          data-profile-avatar
          data-testid="profile-avatar-skeleton"
        />
      </div>
      <div className="ns-profile-hero__content" aria-hidden="true">
        <div className="ns-profile-hero__identity ns-profile-hero__skeleton-stack">
          <span className="ns-profile-hero__skeleton-line ns-profile-hero__skeleton-line--title" />
          <span className="ns-profile-hero__skeleton-line ns-profile-hero__skeleton-line--meta" />
          <span className="ns-profile-hero__skeleton-line ns-profile-hero__skeleton-line--bio" />
        </div>
      </div>
    </section>
  );
}

export default function UserProfileHeader({
  user,
  viewerUserId = null,
  onEditClick,
  onSettingsClick,
  shareUrl,
  stats = null,
}) {
  const { t } = useTranslation();
  const { addToast } = useToastStore();
  const [bannerFailed, setBannerFailed] = useState(false);
  const displayName = user.displayName || user.username || t('profile.listener');
  const joinedLabel = user.joinedAt ? formatDate(user.joinedAt) : t('profile.joinedRecently');
  const bannerUrl = isRenderableBannerUrl(user.bannerUrl) ? user.bannerUrl.trim() : null;
  const showBannerImage = Boolean(bannerUrl && !bannerFailed);
  const isOwner = Boolean(viewerUserId && user.id && viewerUserId === user.id);
  const isCreator = Boolean(user.isCreator || user.artistProfileId || user.role === 'ARTIST');

  useEffect(() => {
    setBannerFailed(false);
  }, [bannerUrl]);

  const handleShareClick = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(shareUrl || window.location.href);
      addToast(t('profile.shareCopied'), 'success');
    } catch {
      addToast(t('profile.shareCopyFailed'), 'error');
    }
  };

  return (
    <section className="ns-profile-hero" data-testid="user-profile-header" data-owner={isOwner || undefined}>
      <div className="ns-profile-hero__banner-wrap">
        <div
          className="ns-profile-hero__banner"
          data-profile-banner
          data-testid="profile-banner"
        >
          {showBannerImage ? (
            <img
              src={bannerUrl}
              alt=""
              aria-hidden="true"
              className="ns-profile-hero__banner-image"
              data-testid="profile-banner-image"
              onError={() => setBannerFailed(true)}
            />
          ) : (
            <div
              className="ns-profile-hero__banner-fallback"
              data-testid="profile-banner-fallback"
              aria-hidden="true"
            />
          )}
        </div>

        <div
          className="ns-profile-hero__avatar"
          data-profile-avatar
          data-testid="profile-avatar-overlap"
        >
          {isOwner && (onSettingsClick || onEditClick) ? (
            <button
              type="button"
              onClick={onSettingsClick || onEditClick}
              className="group relative block h-full w-full cursor-pointer overflow-hidden rounded-full focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 focus:ring-offset-black"
              title={t('profile.changeAvatar', 'Change photo & settings')}
              aria-label={t('profile.changeAvatar', 'Change photo & settings')}
              data-testid="profile-avatar-edit-button"
            >
              <FallbackAvatar
                src={user.avatarUrl}
                name={displayName}
                className="h-full w-full text-[var(--ns-profile-avatar-size)] transition-transform duration-300 group-hover:scale-105"
                imageClassName="object-cover"
                semanticFallback
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover:opacity-100">
                <Edit2 size={20} className="text-white drop-shadow" />
                <span className="mt-1 text-[9px] font-bold text-white uppercase tracking-wider font-mono">
                  {t('profile.editProfile')}
                </span>
              </div>
            </button>
          ) : (
            <FallbackAvatar
              src={user.avatarUrl}
              name={displayName}
              className="h-full w-full text-[var(--ns-profile-avatar-size)]"
              imageClassName="object-cover"
              semanticFallback
            />
          )}
        </div>
      </div>

      <div className="ns-profile-hero__content">
        <div className="ns-profile-hero__identity min-w-0 space-y-2.5 xl:space-y-2">
          <div className="space-y-1 xl:flex xl:flex-wrap xl:items-center xl:gap-x-3 xl:gap-y-1 xl:space-y-0">
            <h1 className="break-words font-sans text-2xl font-semibold leading-tight tracking-tight text-zinc-100 md:text-3xl">
              {displayName}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              {user.username && (
                <p className="break-all font-sans tabular-nums text-ns-label text-zinc-400">@{user.username}</p>
              )}
              {isCreator ? (
                <span className="inline-flex items-center gap-0.5 font-mono text-xs font-semibold text-brand-purple tracking-wider">
                  <span className="text-brand-purple/60">#</span>
                  <span>{t('profile.creator')}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 font-mono text-xs font-semibold text-zinc-400 tracking-wider">
                  <span className="text-zinc-600">#</span>
                  <span>{t('profile.listener')}</span>
                </span>
              )}
            </div>
          </div>

          <p className="ns-profile-hero__bio max-w-2xl whitespace-pre-line text-sm leading-relaxed text-zinc-300 md:text-base">
            {user.bio || t('profile.noBio')}
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-1 font-sans tabular-nums text-ns-label text-zinc-500 xl:pt-0">
            <span className="flex items-center space-x-1">
              <MapPin size={12} className="text-zinc-600" aria-hidden="true" />
              <span>{user.location || t('profile.locationPrivate')} · {isCreator ? t('profile.creator') : t('profile.listener')}</span>
            </span>
            <span className="flex items-center space-x-1">
              <Calendar size={12} className="text-zinc-600" aria-hidden="true" />
              <span>{t('profile.joined', { date: joinedLabel })}</span>
            </span>
          </div>

          {stats && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 font-mono text-xs text-zinc-400" data-testid="profile-header-stats">
              {stats.likedCount !== undefined && stats.likedCount > 0 && (
                <div className="inline-flex items-center gap-1.5 transition-colors hover:text-zinc-200">
                  <Heart size={13} className="text-brand-red fill-brand-red/80" />
                  <span className="font-bold text-zinc-200 tabular-nums">{formatNumber(stats.likedCount)}</span>
                  <span className="text-zinc-500 font-sans text-[11px]">{t('profile.likedTracks')}</span>
                </div>
              )}
              {stats.playlistsCount !== undefined && stats.playlistsCount > 0 && (
                <div className="inline-flex items-center gap-1.5 transition-colors hover:text-zinc-200">
                  <ListMusic size={13} className="text-zinc-400" />
                  <span className="font-bold text-zinc-200 tabular-nums">{formatNumber(stats.playlistsCount)}</span>
                  <span className="text-zinc-500 font-sans text-[11px]">{t('profile.playlists')}</span>
                </div>
              )}
              {stats.followingCount !== undefined && stats.followingCount > 0 && (
                <div className="inline-flex items-center gap-1.5 transition-colors hover:text-zinc-200">
                  <UserCheck size={13} className="text-zinc-400" />
                  <span className="font-bold text-zinc-200 tabular-nums">{formatNumber(stats.followingCount)}</span>
                  <span className="text-zinc-500 font-sans text-[11px]">{t('profile.followedArtists')}</span>
                </div>
              )}
              {stats.listeningTime && (
                <div className="inline-flex items-center gap-1.5 transition-colors hover:text-zinc-200">
                  <Clock size={13} className="text-amber-400" />
                  <span className="font-bold text-zinc-200 tabular-nums">{stats.listeningTime}</span>
                  <span className="text-zinc-500 font-sans text-[11px]">{t('stats.timeListened')}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="ns-profile-hero__actions flex shrink-0 items-center gap-3">
          {isOwner && onEditClick && (
            <button
              type="button"
              onClick={onEditClick}
              className="ns-button-primary flex min-h-11 cursor-pointer items-center space-x-2 rounded-md px-4 py-2.5 text-ns-label font-semibold"
            >
              <Edit2 size={14} aria-hidden="true" />
              <span>{t('profile.editProfile')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleShareClick}
            className="ns-icon-button cursor-pointer"
            title={t('profile.shareProfile')}
            aria-label={t('profile.copyProfileLink', { name: displayName })}
          >
            <Share2 size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
