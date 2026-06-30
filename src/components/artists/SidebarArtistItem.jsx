import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import FallbackAvatar from '../ui/FallbackAvatar';

export default function SidebarArtistItem({ artist }) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = location.pathname === `/artist/${artist.id}`;

  const handleRowClick = () => {
    navigate(`/artist/${artist.id}`);
  };

  return (
    <div
      onClick={handleRowClick}
      className={`group flex items-center space-x-3.5 p-2.5 rounded-xl transition-all duration-200 cursor-pointer border h-[64px] ${
        isActive
          ? 'bg-brand-red/10 border-brand-red/20 text-brand-red shadow-[0_0_12px_var(--ns-accent-glow-soft)]'
          : 'bg-zinc-900/12 border-zinc-900/45 hover:bg-zinc-900/55 hover:border-zinc-800/65'
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
    </div>
  );
}
