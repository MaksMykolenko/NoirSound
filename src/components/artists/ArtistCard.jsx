import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, MoreHorizontal } from 'lucide-react';
import { followArtist, unfollowArtist } from '../../api/artists';
import { useUserStore } from '../../store/userStore';
import { formatNumber } from '../../utils/formatLocale';
import FallbackAvatar from '../ui/FallbackAvatar';
import { useArtistContextMenu } from '../../hooks/useEntityContextMenu';

export default function ArtistCard({ artist }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
      onClick={() => navigate(`/artist/${artist.id}`)}
      onKeyDown={(event) => {
        contextMenuProps.onKeyDown(event);
        if (event.defaultPrevented) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          navigate(`/artist/${artist.id}`);
        }
      }}
      onContextMenu={contextMenuProps.onContextMenu}
      role="link"
      tabIndex={0}
      aria-label={`Open artist ${artist.name}`}
      className="group relative cursor-pointer rounded-lg border border-zinc-800/60 bg-zinc-950/35 p-3 text-center transition-colors duration-150 hover:border-zinc-700/70 hover:bg-zinc-900/45"
    >
      <button
        type="button"
        onClick={openFromButton}
        className="absolute right-3 top-3 ns-icon-button !min-h-9 !min-w-9 text-zinc-500 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
        aria-label={`More actions for ${artist.name}`}
        aria-haspopup="menu"
      >
        <MoreHorizontal size={15} />
      </button>
      {/* Avatar Container */}
      <div className="relative mx-auto mb-3 h-20 w-20 overflow-hidden rounded-full border border-zinc-800 bg-zinc-950">
        <FallbackAvatar
          src={artist.avatarUrl}
          name={artist.name}
          className="h-full w-full text-[80px]"
          imageClassName="object-cover"
        />
      </div>

      {/* Details */}
      <div className="mb-3 space-y-1">
        <div className="flex items-center justify-center space-x-1.5">
          <h4 className="truncate text-[13px] font-semibold text-zinc-100">
            {artist.name}
          </h4>
          {artist.isVerified && (
            <span className="w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center text-[7px] text-white shrink-0" title="Verified Creator">
              <Check size={8} strokeWidth={4} />
            </span>
          )}
        </div>
        <p className="font-mono text-[10px] text-zinc-500">
          {formatNumber(artist.monthlyListeners || 0)} {t('profile.monthlyListeners')}
        </p>
      </div>

      {/* Action Button */}
      <button
        onClick={handleFollowClick}
        className={`min-h-10 w-full cursor-pointer rounded-md border py-2 text-[11px] font-semibold transition-colors duration-150 ${
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
