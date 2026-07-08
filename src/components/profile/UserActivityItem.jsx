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
    <div className="flex gap-4 items-start p-3 bg-brand-graphite/40 border border-zinc-900 rounded-2xl glass-panel-light hover:border-zinc-800 transition-colors">
      <div className="p-2.5 bg-zinc-950/60 border border-zinc-900 rounded-xl shrink-0 mt-0.5">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-zinc-300 leading-relaxed">
          {item.text}
        </p>
        <span className="block text-[10px] text-zinc-600 mt-1 font-semibold">{item.timestamp}</span>
      </div>
    </div>
  );
}
