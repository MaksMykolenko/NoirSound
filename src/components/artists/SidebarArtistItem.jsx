import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import FallbackAvatar from '../ui/FallbackAvatar';
import { MoreHorizontal } from 'lucide-react';
import { useArtistContextMenu } from '../../hooks/useEntityContextMenu';

export default function SidebarArtistItem({ artist }) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = location.pathname === `/artist/${artist.id}`;
  const { contextMenuProps, openFromButton } = useArtistContextMenu(artist);

  const handleRowClick = () => {
    navigate(`/artist/${artist.id}`);
  };

  return (
    <div
      onClick={handleRowClick}
      onContextMenu={contextMenuProps.onContextMenu}
      onKeyDown={(event) => {
        contextMenuProps.onKeyDown(event);
        if (event.defaultPrevented) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleRowClick();
        }
      }}
      role="link"
      tabIndex={0}
      className={`group flex h-14 cursor-pointer items-center space-x-3 p-2 rounded-md border transition-colors duration-150 ${
        isActive
          ? 'border-brand-red/30 bg-brand-red/5 text-brand-red'
          : 'border-transparent bg-transparent hover:border-zinc-800/60 hover:bg-zinc-900/45'
      }`}
    >
      {/* Circle Avatar */}
      <FallbackAvatar
        src={artist.avatarUrl}
        name={artist.name}
        className="w-11 h-11 rounded-full border border-zinc-900 shrink-0 text-[42px]"
        imageClassName="object-cover"
      />

      {/* Name Details */}
      <div className="min-w-0 flex-1">
        <h5 className={`text-[14.5px] font-bold truncate tracking-tight leading-snug ${
          isActive ? 'text-brand-red' : 'text-zinc-300 group-hover:text-white'
        }`}>
          {artist.name}
        </h5>
        <p className="text-[12.5px] text-zinc-400 truncate mt-0.5 font-medium">Artist</p>
      </div>
      <button
        type="button"
        onClick={openFromButton}
        className="ns-icon-button !min-h-9 !min-w-9 shrink-0 text-zinc-500 opacity-0 group-hover:opacity-100 focus:opacity-100"
        aria-label={`More actions for ${artist.name}`}
        aria-haspopup="menu"
      >
        <MoreHorizontal size={14} />
      </button>
    </div>
  );
}
