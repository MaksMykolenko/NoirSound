import { apiFetch } from './client';
export const importStatus = signal => apiFetch('/playlist-import/status', { signal, suppressErrorToast:true });
const post = (path, payload, signal) => apiFetch('/playlist-import/'+path,{method:'POST',body:JSON.stringify(payload),signal,suppressErrorToast:true});
export const previewImport = (payload,signal) => post('preview',payload,signal);
export const matchImport = (entries,signal) => post('matches',{entries},signal);
export const commitImport = (payload,signal) => post('commit',payload,signal);
export const connectSpotifyImport = () => post('spotify/connect',{});
export const disconnectSpotifyImport = () => apiFetch('/playlist-import/spotify',{method:'DELETE',suppressErrorToast:true});
