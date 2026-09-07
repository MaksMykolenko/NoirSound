import { useEffect } from 'react';
import { setBaseTitle } from '../../utils/pageTitle';

/**
 * Client-side metadata sync for browser-tab correctness during SPA navigation.
 *
 * This is NOT the source of truth for social/crawler previews — those come from
 * the server-rendered <head> (see backend/src/routes/pages.js). This only keeps
 * document title, social tags, description, and canonical accurate as the user navigates
 * between routes after the React app has booted.
 */
function upsertMeta(name, content, attribute = 'name') {
  if (typeof document === 'undefined' || content == null) return;
  let el = document.head.querySelector(`meta[${attribute}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attribute, name);
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

export default function PageMeta({ title, description, canonical, image, type, robots }) {
  useEffect(() => {
    if (title) {
      setBaseTitle(title);
      document.title = title;
    }
    const pageDescription = description || '';
    upsertMeta('description', pageDescription);
    upsertMeta('og:title', title || 'NoirSound', 'property');
    upsertMeta('og:description', pageDescription, 'property');
    upsertMeta('twitter:title', title || 'NoirSound');
    upsertMeta('twitter:description', pageDescription);
    upsertMeta('twitter:card', 'summary_large_image');
    upsertMeta('og:site_name', 'NoirSound', 'property');
    if (robots) upsertMeta('robots', robots);
    else document.head.querySelectorAll('meta[name="robots"]').forEach(node => node.remove());

    if (canonical) {
      upsertCanonical(canonical);
      upsertMeta('og:url', canonical, 'property');
      const url = new URL(canonical, window.location.origin);
      const trackId = url.pathname.match(/^\/track\/([^/]+)$/)?.[1];
      const playlistId = url.pathname.match(/^\/playlist\/([^/]+)$/)?.[1];
      const isArtist = /^\/artist\/[^/]+$/.test(url.pathname);
      const defaultImage = trackId ? `/api/public/covers/${trackId}`
        : playlistId ? `/api/public/playlist-covers/${playlistId}`
          : isArtist ? '/og/default-artist.png' : '/og/noirsound-cover.png';
      let pageImage = new URL(defaultImage, url.origin).href;
      if (image) {
        try {
          const candidate = new URL(image, url.origin);
          if (['https:', 'http:'].includes(candidate.protocol)) pageImage = candidate.href;
        } catch { /* A malformed public avatar must not break route metadata. */ }
      }
      upsertMeta('og:type', type || (trackId ? 'music.song' : playlistId ? 'music.playlist' : isArtist ? 'profile' : 'website'), 'property');
      for (const property of ['og:image', 'og:image:secure_url']) upsertMeta(property, pageImage, 'property');
      upsertMeta('twitter:image', pageImage);
      upsertMeta('og:image:alt', title || 'NoirSound', 'property');
      upsertMeta('twitter:image:alt', title || 'NoirSound');
      // Dimensions and MIME from an earlier release must not describe another
      // route's cover or avatar. The server supplies them on direct requests.
      for (const property of ['og:image:width', 'og:image:height', 'og:image:type']) {
        document.head.querySelectorAll(`meta[property="${property}"]`).forEach(node => node.remove());
      }
      // Preserve server-provided structured data for this same route, but never
      // keep a previous track, artist, or homepage schema after SPA navigation.
      document.head.querySelectorAll('script[type="application/ld+json"]').forEach(node => {
        try {
          const data = JSON.parse(node.textContent);
          const records = Array.isArray(data) ? data : [data];
          if (!records.every(record => String(record.url || '').replace(/\/$/, '') === canonical.replace(/\/$/, ''))) node.remove();
        } catch { node.remove(); }
      });
    }
  }, [title, description, canonical, image, type, robots]);

  return null;
}
