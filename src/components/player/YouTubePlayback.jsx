import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadYouTubePlayer } from '../../services/youtubePlayer';
import { registerPlatformFrameStop } from '../../store/playerStore';

export default function YouTubePlayback({ videoId, onEnded }) {
  const { t }=useTranslation();
  const root=useRef(null), ended=useRef(onEnded);
  const [error,setError]=useState(false);
  ended.current=onEnded;
  useLayoutEffect(()=>{
    let disposed=false,stopped=false,player;
    const container=root.current;
    const stop=()=>{stopped=true;try{player?.stopVideo();}catch{/* An iframe may already have navigated. */}const frame=container.querySelector('iframe');if(frame)frame.src='about:blank';};
    const unregister=registerPlatformFrameStop(stop);
    loadYouTubePlayer().then(YT=>{
      if(disposed||stopped)return;
      const target=document.createElement('iframe');
      target.title='YouTube';target.width='100%';target.height='270';target.allow='autoplay; encrypted-media; fullscreen; picture-in-picture';target.allowFullscreen=true;
      target.referrerPolicy='strict-origin-when-cross-origin';
      target.src='https://www.youtube-nocookie.com/embed/'+videoId+'?'+new URLSearchParams({enablejsapi:'1',autoplay:'1',playsinline:'1',origin:window.location.origin});
      container.appendChild(target);
      player=new YT.Player(target,{events:{
        onStateChange:event=>{if(!disposed&&!stopped&&event.data===0)ended.current?.();},
        onError:()=>{if(!disposed)setError(true);},
      }});
    }).catch(()=>{if(!disposed)setError(true);});
    return()=>{disposed=true;stop();unregister();try{player?.destroy();}catch{/* Already removed. */}container.replaceChildren();};
  },[videoId]);
  return <div>{error&&<p role="alert" className="mb-2 text-sm text-amber-300">{t('playlistImport.videoPlaybackFailed')}</p>}<div ref={root} className="min-h-[270px] overflow-hidden rounded"/></div>;
}
