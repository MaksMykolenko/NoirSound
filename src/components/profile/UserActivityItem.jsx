import React from 'react';
import { Heart, UserPlus, ListMusic, Play, Plus, Activity } from 'lucide-react';

export default function UserActivityItem({ item }) {
  const getIcon = () => {
    switch (item.type) {
      case 'like':
        return <Heart size={14} className="text-rose-500 fill-rose-500/20" />;
      case 'follow':
        return <UserPlus size={14} className="text-blue-400" />;
      case 'playlist':
        return <ListMusic size={14} className="text-brand-purple" />;
      case 'play':
        return <Play size={14} className="text-emerald-400 fill-emerald-400/20" />;
      case 'playlist-add':
        return <Plus size={14} className="text-zinc-300" />;
      default:
        return <Activity size={14} className="text-brand-red" />;
    }
  };

  return (
    <div className="flex items-start gap-3 border-b border-zinc-800/60 px-1 py-3 transition-colors hover:bg-zinc-900/30">
      <div className="mt-0.5 shrink-0 p-2">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-relaxed text-zinc-300">
          {item.text}
        </p>
        <span className="mt-1 block font-sans tabular-nums text-ns-meta text-zinc-600">{item.timestamp}</span>
      </div>
    </div>
  );
}
