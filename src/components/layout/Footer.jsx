import React from 'react';
import { Link } from 'react-router-dom';
import { LEGAL_NAV } from '../../constants/legalContent';

/**
 * Lightweight footer with legal/policy links. Rendered at the bottom of the
 * main scroll area so the required public-beta legal surfaces are reachable
 * from anywhere in the app.
 */
export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-12 border-t border-[var(--ns-border-subtle)] pb-2 pt-6 font-mono text-[10px] text-zinc-500">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {LEGAL_NAV.map((item) => (
          <Link key={item.slug} to={item.path} className="hover:text-zinc-300 transition-colors">
            {item.label}
          </Link>
        ))}
      </div>
      <p className="mt-3 text-zinc-600">
        © {year} NoirSound · Independent music platform · Public beta
      </p>
    </footer>
  );
}
