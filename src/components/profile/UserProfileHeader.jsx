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

  const handleShareClick = () => {
    navigator.clipboard.writeText(window.location.href);
    addToast("Profile link copied to clipboard!", "success");
  };

  return (
    <section className="relative rounded-[1.75rem] overflow-hidden border border-zinc-800/70 bg-zinc-950 shadow-2xl">
      {/* Banner */}
      <div
        className="h-44 md:h-52 w-full transition-all duration-500"
        style={{ background: user.bannerUrl || 'linear-gradient(135deg, var(--ns-accent-deep) 0%, var(--ns-bg) 100%)' }}
      />

      {/* Info wrap */}
      <div className="p-4 sm:p-6 pt-0 flex flex-col md:flex-row items-center md:items-end gap-4 sm:gap-6 relative -mt-10 md:-mt-12 z-10 text-center md:text-left">
        {/* Avatar */}
        <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full overflow-hidden border-[4px] border-zinc-950 bg-zinc-900 shadow-xl shrink-0">
          <FallbackAvatar
            src={user.avatarUrl}
            name={user.displayName || user.username}
            className="w-full h-full text-[124px]"
            imageClassName="object-cover"
          />
        </div>

        {/* Text */}
        <div className="flex-1 space-y-2.5 min-w-0">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-black text-zinc-100 tracking-tight truncate leading-tight">
              {user.displayName || user.username || 'NoirSound Listener'}
            </h1>
            <div className="flex items-center justify-center md:justify-start gap-2">
              <p className="text-sm text-zinc-400 font-semibold">@{user.username || 'listener'}</p>
              {(user.artistProfileId || user.role === 'ARTIST') ? (
                <span className="text-[10px] uppercase tracking-wider font-bold text-purple-300 border border-purple-400/20 bg-purple-500/10 rounded-full px-2.5 py-0.5">
                  {t('profile.creator')}
                </span>
              ) : (
                <span className="text-[10px] uppercase tracking-wider font-bold text-blue-300 border border-blue-400/20 bg-blue-500/10 rounded-full px-2.5 py-0.5">
                  {t('profile.listener')}
                </span>
              )}
            </div>
          </div>

          <p className="text-xs md:text-sm text-zinc-300 max-w-xl leading-relaxed">
            {user.bio || t('profile.noBio')}
          </p>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-[11px] text-zinc-500 font-semibold pt-1">
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
            className="px-5 py-2.5 ns-button-primary rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-2"
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
