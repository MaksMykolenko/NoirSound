import React from 'react';
import * as Icons from 'lucide-react';

export default function StatsCard({ title, value, change, iconName, trend = 'up' }) {
  const Icon = Icons[iconName] || Icons.BarChart3;

  return (
    <div className="group relative overflow-hidden rounded-lg border border-zinc-800/60 bg-zinc-950/35 p-4 transition-colors hover:border-zinc-700/70 hover:bg-zinc-900/40">
      <div className="mb-3 flex items-start justify-between">
        <span className="font-mono text-[9px] font-medium uppercase tracking-wider text-zinc-500">{title}</span>
        <div className="rounded border border-zinc-800 bg-zinc-950 p-2 text-brand-red">
          <Icon size={18} />
        </div>
      </div>

      <div className="flex items-baseline space-x-3">
        <span className="font-display text-xl font-semibold text-zinc-100">{value}</span>
        {change && (
          <span
            className={`rounded border px-2 py-0.5 font-mono text-[9px] font-medium ${
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
