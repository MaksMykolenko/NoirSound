'use strict';
const { CatalogError, versionFromTitle } = require('./externalCatalog');
const MAX_IMPORT_TRACKS = 1000;
const fail = code => { throw new CatalogError(code, 400); };
const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function playlistLink(value) {
  let url; try { url = new URL(value); } catch { fail('IMPORT_URL_INVALID'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) fail('IMPORT_URL_INVALID');
  const host = url.hostname, path = url.pathname;
  const spotify = path.match(/^\/(?:intl-[a-z]{2}\/)?playlist\/([A-Za-z0-9]{22})\/?$/);
  if (host === 'open.spotify.com' && spotify) return { provider: 'SPOTIFY', id: spotify[1] };
  const youtube = url.searchParams.get('list');
  if (['www.youtube.com', 'youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host) && /^[A-Za-z0-9_-]{10,100}$/.test(youtube || '') && (/^\/(playlist|watch)\/?$/.test(path) || host === 'youtu.be')) return { provider: 'YOUTUBE', id: youtube };
  if (['soundcloud.com', 'www.soundcloud.com'].includes(host) && /^\/[\w-]+\/sets\/[\w-]+\/?$/.test(path)) return { provider: 'SOUNDCLOUD', url: 'https://soundcloud.com' + path.replace(/\/$/, '') };
  fail('IMPORT_URL_INVALID');
}
function candidateScore(entry, candidate) {
  if (versionFromTitle(entry.title) !== versionFromTitle(candidate.title)) return 0;
  const title = normalize(entry.title), other = normalize(candidate.title);
  const artist = normalize(entry.artist), otherArtist = normalize(candidate.artistName);
  if (!title || !other) return 0;
  const sameTitle = title === other, sameArtist = artist && artist === otherArtist;
  const knownDuration = Number(entry.duration) > 0 && Number(candidate.duration) > 0;
  const delta = knownDuration ? Math.abs(entry.duration - candidate.duration) : null;
  if (delta > 12) return 0;
  if (sameTitle && sameArtist && delta !== null && delta <= 3 && !entry.needsReview) return 100;
  if (sameTitle && sameArtist) return 90;
  if (sameTitle) return 60;
  const words = new Set(title.split(' ')), otherWords = new Set(other.split(' '));
  const overlap = [...words].filter(word => otherWords.has(word)).length / Math.max(words.size, otherWords.size);
  return sameArtist && overlap >= 0.75 ? 50 : 0;
}
function rankCandidates(entry, candidates) {
  const seen = new Set();
  const matches = candidates.map(c => ({ ...c, score: candidateScore(entry,c) })).filter(c => {
    if (!c.score || seen.has(c.key)) return false; seen.add(c.key); return true;
  }).sort((a,b) => b.score-a.score).slice(0,5);
  return { candidates: matches, selected: matches[0]?.score === 100 && matches[1]?.score !== 100 ? matches[0].key : null };
}
module.exports = { MAX_IMPORT_TRACKS, playlistLink, candidateScore, rankCandidates };
