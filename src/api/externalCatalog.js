import { apiFetch } from './client';
const base='/external-catalog';
export function catalogRequest(path='',options={}) {return apiFetch(base+path,{suppressErrorToast:true,...options});}
export function catalogMutation(path,body,method='POST') {return catalogRequest(path,{method,body:JSON.stringify(body)});}
export async function saveCatalogTrack(track,signal) {
  if(!track.previewExternalId || track.recordingId)return track;
  const {recording}=await catalogRequest('/import',{method:'POST',body:JSON.stringify({provider:track.provider || 'AUDIUS',externalId:track.previewExternalId}),signal});
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('noirsound:external-catalog-changed'));
  return recording;
}
export function resolvePlatformEmbed(provider,url,signal) {
  return catalogRequest('/embed?'+new URLSearchParams({provider,url}),{signal});
}
export function resolveExternalPlayback(track,signal) {
  const path=track.previewExternalId?`/preview/${encodeURIComponent(track.previewExternalId)}/playback`:`/recordings/${encodeURIComponent(track.recordingId)}/playback?sourceId=${encodeURIComponent(track.selectedSourceId)}`;
  return catalogRequest(path,{signal});
}
export function recordExternalPlay(track,durationListenedSeconds,completed) {
  if(!track.recordingId || !track.selectedSourceId)return Promise.resolve({success:false});
  return catalogMutation(`/recordings/${encodeURIComponent(track.recordingId)}/play-event`,{sourceId:track.selectedSourceId,durationListenedSeconds:Math.round(durationListenedSeconds),completed});
}
