import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Edit2, Share2, MapPin, Calendar } from 'lucide-react';
import { useToastStore } from '../../store/toastStore';
import FallbackAvatar from '../ui/FallbackAvatar';
import { formatDate } from '../../utils/formatLocale';

function isRenderableBannerUrl(value) {
  if (typeof value !== 'string') return false;
  const url = value.trim();
  return /^https?:\/\//i.test(url) || /^\/(?!\/)/.test(url) || /^blob:/i.test(url);
}

export default function UserProfileHeader({
  user,
  viewerUserId = null,
  onEditClick,
  shareUrl,
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
        <div className="ns-profile-hero__banner" data-testid="profile-banner">
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

        <div className="ns-profile-hero__avatar" data-testid="profile-avatar-overlap">
          <FallbackAvatar
            src={user.avatarUrl}
            name={displayName}
            className="h-full w-full text-[var(--ns-profile-avatar-size)]"
            imageClassName="object-cover"
            semanticFallback
          />
        </div>
      </div>

      <div className="ns-profile-hero__content">
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="space-y-1">
            <h1 className="break-words font-sans text-2xl font-semibold leading-tight tracking-tight text-zinc-100 md:text-3xl">
              {displayName}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              {user.username && (
                <p className="break-all font-sans tabular-nums text-ns-label text-zinc-400">@{user.username}</p>
              )}
              {isCreator ? (
                <span className="rounded border border-brand-purple/20 bg-brand-purple/5 px-2 py-0.5 font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-purple-300">
                  {t('profile.creator')}
                </span>
              ) : (
                <span className="rounded border border-zinc-700/60 bg-zinc-900 px-2 py-0.5 font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-400">
                  {t('profile.listener')}
                </span>
              )}
            </div>
          </div>

          <p className="max-w-2xl whitespace-pre-line break-words text-sm leading-relaxed text-zinc-300 md:text-base">
            {user.bio || t('profile.noBio')}
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-1 font-sans tabular-nums text-ns-label text-zinc-500">
            <span className="flex items-center space-x-1">
              <MapPin size={12} className="text-zinc-600" aria-hidden="true" />
              <span>{user.location || t('profile.locationPrivate')} · {isCreator ? t('profile.creator') : t('profile.listener')}</span>
            </span>
            <span className="flex items-center space-x-1">
              <Calendar size={12} className="text-zinc-600" aria-hidden="true" />
              <span>{t('profile.joined', { date: joinedLabel })}</span>
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3.5 pt-2 md:pt-0">
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
