'use strict';
const { CatalogError, versionFromTitle } = require('./externalCatalog');
const MAX_IMPORT_TRACKS = 200;
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
function parseDelimited(text, delimiter) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (!quoted && cell) fail('IMPORT_FILE_INVALID');
      else quoted = !quoted;
    } else if (!quoted && (c === delimiter || c === '\n')) {
      row.push(cell.replace(/\r$/, '')); cell = '';
      if (c === '\n') { if (row.some(Boolean)) rows.push(row); row = []; }
    } else cell += c;
  }
  if (quoted) fail('IMPORT_FILE_INVALID');
  row.push(cell.replace(/\r$/, '')); if (row.some(Boolean)) rows.push(row);
  return rows;
}
function parseImportFile(input) {
  if (typeof input !== 'string' || input.length > 150000) fail('IMPORT_FILE_INVALID');
  const text = input.replace(/^\uFEFF/, '').trim();
  const headerLine = text.split('\n')[0];
  const delimiter = headerLine.includes('\t') ? '\t' : headerLine.includes(';') && !headerLine.includes(',') ? ';' : ',';
  const rows = parseDelimited(text, delimiter), header = (rows[0] || []).map(normalize);
  const titleIndex = header.findIndex(h => ['title','track name','track','name'].includes(h));
  const artistIndex = header.findIndex(h => ['artist','artists','artist name','artist name s','artist names'].includes(h));
  const durationIndex = header.findIndex(h => ['duration','duration ms','duration seconds'].includes(h));
  const isCsv = titleIndex >= 0 && artistIndex >= 0;
  const entries = isCsv ? rows.slice(1).map(row => {
    const raw = row[durationIndex] || '', parts = raw.split(':');
    let seconds = parts.length === 2 ? Number(parts[0]) * 60 + Number(parts[1]) : Number(raw);
    if (header[durationIndex] === 'duration ms') seconds /= 1000;
    return { title: String(row[titleIndex] || '').trim().slice(0,300), artist: String(row[artistIndex] || '').trim().slice(0,200), duration: Number.isFinite(seconds) && seconds > 0 && seconds <= 36000 ? seconds : null };
  }) : text.split(/\r?\n/).filter(line => line.trim()).map(line => {
    const split = line.match(/^(.+?)\s+[-–—]\s+(.+)$/);
    if (!split) fail('IMPORT_FILE_INVALID');
    return { artist: split[1].trim().slice(0,200), title: split[2].trim().slice(0,300), duration: null };
  });
  if (!entries.length || entries.some(e => !e.title || !e.artist)) fail('IMPORT_FILE_INVALID');
  if (entries.length > MAX_IMPORT_TRACKS) fail('IMPORT_TOO_LARGE');
  return entries;
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
module.exports = { MAX_IMPORT_TRACKS, playlistLink, parseImportFile, candidateScore, rankCandidates };
