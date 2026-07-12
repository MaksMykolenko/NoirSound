import React from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="relative flex min-h-[58vh] flex-col items-center justify-center overflow-hidden rounded-lg border border-zinc-800/60 bg-zinc-950/35 px-6 py-12 text-center">
      <span className="ns-eyebrow relative mb-3 text-brand-red">Lost in the static</span>
      <h1 className="relative mb-4 font-display text-7xl font-semibold tracking-tighter text-brand-red sm:text-8xl">
        404
      </h1>
      <h2 className="relative mb-2 font-display text-xl font-semibold text-zinc-100">This signal went dark</h2>
      <p className="text-sm leading-relaxed text-zinc-400 max-w-md mx-auto mb-8 relative">
        The page may have moved, been removed, or never existed in this part of NoirSound.
      </p>
      <Link
        to="/"
        className="ns-button-primary relative flex items-center space-x-2 rounded-md px-6"
      >
        <Home size={18} />
        <span>Return Home</span>
      </Link>
    </div>
  );
}
