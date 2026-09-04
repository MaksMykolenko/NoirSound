// Isolated HTTP fixtures for browser interaction tests. Never imported by production code.
import { API_BASE, makeWavBuffer } from './_helpers';
export const LONG_TITLE = 'Midnight recordings beyond the last tram — an exceptionally long title with Український текст and Polish characters Łódź';
export const LONG_ARTIST = 'The collective of late night producers with an intentionally long artist name';
export const fixtureUser = { id: 'qa-user', username: 'final-design-qa', displayName: 'Final Design QA', email: 'qa@example.invalid', role: 'ADMIN', roles: ['ADMIN', 'ARTIST'], artistId: 'qa-artist', preferredLanguage: 'en', bio: 'Synthetic profile for local visual verification.', isArtist: true, artistProfile: { id: 'qa-artist' } };
export const fixtureArtists = [{ id: 'qa-artist', name: LONG_ARTIST, username: 'final-design-qa', avatarUrl: null, bio: 'Independent producer exploring nocturnal textures. '.repeat(5), genres: ['electronic', 'hip_hop'], followers: 1234567, monthlyListeners: 765432, isVerified: true }];
export const fixtureTracks = Array.from({ length: 14 }, (_, index) => ({
 id: `qa-track-${index + 1}`, title: index === 12 ? 'Unbroken' + 'W'.repeat(100) : index < 2 ? LONG_TITLE + (index === 1 ? ' — Beat edition' : '') : ['After the last tram', 'Empty platforms', 'City tapes', 'A quiet room', 'Night photographs', 'Window light'][index % 6],
 artistId: 'qa-artist', artistName: index < 2 ? LONG_ARTIST : 'Nocturnal Collective', contentType: index % 2 ? 'BEAT' : 'MUSIC',
 coverUrl: index === 11 ? '/images/final-qa-missing-cover.png' : index < 2 ? null : ['/images/cover_ambient.png','/images/cover_electronic.png','/images/cover_lofi.png'][index % 3],
 genre: index === 2 ? 'experimental_ambient_with_an_intentionally_long_unknown_genre_name' : index % 2 ? 'hip_hop' : 'electronic', duration: index === 13 ? null : index === 0 ? 3723 : 203 + index, plays: 1234567 - index * 1200, likes: 4210,
 audioUrl: index === 12 ? null : `${API_BASE}/tracks/qa-track-${index + 1}/stream`, isStreamable: index !== 12, isAvailable: index !== 12, status: 'PUBLISHED',
 hasLyrics: true, lyricsType: 'SYNCED', description: 'Synthetic QA release: intentionally varied content to verify responsive presentation.',
 beatBpm: index % 2 ? 138 : null, beatKey: index % 2 ? 'F# Minor' : null, beatMood: index % 2 ? 'Dark' : null, beatStyle: index % 2 ? 'Trap' : null,
 beatLicenseType: 'Contact producer', beatUsageNotes: 'Get in touch with the producer for usage details.', beatContactEnabled: true,
 publishedAt: index < 2 ? '2026-09-02T12:00:00.000Z' : '2026-09-01T12:00:00.000Z', createdAt: index < 2 ? '2026-09-02T12:00:00.000Z' : '2026-08-30T12:00:00.000Z', releaseDate: index < 2 ? '2026-09-02' : '2026-08-30', waveform: Array.from({ length: 80 }, (_, j) => 0.2 + (j % 9) / 12),
}));
export const fixturePlaylist = { id:'qa-playlist', title:'Late night collection — long titles, Music and Beats', name:'Late night collection — long titles, Music and Beats', description:'Synthetic local QA playlist. Music and Beats share the same listening controls.', ownerId:'qa-user', ownerName:'Final Design QA', creator:fixtureUser, creatorId:'qa-user', canEdit:true, canDelete:true, canReorder:true, userId:'qa-user', user:fixtureUser, isPublic:true, isOwner:true, coverUrl:null, tracks:fixtureTracks, trackIds:fixtureTracks.map(t=>t.id), trackCount:fixtureTracks.length, totalDuration:fixtureTracks.reduce((n,t)=>n+t.duration,0), createdAt:'2026-09-01T12:00:00.000Z' };
export const fixtureBatch = { id:'qa-batch',mode:'MIXED',status:'PARTIAL_READY',creator:{displayName:LONG_ARTIST},playlist:{id:null,title:LONG_TITLE,description:'Synthetic batch release with varied processing states.',visibility:'PUBLIC',tags:[],hasCover:false},items:fixtureTracks.slice(0,4).map((track,index)=>({...track,id:`qa-item-${index}`,clientId:`qa-client-${index}`,fileName:track.title+'.wav',fileSize:420044,mimeType:'audio/wav',primaryArtistName:track.artistName,featuredArtists:[],tags:[],target:index<2?'PLAYLIST':'SINGLE',playlistOrder:index+1,status:['DRAFT','READY','PROCESSING','FAILED'][index],uploadStatus:'UPLOADED',processingStatus:index===3?'FAILED':null,lyricsType:'NONE',lyricsText:'',lyricsSynced:null,lyricsRightsConfirmed:false,copyrightConfirmed:index!==3,visibility:'PUBLIC',explicit:false,hasCover:false,hasLyrics:false,missingFields:index===3?['copyrightConfirmed']:[],errorCode:index===3?'PROCESSING_FAILED':null,errorMessage:index===3?'Synthetic processing failure: an exceptionally long decoder diagnostic that must wrap within the item and remain readable on mobile.':null})),missingFields:[{scope:'item',itemId:'qa-item-3',field:'copyrightConfirmed'}],canPublish:false,canPublishPartial:false};
export async function installFinalDesignFixtures(page, { locale='en', theme='noir-pink', guest=false, catalogueSize=14 }={}) {
 await page.addInitScript(({locale,theme})=>{if(!localStorage.getItem('noirsound_language'))localStorage.setItem('noirsound_language',locale);if(!localStorage.getItem('noirsound.theme'))localStorage.setItem('noirsound.theme',theme);},{locale,theme});
 const tracks=Array.from({length:catalogueSize},(_,index)=>index<fixtureTracks.length?fixtureTracks[index]:({...fixtureTracks[index%fixtureTracks.length],id:`qa-track-${index+1}`,title:`Archive release ${String(index+1).padStart(3,'0')}`,publishedAt:'2026-08-01T12:00:00.000Z',createdAt:'2026-08-01T12:00:00.000Z',releaseDate:'2026-08-01'}));
 const unknown=[];const intentionalEmpty=[];
 await page.route('**/api/**', async route=>{
  const url=new URL(route.request().url()); if(!url.pathname.startsWith('/api/')) return route.continue(); const path=url.pathname.replace(/^\/api/,''); const method=route.request().method();
  const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(path.endsWith('/stream')) return route.fulfill({status:200,contentType:'audio/wav',body:makeWavBuffer(20)});
  if(path==='/auth/me') return guest?json({error:'UNAUTHORIZED'},401):json({user:fixtureUser});
  if(path==='/auth/csrf') return json({csrfToken:'synthetic-local-qa'});
  if(path==='/artists'||path==='/me/followed-artists') return json({data:fixtureArtists});
  if(path==='/artists/qa-artist') return json({artist:fixtureArtists[0]});
  if(path==='/discover/catalog') {
   const params=url.searchParams;
   let data=tracks.filter(track=>!params.get('contentType')||track.contentType===params.get('contentType'));
   const q=(params.get('q')||'').trim().toLowerCase();
   if(q)data=data.filter(track=>[track.title,track.artistName,track.genre,track.beatStyle,track.beatMood].some(value=>String(value||'').toLowerCase().includes(q)));
   const optionCounts=field=>[...new Set(data.map(track=>track[field]).filter(Boolean))].map(value=>({value,label:value,count:data.filter(track=>track[field]===value).length}));
   const facets={genres:optionCounts('genre'),groups:[],styles:optionCounts('beatStyle'),moods:optionCounts('beatMood'),keys:optionCounts('beatKey'),bpmRanges:[]};
   for(const [parameter,field] of [['genre','genre'],['style','beatStyle'],['mood','beatMood'],['key','beatKey']])if(params.get(parameter))data=data.filter(track=>track[field]===params.get(parameter));
   const range={'under-90':[0,89],'90-119':[90,119],'120-149':[120,149],'150-plus':[150,999]}[params.get('bpm')];
   if(range)data=data.filter(track=>track.beatBpm>=range[0]&&track.beatBpm<=range[1]);
   const pageSize=Math.min(100,Math.max(1,Number(params.get('limit')||30)));
   const offset=Math.max(0,Number(params.get('cursor')||0));
   const items=data.slice(offset,offset+pageSize);const hasNextPage=offset+pageSize<data.length;
   return json({items,total:data.length,pageInfo:{pageSize,hasNextPage,nextCursor:hasNextPage?String(offset+pageSize):null},facets,meta:{trendingWindowDays:params.get('sort')==='trending'?7:null}});
  }
  if(path==='/tracks'||path.endsWith('/tracks')&&path.startsWith('/artists/')) {
   let data=tracks.filter(t=>!url.searchParams.get('contentType')||t.contentType===url.searchParams.get('contentType'));
   if(url.searchParams.get('style')) data=data.filter(t=>t.beatStyle===url.searchParams.get('style'));
   const limit=Math.min(60,Math.max(1,Number(url.searchParams.get('limit')||20)));const offset=Math.max(0,Number(url.searchParams.get('page')||1)-1)*limit;return json({data:data.slice(offset,offset+limit),meta:{windowDays:7,total:data.length,page:1,limit}});
  }
  if(/^\/tracks\/[^/]+\/lyrics/.test(path)) return json({trackId:path.split('/')[2],hasLyrics:true,lyricsType:'SYNCED',lyricsLanguage:'en',lyricsText:'The city falls quiet\nA light through the window\nWe follow the last train home',lyricsLines:[{startMs:0,text:'The city falls quiet'},{startMs:5000,text:'A light through the window'},{startMs:10000,text:'We follow the last train home'}]});
  if(/^\/tracks\/[^/]+$/.test(path)) return json({track:fixtureTracks.find(t=>t.id===path.split('/')[2])||fixtureTracks[0]});
  if(path==='/me/liked-tracks') return json({data:fixtureTracks.slice(0,3)});
  if(path==='/me/recently-played') return json({data:fixtureTracks.slice(0,3).map(track=>({track,playedAt:'2026-09-03T10:00:00.000Z'}))});
  if(path==='/me/artist-dashboard') return json({tracks:fixtureTracks,topTracks:fixtureTracks.slice(0,6),recentUploads:fixtureTracks.slice(0,3),failedUploads:[{...fixtureTracks[1],id:'qa-failure',status:'FAILED',errorMessage:'Synthetic decoder failure with a long diagnostic message that must wrap.'}],totalPlays:1245000,totalLikes:4200,followers:12540,monthlyListeners:2456});
  if(path==='/uploads/batch')return json({data:[{id:'qa-batch',status:'PARTIAL_READY',playlistTitle:LONG_TITLE,itemCount:4,readyCount:1,failedCount:1}]});
  if(path==='/uploads/batch/qa-batch')return json({batch:fixtureBatch});
  if(path==='/desktop-connect/devices')return json({devices:[{id:'qa-device',deviceName:'MacBook Pro '+ 'W'.repeat(100),platform:'macOS',lastSeenAt:'2026-09-03T10:00:00.000Z'}]});
  if(path==='/desktop-connect/settings')return json({enabled:true,showCover:true,showTimer:true});
  if(path==='/admin/overview') return json({reports:{pending:2},uploads:{failed:1,processing:3},tracks:{published:14,hidden:2},users:{active:42,suspended:1,banned:0},comments:{today:7},playEvents:{today:120},system:{status:'healthy',checks:{api:'healthy',database:'healthy',redis:'healthy',storage:'healthy',worker:'healthy',ffmpeg:'healthy'}}});
  if(path==='/admin/users')return json({data:[{...fixtureUser,displayName:LONG_ARTIST,status:'ACTIVE',hasArtistProfile:true,canUploadTracks:true,joinedAt:'2026-08-01',counts:{tracks:14,reports:0}}],pagination:{page:1,pageSize:20,total:1,totalPages:1}});
  if(path==='/admin/reports')return json({data:[{id:'qa-report',type:'TRACK',targetType:'TRACK',targetId:'qa-track-1',reason:'OTHER',message:'Synthetic report with a deliberately detailed review note for responsive inspection.',status:'OPEN',createdAt:'2026-09-01',reporter:{username:'final-design-qa',displayName:LONG_ARTIST,email:'qa@example.invalid'}}],pagination:{page:1,pageSize:20,total:1,totalPages:1}});
  if(path==='/admin/tracks') return json({data:fixtureTracks.map(track=>({...track,artist:{user:{displayName:track.artistName}},reportsCount:0,updatedAt:track.createdAt})),pagination:{page:1,pageSize:20,total:14,totalPages:1}});
  if(path==='/playlists'||path==='/playlists/me') return json({data:[fixturePlaylist]});
  if(path==='/playlists/qa-playlist') return json({playlist:fixturePlaylist});
  if(path.includes('/comments')) {intentionalEmpty.push(path);return json({data:[],comments:[],total:0});}
  if(path.startsWith('/profiles/')) return json({profile:fixtureUser});
  if(path==='/me/listening-stats'||path.startsWith('/me/stats')||path.includes('/stats')) return json({totalListeningSeconds:12345,totalListeningMinutes:205,tracksPlayed:27,uniqueArtists:3,topGenres:[],topArtists:[],topTracks:[],totals:{},series:[],daily:[],tracks:[]});
  if(method!=='GET') return json({success:true,isLiked:true,followers:1234568});

  unknown.push(path);return json({error:'UNHANDLED_SYNTHETIC_FIXTURE',message:`Missing test fixture for ${path}`},404);
 });
 return { unknown, intentionalEmpty };
}
