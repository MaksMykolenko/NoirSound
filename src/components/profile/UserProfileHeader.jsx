import React from 'react';
import { useTranslation } from 'react-i18next';
import { Edit2, Share2, MapPin, Calendar } from 'lucide-react';
import { useToastStore } from '../../store/toastStore';
import FallbackAvatar from '../ui/FallbackAvatar';
import { formatDate } from '../../utils/formatLocale';

export default function UserProfileHeader({ user, onEditClick }) {
  const { t } = useTranslation();
  const { addToast } = useToastStore();
  const joinedLabel = user.joinedAt ? formatDate(user.joinedAt) : 'recently';
  const hasImageBanner = /^https?:\/\//i.test(user.bannerUrl || '');

  const handleShareClick = () => {
    navigator.clipboard.writeText(window.location.href);
    addToast("Profile link copied to clipboard!", "success");
  };

  return (
    <section className="relative overflow-hidden border-b border-zinc-800/60 bg-zinc-950/30">
      {/* Banner */}
      <div
        className="h-28 w-full bg-zinc-900 bg-cover bg-center opacity-80 transition-opacity duration-300 md:h-36"
        style={hasImageBanner ? { backgroundImage: `url(${user.bannerUrl})` } : undefined}
      />

      {/* Info wrap */}
      <div className="relative z-10 -mt-8 flex flex-col items-center gap-4 p-4 pt-0 text-center sm:p-5 sm:pt-0 md:-mt-10 md:flex-row md:items-end md:text-left">
        {/* Avatar */}
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-zinc-950 bg-zinc-900 sm:h-24 sm:w-24">
          <FallbackAvatar
            src={user.avatarUrl}
            name={user.displayName || user.username}
            className="h-full w-full text-[96px]"
            imageClassName="object-cover"
          />
        </div>

        {/* Text */}
        <div className="flex-1 space-y-2.5 min-w-0">
          <div className="space-y-1">
            <h1 className="break-words font-sans text-2xl font-semibold leading-tight tracking-tight text-zinc-100 md:text-3xl">
              {user.displayName || user.username || 'NoirSound Listener'}
            </h1>
            <div className="flex items-center justify-center md:justify-start gap-2">
              <p className="font-sans tabular-nums text-ns-label text-zinc-400">@{user.username || 'listener'}</p>
              {(user.artistProfileId || user.role === 'ARTIST') ? (
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

          <p className="text-sm md:text-base text-zinc-300 max-w-xl leading-relaxed">
            {user.bio || t('profile.noBio')}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-1 font-sans tabular-nums text-ns-label text-zinc-500 md:justify-start">
            <span className="flex items-center space-x-1">
              <MapPin size={12} className="text-zinc-600" />
              <span>{user.location || t('profile.locationPrivate')} • {(user.artistProfileId || user.role === 'ARTIST') ? t('profile.creator') : t('profile.listener')}</span>
            </span>
            <span className="hidden sm:inline text-zinc-800">•</span>
            <span className="flex items-center space-x-1">
              <Calendar size={12} className="text-zinc-600" />
              <span>{t('profile.joined', { date: joinedLabel })}</span>
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3.5 shrink-0 pt-2 md:pt-0">
          <button
            onClick={onEditClick}
            className="ns-button-primary flex cursor-pointer items-center space-x-2 rounded-md px-4 py-2.5 text-ns-label font-semibold"
          >
            <Edit2 size={12} />
            <span>{t('profile.editProfile')}</span>
          </button>
          
          <button
            onClick={handleShareClick}
            className="ns-icon-button cursor-pointer"
            title={t('profile.shareProfile')}
            aria-label="Copy profile link"
          >
            <Share2 size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
