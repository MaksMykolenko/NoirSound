let loading;
export function loadYouTubePlayer() {
  if(window.YT?.Player)return Promise.resolve(window.YT);
  if(loading)return loading;
  loading=new Promise((resolve,reject)=>{
    const previous=window.onYouTubeIframeAPIReady;
    const script=document.createElement('script');
    const timer=setTimeout(()=>{script.remove();loading=null;reject(new Error('YOUTUBE_PLAYER_UNAVAILABLE'));},15000);
    window.onYouTubeIframeAPIReady=()=>{clearTimeout(timer);try{previous?.();}finally{resolve(window.YT);}};
    script.src='https://www.youtube.com/iframe_api';script.async=true;
    script.onerror=()=>{clearTimeout(timer);script.remove();loading=null;reject(new Error('YOUTUBE_PLAYER_UNAVAILABLE'));};
    document.head.appendChild(script);
  });
  return loading;
}
