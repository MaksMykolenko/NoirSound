import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { followArtist, unfollowArtist } from '../../api/artists';
import { useUserStore } from '../../store/userStore';
import { formatNumber } from '../../utils/formatLocale';
import FallbackAvatar from '../ui/FallbackAvatar';

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
    e.stopPropagation();
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

  return (
    <div
      onClick={() => navigate(`/artist/${artist.id}`)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          navigate(`/artist/${artist.id}`);
        }
      }}
      role="link"
      tabIndex={0}
      aria-label={`Open artist ${artist.name}`}
      className="p-4 ns-card ns-card-interactive cursor-pointer text-center group"
    >
      {/* Avatar Container */}
      <div className="relative w-28 h-28 mx-auto mb-4 rounded-full overflow-hidden border border-zinc-800 shadow-[0_5px_15px_rgba(0,0,0,0.5)] bg-zinc-950">
        <FallbackAvatar
          src={artist.avatarUrl}
          name={artist.name}
          className="w-full h-full text-[112px] group-hover:scale-105 transition-transform duration-500"
          imageClassName="object-cover"
        />
        {/* Glow effect on hover */}
        <div className="absolute inset-0 bg-brand-red/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      </div>

      {/* Details */}
      <div className="space-y-1.5 mb-4">
        <div className="flex items-center justify-center space-x-1.5">
          <h4 className="text-[15px] font-bold text-zinc-100 truncate group-hover:text-zinc-100">
            {artist.name}
          </h4>
          {artist.isVerified && (
            <span className="w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center text-[7px] text-white shrink-0" title="Verified Creator">
              <Check size={8} strokeWidth={4} />
            </span>
          )}
        </div>
        <p className="text-[13px] text-zinc-400 font-medium">
          {formatNumber(artist.monthlyListeners || 0)} {t('profile.monthlyListeners')}
        </p>
      </div>

      {/* Action Button */}
      <button
        onClick={handleFollowClick}
        className={`w-full min-h-11 py-2 rounded-xl text-[13px] font-bold transition-all cursor-pointer ${
          isFollowing
            ? 'bg-zinc-800 text-zinc-400 hover:text-zinc-100 border border-zinc-700/60'
            : 'ns-button-primary'
        }`}
        aria-pressed={isFollowing}
      >
        {isSubmitting ? t('actions.saving') : isFollowing ? t('actions.following') : t('actions.follow')}
      </button>
    </div>
  );
}
