import { useEffect } from 'react';

/**
 * Client-side metadata sync for browser-tab correctness during SPA navigation.
 *
 * This is NOT the source of truth for social/crawler previews — those come from
 * the server-rendered <head> (see backend/src/routes/pages.js). This only keeps
 * the document title / description / canonical accurate as the user navigates
 * between routes after the React app has booted.
 */
function upsertMeta(name, content) {
  if (typeof document === 'undefined' || content == null) return;
  let el = document.head.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href) {
  if (typeof document === 'undefined' || !href) return;
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export default function PageMeta({ title, description, canonical }) {
  useEffect(() => {
    if (title) document.title = title;
    if (description) upsertMeta('description', description);
    if (canonical) upsertCanonical(canonical);
  }, [title, description, canonical]);

  return null;
}
