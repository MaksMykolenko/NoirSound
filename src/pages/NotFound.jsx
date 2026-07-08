import React from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="ns-card flex flex-col items-center justify-center min-h-[58vh] px-6 py-12 text-center overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--ns-accent-glow-soft),transparent_48%)] pointer-events-none" />
      <span className="ns-eyebrow text-brand-red mb-3 relative">Lost in the static</span>
      <h1 className="text-8xl sm:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-red to-rose-300 mb-4 tracking-tighter relative">
        404
      </h1>
      <h2 className="text-2xl font-bold text-zinc-100 mb-2 relative">This signal went dark</h2>
      <p className="text-sm leading-relaxed text-zinc-400 max-w-md mx-auto mb-8 relative">
        The page may have moved, been removed, or never existed in this part of NoirSound.
      </p>
      <Link
        to="/"
        className="ns-button-primary flex items-center space-x-2 px-6 rounded-full relative"
      >
        <Home size={18} />
        <span>Return Home</span>
      </Link>
    </div>
  );
}
