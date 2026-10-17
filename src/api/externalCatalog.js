import { apiFetch } from './client';
const base='/external-catalog';
export function catalogRequest(path='',options={}) {return apiFetch(base+path,{suppressErrorToast:true,...options});}
export function catalogMutation(path,body,method='POST') {return catalogRequest(path,{method,body:JSON.stringify(body)});}
export async function saveCatalogTrack(track,signal) {
  if(!track.previewExternalId || track.recordingId)return track;
  const {recording}=await catalogRequest('/import',{method:'POST',body:JSON.stringify({provider:track.provider,externalId:track.previewExternalId}),signal});
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('noirsound:external-catalog-changed'));
  return recording;
}
export function resolvePlatformEmbed(provider,url,signal) {
  return catalogRequest('/embed?'+new URLSearchParams({provider,url}),{signal});
}
