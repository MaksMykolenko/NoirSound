import React from 'react';
import * as Icons from 'lucide-react';

export default function StatsCard({ title, value, change, iconName, trend = 'up' }) {
  const Icon = Icons[iconName] || Icons.BarChart3;

  return (
    <div className="group relative min-w-0 p-4 transition-colors hover:bg-zinc-900/35 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-500">{title}</span>
        <div className="text-brand-red">
          <Icon size={18} />
        </div>
      </div>

      <div className="flex items-baseline space-x-3">
        <span className="font-sans text-2xl font-semibold text-zinc-100">{value}</span>
        {change && (
          <span
            className={`rounded border px-2 py-0.5 font-sans tabular-nums text-ns-meta font-medium ${
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
