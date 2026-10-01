import React from 'react';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {act,render,screen,waitFor,cleanup} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import PlatformEmbedPlayer from '../../src/components/player/PlatformEmbedPlayer';
import {usePlayerStore} from '../../src/store/playerStore';
import {useUserStore} from '../../src/store/userStore';
vi.mock('react-i18next',()=>({useTranslation:()=>({t:key=>key})}));
const embed={provider:'YOUTUBE',embedUrl:'https://www.youtube-nocookie.com/embed/abcdefghijk',canonicalUrl:'https://www.youtube.com/watch?v=abcdefghijk',ownerId:'admin',generation:42};
function Host(){const active=usePlayerStore(s=>s.activePlatformEmbed);return active?<PlatformEmbedPlayer embed={active}/>:null;}
function mount(enabled=true){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});client.setQueryData(['external-status','admin'],{enabled});return render(<QueryClientProvider client={client}><Host/></QueryClientProvider>);}
beforeEach(()=>{useUserStore.setState({user:{id:'admin',role:'ADMIN'}});usePlayerStore.setState({activePlatformEmbed:embed,currentTrack:{id:'embed:42',playbackMode:'OFFICIAL_EMBED'}});vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>({enabled:true})})));});
afterEach(()=>{cleanup();usePlayerStore.getState().closePlatformEmbed();vi.unstubAllGlobals();});
describe('official player visibility and access lifecycle',()=>{
 it('shows a visible >=200px YouTube frame, with referrer and original link, then blanks it on close',async()=>{mount();const frame=screen.getByTitle('YOUTUBE externalMusic.officialPlayer');expect(Number(frame.height)).toBeGreaterThanOrEqual(200);expect(frame.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');expect(screen.getByRole('link').href).toBe(embed.canonicalUrl);await act(async()=>screen.getByRole('button',{name:'externalMusic.closePlayer'}).click());expect(frame.src).toBe('about:blank');expect(screen.queryByTitle('YOUTUBE externalMusic.officialPlayer')).toBeNull();});
 it('blanks and removes the frame immediately on logout',async()=>{mount();const frame=screen.getByTitle('YOUTUBE externalMusic.officialPlayer');await act(async()=>useUserStore.setState({user:null}));expect(frame.src).toBe('about:blank');expect(usePlayerStore.getState().activePlatformEmbed).toBeNull();});
 it('never mounts a frame when the persisted beta gate is disabled',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>({enabled:false})})));mount(false);expect(screen.queryByTitle('YOUTUBE externalMusic.officialPlayer')).toBeNull();await waitFor(()=>expect(usePlayerStore.getState().activePlatformEmbed).toBeNull());});
});
