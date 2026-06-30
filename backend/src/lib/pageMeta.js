'use strict';

/**
 * Pure route-metadata builders. Each takes already-fetched, already-visibility-
 * filtered records (the route layer enforces published/active) plus a canonical
 * base URL, and returns a plain meta object consumed by metaRenderer. No I/O.
 */

const SITE_NAME = 'NoirSound';
const DEFAULT_DESCRIPTION =
  'Discover independent music, upload your own tracks, and build your audience on NoirSound.';

const LEGAL_PAGES = {
  terms: { title: 'Terms of Service — NoirSound', description: 'The terms that govern your use of NoirSound.' },
  privacy: { title: 'Privacy Policy — NoirSound', description: 'How NoirSound collects, uses, and protects your data.' },
  guidelines: { title: 'Community Guidelines — NoirSound', description: 'The rules that keep NoirSound safe and welcoming for listeners and creators.' },
  copyright: { title: 'Copyright Policy — NoirSound', description: "NoirSound's copyright and DMCA policy for creators and rights holders." },
  abuse: { title: 'Report Abuse — NoirSound', description: 'How to report abuse or policy violations on NoirSound.' },
  'creator-rules': { title: 'Creator Upload Rules — NoirSound', description: 'What you can and cannot upload as a NoirSound creator.' }
};

function trimSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function abs(base, path) {
  if (/^https?:\/\//i.test(path)) return path;
  const b = trimSlash(base);
  return `${b}${path.startsWith('/') ? '' : '/'}${path}`;
}

function truncate(value, max = 160) {
  const s = String(value || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

function imageTypeFromUrl(url) {
  if (/\.png(\?|$)/i.test(url)) return 'image/png';
  if (/\.jpe?g(\?|$)/i.test(url)) return 'image/jpeg';
  if (/\.webp(\?|$)/i.test(url)) return 'image/webp';
  if (/\.gif(\?|$)/i.test(url)) return 'image/gif';
  return undefined;
}

function isoDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `PT${minutes}M${rest}S`;
}

function humanDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function genreLabel(genre) {
  if (!genre) return null;
  return String(genre)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function homeMeta(base) {
  const url = `${trimSlash(base)}/`;
  return {
    title: 'NoirSound — Creator-first music platform',
    description: DEFAULT_DESCRIPTION,
    canonical: url,
    url,
    type: 'website',
    siteName: SITE_NAME,
    image: abs(base, '/og/noirsound-cover.png'),
    imageType: 'image/png',
    imageWidth: 1200,
    imageHeight: 630,
    imageAlt: 'NoirSound — creator-first music platform',
    twitterCard: 'summary_large_image',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: trimSlash(base),
      potentialAction: {
        '@type': 'SearchAction',
        target: `${trimSlash(base)}/discover?q={search_term_string}`,
        'query-input': 'required name=search_term_string'
      }
    }
  };
}

function legalMeta(slug, base) {
  const page = LEGAL_PAGES[slug];
  if (!page) return null;
  const url = `${trimSlash(base)}/${slug}`;
  return {
    title: page.title,
    description: page.description,
    canonical: url,
    url,
    type: 'website',
    siteName: SITE_NAME,
    image: abs(base, '/og/noirsound-cover.png'),
    imageType: 'image/png',
    imageWidth: 1200,
    imageHeight: 630,
    imageAlt: 'NoirSound',
    twitterCard: 'summary_large_image'
  };
}

/** track: { id, title, genre, durationSeconds, description, artist: { user: { displayName } } } */
function trackMeta(track, base) {
  const artistName = track?.artist?.user?.displayName || 'NoirSound artist';
  const url = `${trimSlash(base)}/track/${track.id}`;
  const label = genreLabel(track.genre);

  const parts = [];
  if (label) parts.push(label);
  if (track.durationSeconds) parts.push(humanDuration(track.durationSeconds));
  let description = parts.join(' · ');
  if (track.description) {
    const snippet = truncate(track.description, 120);
    description = description ? `${description} · ${snippet}` : snippet;
  }
  if (!description) description = `Listen to ${track.title} by ${artistName} on NoirSound.`;

  return {
    title: `${track.title} — ${artistName} | NoirSound`,
    ogTitle: `${track.title} — ${artistName}`,
    description: truncate(description, 200),
    canonical: url,
    url,
    type: 'music.song',
    siteName: SITE_NAME,
    // Controlled, public, no-auth cover route (never exposes private storage keys).
    image: `${trimSlash(base)}/api/public/covers/${track.id}`,
    imageType: 'image/jpeg',
    imageAlt: `${track.title} — cover art`,
    twitterCard: 'summary_large_image',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'MusicRecording',
      name: track.title,
      byArtist: { '@type': 'MusicGroup', name: artistName },
      ...(track.durationSeconds ? { duration: isoDuration(track.durationSeconds) } : {}),
      ...(label ? { genre: label } : {}),
      url
    }
  };
}

function trackUnavailableMeta(base, id) {
  const url = id ? `${trimSlash(base)}/track/${id}` : `${trimSlash(base)}/`;
  return {
    title: 'Track unavailable — NoirSound',
    description: 'This track is not available on NoirSound.',
    url,
    type: 'website',
    siteName: SITE_NAME,
    image: abs(base, '/og/default-track.png'),
    imageType: 'image/png',
    imageWidth: 1200,
    imageHeight: 630,
    imageAlt: 'NoirSound',
    twitterCard: 'summary_large_image',
    robots: 'noindex'
  };
}

function artistImage(base, avatarUrl) {
  if (avatarUrl && /^https?:\/\//i.test(avatarUrl)) return avatarUrl;
  if (avatarUrl && avatarUrl.startsWith('/')) return abs(base, avatarUrl);
  return abs(base, '/og/default-artist.png');
}

/** artist: { id, user: { displayName, bio, avatarUrl } } — role is never exposed. */
function artistMeta(artist, base) {
  const user = artist.user || {};
  const name = user.displayName || 'NoirSound artist';
  const url = `${trimSlash(base)}/artist/${artist.id}`;
  const description = user.bio
    ? truncate(user.bio, 200)
    : `${name} is an independent artist on NoirSound. Listen to releases and follow new music.`;
  const image = artistImage(base, user.avatarUrl);
  return {
    title: `${name} — NoirSound`,
    ogTitle: `${name} — NoirSound`,
    description,
    canonical: url,
    url,
    type: 'profile',
    siteName: SITE_NAME,
    image,
    imageType: imageTypeFromUrl(image),
    imageAlt: `${name} on NoirSound`,
    twitterCard: 'summary_large_image',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'MusicGroup',
      name,
      url
    }
  };
}

function artistUnavailableMeta(base, id) {
  const url = id ? `${trimSlash(base)}/artist/${id}` : `${trimSlash(base)}/`;
  return {
    title: 'Artist unavailable — NoirSound',
    description: 'This artist profile is not available on NoirSound.',
    url,
    type: 'website',
    siteName: SITE_NAME,
    image: abs(base, '/og/default-artist.png'),
    imageType: 'image/png',
    imageWidth: 1200,
    imageHeight: 630,
    imageAlt: 'NoirSound',
    twitterCard: 'summary_large_image',
    robots: 'noindex'
  };
}

module.exports = {
  SITE_NAME,
  DEFAULT_DESCRIPTION,
  LEGAL_PAGES,
  trimSlash,
  abs,
  truncate,
  imageTypeFromUrl,
  isoDuration,
  humanDuration,
  genreLabel,
  homeMeta,
  legalMeta,
  trackMeta,
  trackUnavailableMeta,
  artistMeta,
  artistUnavailableMeta
};
