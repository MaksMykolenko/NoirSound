'use strict';
const { isIP } = require('node:net');
const { auditData } = require('./auditLog');
const { resolveAuthenticatedSession } = require('./sessionResolver');
const PROVIDERS = ['AUDIUS', 'SPOTIFY', 'SOUNDCLOUD', 'APPLE_MUSIC', 'YOUTUBE'];
const VERSIONS = ['UNKNOWN', 'ORIGINAL', 'REMIX', 'LIVE', 'ACOUSTIC', 'INSTRUMENTAL', 'RADIO_EDIT', 'CLEAN', 'EXPLICIT', 'NIGHTCORE', 'SPED_UP', 'SLOWED', 'OTHER'];
class CatalogError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.statusCode = status; }
}
const fail = (code, status) => { throw new CatalogError(code, status); };
function platformUrl(provider, input) {
  if (!PROVIDERS.includes(provider) || typeof input !== 'string' || input.length > 1000) fail('EXTERNAL_URL_INVALID');
  let u; try { u = new URL(input); } catch { fail('EXTERNAL_URL_INVALID'); }
  if (u.protocol !== 'https:' || u.username || u.password || u.port || isIP(u.hostname) || /%|\\/.test(u.pathname)) fail('EXTERNAL_URL_INVALID');
  const hosts = { AUDIUS: ['audius.co', 'www.audius.co'], SPOTIFY: ['open.spotify.com'], SOUNDCLOUD: ['soundcloud.com', 'www.soundcloud.com'], APPLE_MUSIC: ['music.apple.com'], YOUTUBE: ['www.youtube.com', 'youtube.com', 'music.youtube.com', 'youtu.be'] };
  if (!hosts[provider].includes(u.hostname)) fail('EXTERNAL_URL_INVALID');
  const parts = u.pathname.split('/').filter(Boolean);
  let id = null;
  if (provider === 'AUDIUS') { if (parts.length !== 2 || parts.some(p => !/^[\w-]+$/.test(p)) || ['playlists', 'albums', 'users'].includes(parts[0])) fail('EXTERNAL_TRACK_URL_REQUIRED'); }
  if (provider === 'SPOTIFY') { if (parts.length !== 2 || parts[0] !== 'track' || !/^[a-zA-Z0-9]{22}$/.test(parts[1])) fail('EXTERNAL_TRACK_URL_REQUIRED'); id = parts[1]; }
  if (provider === 'SOUNDCLOUD' && (parts.length !== 2 || parts[1] === 'sets' || parts.some(p => !/^[\w-]+$/.test(p)))) fail('EXTERNAL_TRACK_URL_REQUIRED');
  if (provider === 'APPLE_MUSIC') { id = u.searchParams.get('i') || (parts[1] === 'song' ? parts.at(-1) : null); if (!/^[a-z]{2}$/.test(parts[0] || '') || !['album', 'song'].includes(parts[1]) || parts.length < 3 || !/^\d+$/.test(id || '')) fail('EXTERNAL_TRACK_URL_REQUIRED'); }
  if (provider === 'YOUTUBE') { id = u.hostname === 'youtu.be' && parts.length === 1 ? parts[0] : parts.length === 1 && parts[0] === 'watch' ? u.searchParams.get('v') : parts.length === 2 && parts[0] === 'shorts' ? parts[1] : null; if (!/^[\w-]{11}$/.test(id || '')) fail('EXTERNAL_TRACK_URL_REQUIRED'); return { canonicalUrl: `https://www.youtube.com/watch?v=${id}`, externalId: id }; }
  u.hostname = hosts[provider][0];u.hash = '';u.search = '';u.pathname = '/' + parts.join('/');
  if (provider === 'APPLE_MUSIC' && parts[1] === 'album') u.searchParams.set('i', id);
  return { canonicalUrl: u.href, externalId: id };
}
function versionFromTitle(title, remixOf) {
  if (remixOf?.tracks?.length || /\b(remix|bootleg|mashup)\b/i.test(title)) return 'REMIX';
  for (const [regex,type] of [[/\bnightcore\b/i,'NIGHTCORE'],[/\bsped[ -]?up\b/i,'SPED_UP'],[/\bslowed\b/i,'SLOWED'],[/\blive\b/i,'LIVE'],[/\bacoustic\b/i,'ACOUSTIC'],[/\binstrumental\b/i,'INSTRUMENTAL'],[/\bradio[ -]?edit\b/i,'RADIO_EDIT'],[/\bclean\b/i,'CLEAN'],[/\bexplicit\b/i,'EXPLICIT']]) if (regex.test(title)) return type;
  return 'UNKNOWN';
}
const normalized = s => String(s || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function matchAssessment(a,b) {
  const av = versionFromTitle(a.track.title), bv = versionFromTitle(b.track.title);
  if (a.versionType !== b.versionType || av !== bv || (a.versionLabel && b.versionLabel && normalized(a.versionLabel)!==normalized(b.versionLabel)) || normalized(a.track.primaryArtistName) !== normalized(b.track.primaryArtistName) || Boolean(a.track.explicit) !== Boolean(b.track.explicit) || Math.abs(a.track.durationSeconds - b.track.durationSeconds) > 3) return 'CONFLICT';
  if (a.isrc && a.isrc === b.isrc && a.versionType !== 'UNKNOWN') return 'STRONG_ISRC';
  return 'MANUAL_REVIEW';
}
function allowRole(user) {
  const ids = String(process.env.EXTERNAL_CATALOG_ADMIN_IDS || '').split(',').map(s=>s.trim()).filter(Boolean);
  return user?.role === 'ADMIN' && (!ids.length || ids.includes(user.id));
}
async function betaEnabled(prisma) {
  if (process.env.EXTERNAL_CATALOG_ENABLED !== 'true') return false;
  const setting = await prisma.externalCatalogSetting.findUnique({where:{id:'beta'}});
  return setting ? setting.enabled : true;
}
const publicBeta = () => process.env.EXTERNAL_CATALOG_PUBLIC === 'true';
async function canUseBeta(prisma,user) { return (publicBeta() || allowRole(user)) && await betaEnabled(prisma); }
async function requestBetaUser(fastify,request) {
  const resolved = request.user ? {user:request.user} : await resolveAuthenticatedSession(fastify,request);
  return await canUseBeta(fastify.prisma,resolved?.user) ? (resolved?.user || {id:'public-catalog',publicCatalogGuest:true}) : null;
}
const includeRecording = {track:true,sources:true,members:{include:{track:true,sources:true}}};
function recordingView(r, now = Date.now()) {
  const members = [r,...(r.members || [])];
  const expired = (r.metadataExpiresAt && new Date(r.metadataExpiresAt).getTime() < now) || (r.metadataProvenance?.endsWith('_PUBLIC_API') && !r.metadataExpiresAt);
  const sources = members.flatMap(x => x.sources || []).sort((a,b) => Number(b.officialStatus === 'VERIFIED' && b.matchStatus === 'CONFIRMED')-Number(a.officialStatus === 'VERIFIED' && a.matchStatus === 'CONFIRMED') || Number(b.isPrimary)-Number(a.isPrimary) || a.createdAt-b.createdAt);
  const candidates=sources.filter(s=>s.matchStatus!=='REJECTED' && s.officialStatus!=='REJECTED');
  const primarySources = [...new Set(candidates.map(x=>x.provider))].map(p=>candidates.find(x=>x.provider===p));
  const stream = primarySources.find(x=>x.playbackMode==='EXTERNAL_STREAM' && x.availability==='AVAILABLE' && x.matchStatus==='CONFIRMED');
  const embed = primarySources.find(x=>['SOUNDCLOUD','APPLE_MUSIC','YOUTUBE'].includes(x.provider) && x.matchStatus==='CONFIRMED' && !['UNAVAILABLE','ERROR'].includes(x.availability));
  const selected = stream || embed || primarySources[0];
  const native = r.track.catalogScope === 'NATIVE' && Boolean(r.track.processedAudioKey);
  return { id:r.trackId,recordingId:r.id,title:expired?'Metadata refresh required':r.track.title,artistName:expired?(selected?.provider || 'External'):r.track.primaryArtistName || 'Unknown artist',artistId:native?r.track.artistId:null,coverUrl:expired?null:r.track.coverUrl,duration:r.track.durationSeconds,contentType:'MUSIC',isStreamable:!expired && (native || Boolean(stream)),isAvailable:!expired && (native || Boolean(selected)),canSave:!expired && Boolean(native || selected),playbackMode:native?'NATIVE':stream?'EXTERNAL_STREAM':embed?'OFFICIAL_EMBED':'LINK_OUT',playbackSource:native?'native':'external',provider:native?'NOIRSOUND':selected?.provider,canonicalUrl:selected?.canonicalUrl || null,selectedSourceId:selected?.id || null,versionType:r.versionType,versionLabel:r.versionLabel,parentId:r.parentId,mergedIntoId:r.mergedIntoId,members:members.slice(1).map(x=>({id:x.id,trackId:x.trackId})),sources:sources.map(publicSource),primarySources:primarySources.map(publicSource),metadataExpired:Boolean(expired),likes:members.reduce((total,r)=>total+Number(r.track.likes || 0),0),hasLyrics:false };
}
function publicSource(s) { const {id,provider,externalId,canonicalUrl,playbackMode,availability,matchStatus,officialStatus,isPrimary,checkedAt}=s;return {id,provider,externalId,canonicalUrl,playbackMode,availability,matchStatus,officialStatus,isPrimary,checkedAt}; }
function visibleRecording(r) { return r.track.catalogScope==='EXTERNAL_BETA' && r.track.status==='PUBLISHED' || r.track.catalogScope==='NATIVE' && r.track.isPublic && r.track.status==='PUBLISHED' && Boolean(r.track.processedAudioKey); }
async function catalogLock(tx) { await tx.$executeRaw`SELECT pg_advisory_xact_lock(746290104)`; }
async function recordAudit(tx,request,action,id,reason,metadata={}) { await tx.auditLog.create({data:auditData(request.user.id,action,'EXTERNAL_RECORDING',id,reason,metadata)}); }
module.exports={PROVIDERS,VERSIONS,CatalogError,fail,platformUrl,versionFromTitle,matchAssessment,allowRole,publicBeta,visibleRecording,betaEnabled,canUseBeta,requestBetaUser,includeRecording,recordingView,catalogLock,recordAudit};
