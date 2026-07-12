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
    <div className="flex items-start gap-3 rounded-md border border-zinc-800/60 bg-zinc-950/35 p-3 transition-colors hover:border-zinc-700/70 hover:bg-zinc-900/40">
      <div className="mt-0.5 shrink-0 rounded border border-zinc-800 bg-zinc-950 p-2">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium leading-relaxed text-zinc-300">
          {item.text}
        </p>
        <span className="mt-1 block font-mono text-[9px] text-zinc-600">{item.timestamp}</span>
      </div>
    </div>
  );
}
