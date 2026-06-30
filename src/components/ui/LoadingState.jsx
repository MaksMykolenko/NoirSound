import React from 'react';

export default function LoadingState({ type = 'grid', count = 4 }) {
  if (type === 'list') {
    return (
      <div className="space-y-3 w-full">
        {Array.from({ length: count }).map((_, idx) => (
          <div
            key={idx}
            className="flex items-center space-x-4 p-3 ns-card animate-pulse"
          >
            <div className="w-12 h-12 bg-zinc-800 rounded-lg"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-zinc-800 rounded w-1/3"></div>
              <div className="h-3 bg-zinc-800 rounded w-1/4"></div>
            </div>
            <div className="w-16 h-3 bg-zinc-800 rounded"></div>
            <div className="w-8 h-8 bg-zinc-800 rounded-full"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 min-[430px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 w-full">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="flex flex-col space-y-3 p-3 ns-card animate-pulse"
        >
          <div className="aspect-square bg-zinc-800 rounded-lg w-full"></div>
          <div className="h-4 bg-zinc-800 rounded w-3/4"></div>
          <div className="h-3 bg-zinc-800 rounded w-1/2"></div>
        </div>
      ))}
    </div>
  );
}
