import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, MoreHorizontal } from 'lucide-react';
import { followArtist, unfollowArtist } from '../../api/artists';
import { useUserStore } from '../../store/userStore';
import { formatNumber } from '../../utils/formatLocale';
import FallbackAvatar from '../ui/FallbackAvatar';
import { useArtistContextMenu } from '../../hooks/useEntityContextMenu';

export default function ArtistCard({ artist, roleLabel = '', metric = 'monthlyListeners' }) {
  const { t } = useTranslation();
  const user = useUserStore((state) => state.user);
  const setAuthModalOpen = useUserStore((state) => state.setAuthModalOpen);
  // Hydrated from the artist payload itself (isFollowing is computed
  // server-side per viewer) rather than assumed false, so a card for an
  // artist the viewer already follows renders correctly on first paint --
  // notably on the Profile > Followed Artists tab, where every card here
  // is, by definition, already followed.
  const [isFollowing, setIsFollowing] = useState(Boolean(artist.isFollowing));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setIsFollowing(Boolean(artist.isFollowing));
  }, [artist.id, artist.isFollowing]);

  const handleFollowClick = async (e) => {
    e?.stopPropagation?.();
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      if (isFollowing) {
        await unfollowArtist(artist.id);
        setIsFollowing(false);
      } else {
        await followArtist(artist.id);
        setIsFollowing(true);
      }
    } catch {
      // The real API client emits the visible error toast.
    } finally {
      setIsSubmitting(false);
    }
  };
  const { contextMenuProps, openFromButton } = useArtistContextMenu(artist, {
    isFollowing,
    onToggleFollow: () => handleFollowClick(),
  });
  const metricValue = metric === 'followers'
    ? Number(artist.followers || 0)
    : Number(artist.monthlyListeners || 0);
  const metricLabel = metric === 'followers'
    ? t('profile.followers')
    : t('profile.monthlyListeners');

  return (
    <div
      onContextMenu={contextMenuProps.onContextMenu}
      className="ns-media-card group text-center"
    >
      <Link
        to={`/artist/${artist.id}`}
        onKeyDown={contextMenuProps.onKeyDown}
        className="absolute inset-0 z-0 rounded-lg"
        aria-label={t('profile.openArtist', { name: artist.name })}
      />
      <button
        type="button"
        onClick={openFromButton}
        className="pointer-events-auto absolute right-3 top-3 z-20 ns-media-action ns-media-action--card bg-zinc-950/80 text-zinc-300 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 focus:opacity-100"
        aria-label={t('profile.moreArtistActions', { name: artist.name })}
        aria-haspopup="menu"
      >
        <MoreHorizontal size={15} />
      </button>
      {/* Avatar Container */}
      <div className="ns-media-card__artwork ns-avatar-frame pointer-events-none relative z-[1] mx-auto mb-3 aspect-square w-full max-w-[11rem]">
        <FallbackAvatar
          src={artist.avatarUrl}
          name={artist.name}
          className="h-full w-full text-[80px]"
          imageClassName="object-cover"
        />
      </div>

      {/* Details */}
      <div className="pointer-events-none relative z-[1] mb-3 space-y-1 px-1">
        {roleLabel && (
          <p className="ns-eyebrow text-center text-zinc-500">{roleLabel}</p>
        )}
        <div className="flex items-center justify-center space-x-1.5">
          <h3 title={artist.name} className="min-w-0 truncate text-ns-body-sm font-semibold text-zinc-100">
            {artist.name}
          </h3>
          {artist.isVerified && (
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white" title={t('profile.verifiedArtist')}>
              <Check size={8} strokeWidth={4} />
            </span>
          )}
        </div>
        <p className="font-sans tabular-nums text-ns-meta text-zinc-500">
          {formatNumber(metricValue)} {metricLabel}
        </p>
      </div>

      {/* Action Button */}
      <button
        type="button"
        onClick={handleFollowClick}
        disabled={isSubmitting}
        aria-busy={isSubmitting ? 'true' : undefined}
        className="ns-pill-action ns-pill-toggle pointer-events-auto relative z-20 w-full text-ns-label sm:w-auto sm:min-w-[7rem]"
        aria-pressed={isFollowing}
      >
        {isSubmitting ? t('actions.saving') : isFollowing ? t('actions.following') : t('actions.follow')}
      </button>
    </div>
  );
}
