import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter,useLocation} from 'react-router-dom';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import i18n from '../../src/i18n';
import ExternalCatalogFeed from '../../src/components/tracks/ExternalCatalogFeed';
import {useUserStore} from '../../src/store/userStore';
import {usePlayerStore} from '../../src/store/playerStore';
import {catalogRequest,saveCatalogTrack} from '../../src/api/externalCatalog';
vi.mock('../../src/api/externalCatalog',()=>({catalogRequest:vi.fn(),saveCatalogTrack:vi.fn(),resolveExternalPlayback:vi.fn(),resolvePlatformEmbed:vi.fn(),recordExternalPlay:vi.fn()}));
const preview={id:'AUDIUS:owned',title:'Owned live catalog fixture',artistName:'Fixture artist',provider:'AUDIUS',previewExternalId:'owned',canonicalUrl:'https://audius.co/owned/fixture',isAvailable:true,isStreamable:true,playbackSource:'external',playbackMode:'EXTERNAL_STREAM'};
const saved={...preview,id:'saved-track',previewExternalId:undefined,recordingId:'saved-recording',selectedSourceId:'source'};
function Location(){return <output data-testid="location">{useLocation().pathname}</output>;}
function mount(){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/discover']}><ExternalCatalogFeed/><Location/></MemoryRouter></QueryClientProvider>);}
describe('automatic platform cards in the normal catalog',()=>{
 beforeEach(async()=>{vi.clearAllMocks();await i18n.changeLanguage('en');useUserStore.setState({user:{id:'owner',role:'ADMIN'},authHydrated:true});usePlayerStore.setState({likedTracks:[],currentTrack:null,isPlaying:false});saveCatalogTrack.mockResolvedValue(saved);catalogRequest.mockImplementation(async path=>path==='/status'?{enabled:true}:{items:[preview],providers:[{provider:'AUDIUS',status:'LIVE'}],pageInfo:{nextCursor:null}});});
 afterEach(()=>{vi.restoreAllMocks();useUserStore.setState({user:null});});
 it('shows live tracks, attribution and original links without a manual import or URL form',async()=>{
  mount();await screen.findByText(preview.title);expect(screen.getByRole('img',{name:'Audius'})).toBeInTheDocument();expect(screen.getByRole('link',{name:'Audius'})).toHaveAttribute('href',preview.canonicalUrl);expect(screen.queryByRole('textbox')).toBeNull();expect(screen.queryByRole('button',{name:'Add to catalog'})).toBeNull();expect(saveCatalogTrack).not.toHaveBeenCalled();
 });
 it('likes the stored Track identity, creating it automatically on first interaction',async()=>{
  const like=vi.spyOn(usePlayerStore.getState(),'toggleLikeTrack').mockResolvedValue();mount();await screen.findByText(preview.title);fireEvent.click(screen.getByRole('button',{name:`Like ${preview.title}`}));await waitFor(()=>expect(like).toHaveBeenCalledWith(saved.id));expect(saveCatalogTrack).toHaveBeenCalledWith(preview);
 });
 it('opens a normal track page after automatic registration',async()=>{
  mount();await screen.findByText(preview.title);fireEvent.click(screen.getByRole('link',{name:preview.title}));await waitFor(()=>expect(screen.getByTestId('location')).toHaveTextContent('/track/saved-track'));
 });
 it('does not request or display the private feed for a listener',()=>{
  useUserStore.setState({user:{id:'listener',role:'LISTENER'}});mount();expect(catalogRequest).not.toHaveBeenCalled();expect(screen.queryByTestId('external-catalog-feed')).toBeNull();
 });
 it('server-disabled beta does not request a live catalog',async()=>{
  catalogRequest.mockResolvedValue({enabled:false});mount();await waitFor(()=>expect(catalogRequest).toHaveBeenCalledTimes(1));expect(screen.queryByTestId('external-catalog-feed')).toBeNull();
 });
});
