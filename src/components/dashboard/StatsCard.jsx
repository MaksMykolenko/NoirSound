import React from 'react';
import * as Icons from 'lucide-react';

export default function StatsCard({ title, value, change, iconName, trend = 'up' }) {
  const Icon = Icons[iconName] || Icons.BarChart3;

  return (
    <div className="p-5 ns-card ns-card-interactive relative overflow-hidden group">
      {/* Decorative background glow */}
      <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-brand-red/5 rounded-full blur-2xl group-hover:bg-brand-red/10 transition-all duration-500"></div>

      <div className="flex justify-between items-start mb-4">
        <span className="text-[12px] uppercase text-zinc-400 font-bold tracking-wider">{title}</span>
        <div className="p-2.5 bg-zinc-900 border border-zinc-800 text-brand-red rounded-xl">
          <Icon size={18} />
        </div>
      </div>

      <div className="flex items-baseline space-x-3">
        <span className="text-2xl font-bold font-display text-zinc-100">{value}</span>
        {change && (
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              trend === 'up'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}
          >
            {change}
          </span>
        )}
      </div>
    </div>
  );
}
