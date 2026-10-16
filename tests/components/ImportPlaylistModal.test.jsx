import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ImportPlaylistModal from '../../src/components/playlists/ImportPlaylistModal';
import * as importing from '../../src/api/playlistImport';
import { mapPlaylistResponse } from '../../src/api/mappers/playlistMapper';
vi.mock('../../src/api/playlistImport',()=>({importStatus:vi.fn(),previewImport:vi.fn(),matchImport:vi.fn(),commitImport:vi.fn(),connectSpotifyImport:vi.fn(),disconnectSpotifyImport:vi.fn()}));
vi.mock('react-i18next',()=>{const t=(key,values={})=>key==='playlistImport.confirm'?`Create ${values.count}`:key;return {useTranslation:()=>({t})};});
const entries=Array.from({length:717},(_,i)=>({title:`Position ${i+1}`,artist:'Artist',sourceId:'same-track',selection:`signed-${i}`,unavailable:i===1}));
beforeEach(()=>{
  vi.clearAllMocks();sessionStorage.clear();
  importing.importStatus.mockResolvedValue({providers:{SPOTIFY:true,YOUTUBE:true,SOUNDCLOUD:false},spotifyConnected:true,maxTracks:1000});
  importing.previewImport.mockResolvedValue({name:'Full list',provider:'SPOTIFY',entries,total:717,unavailable:1,preview:'signed-preview'});
  importing.commitImport.mockResolvedValue({id:'saved',trackCount:717});
});
afterEach(cleanup);
async function preview(onImported=vi.fn()) {
  render(<ImportPlaylistModal onClose={vi.fn()} onImported={onImported}/>);
  fireEvent.change(screen.getByLabelText('playlistImport.link'),{target:{value:'https://open.spotify.com/playlist/1234567890123456789012'}});
  fireEvent.click(screen.getByRole('button',{name:'playlistImport.preview'}));
  await screen.findByRole('button',{name:'Create 717'});
}
describe('complete source playlist import',()=>{
  it('renders 50 rows at a time, exposes the last position, and commits all 717 without matching',async()=>{
    const onImported=vi.fn();await preview(onImported);
    expect(screen.getAllByRole('listitem')).toHaveLength(50);
    fireEvent.change(screen.getAllByRole('combobox',{name:'playlistImport.page'})[0],{target:{value:'14'}});
    expect(screen.getAllByRole('listitem')).toHaveLength(17);expect(screen.getByText('Position 717')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Create 717'}));
    await waitFor(()=>expect(onImported).toHaveBeenCalledWith({id:'saved',trackCount:717}));
    expect(importing.commitImport.mock.calls[0][0]).toMatchObject({mode:'source',preview:'signed-preview',selections:entries.map(entry=>entry.selection)});
    expect(importing.matchImport).not.toHaveBeenCalled();
  });
  it('does not let a truncated preview be saved',async()=>{
    importing.previewImport.mockResolvedValue({name:'Partial',entries,total:2000,truncated:true,preview:'signed'});
    await preview();expect(screen.getByRole('button',{name:'Create 717'}).disabled).toBe(true);
    expect(importing.commitImport).not.toHaveBeenCalled();
  });
  it('maps repeated source recordings to distinct playlist positions with preserved playback metadata',()=>{
    const items=[0,1].map(position=>({id:`source:p:${position}`,position,sourceId:'same',provider:'SPOTIFY',importedPlaylistId:'p',playbackMode:'IMPORTED_SOURCE'}));
    const mapped=mapPlaylistResponse({id:'p',sourceImport:{items,total:2},tracks:[],createdByCurrentUser:true,isPublic:false,trackCount:2});
    expect(mapped.tracks).toEqual(items);expect(mapped.trackCount).toBe(2);expect(mapped.canReorder).toBe(false);
  });
});
