import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, MoreHorizontal } from 'lucide-react';
import { followArtist, unfollowArtist } from '../../api/artists';
import { useUserStore } from '../../store/userStore';
import { formatNumber } from '../../utils/formatLocale';
import FallbackAvatar from '../ui/FallbackAvatar';
import { useArtistContextMenu } from '../../hooks/useEntityContextMenu';

export default function ArtistCard({ artist }) {
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

  return (
    <div
      onContextMenu={contextMenuProps.onContextMenu}
      className="ns-media-card group text-center"
    >
      <Link
        to={`/artist/${artist.id}`}
        onKeyDown={contextMenuProps.onKeyDown}
        className="absolute inset-0 z-0 rounded-lg"
        aria-label={`Open artist ${artist.name}`}
      />
      <button
        type="button"
        onClick={openFromButton}
        className="pointer-events-auto absolute right-3 top-3 z-20 ns-icon-button !min-h-9 !min-w-9 bg-zinc-950/80 text-zinc-300 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 focus:opacity-100"
        aria-label={`More actions for ${artist.name}`}
        aria-haspopup="menu"
      >
        <MoreHorizontal size={15} />
      </button>
      {/* Avatar Container */}
      <div className="ns-media-card__artwork pointer-events-none relative z-[1] mx-auto mb-3 aspect-square w-full max-w-[11rem] rounded-full">
        <FallbackAvatar
          src={artist.avatarUrl}
          name={artist.name}
          className="h-full w-full text-[80px]"
          imageClassName="object-cover"
        />
      </div>

      {/* Details */}
      <div className="pointer-events-none relative z-[1] mb-3 space-y-1 px-1">
        <div className="flex items-center justify-center space-x-1.5">
          <h4 className="truncate text-ns-body-sm font-semibold text-zinc-100">
            {artist.name}
          </h4>
          {artist.isVerified && (
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white" title="Verified Creator">
              <Check size={8} strokeWidth={4} />
            </span>
          )}
        </div>
        <p className="font-sans tabular-nums text-ns-meta text-zinc-500">
          {formatNumber(artist.monthlyListeners || 0)} {t('profile.monthlyListeners')}
        </p>
      </div>

      {/* Action Button */}
      <button
        onClick={handleFollowClick}
        className={`pointer-events-auto relative z-20 min-h-10 w-full cursor-pointer rounded-md border py-2 text-ns-label font-semibold transition-colors duration-150 ${
          isFollowing
            ? 'border-zinc-700/60 bg-zinc-800 text-zinc-400 hover:text-zinc-100'
            : 'border-zinc-700/70 bg-zinc-900 text-zinc-200 hover:border-brand-red/40 hover:text-white'
        }`}
        aria-pressed={isFollowing}
      >
        {isSubmitting ? t('actions.saving') : isFollowing ? t('actions.following') : t('actions.follow')}
      </button>
    </div>
  );
}
