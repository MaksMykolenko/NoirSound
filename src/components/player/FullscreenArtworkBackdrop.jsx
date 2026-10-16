import React, { memo, useState } from 'react';

// Use the artwork itself so remote covers also work without canvas/CORS access.
// The parent keys this by URL: failed or slow images cannot leak into the next track.
export default memo(function FullscreenArtworkBackdrop({ src, paused }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className="ns-immersive-atmosphere" aria-hidden="true" data-testid="fullscreen-artwork-backdrop">
      {src && !failed ? (
        <img
          src={src}
          alt=""
          decoding="async"
          draggable="false"
          className="ns-immersive-atmosphere-image"
          data-loaded={loaded}
          data-paused={paused}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : null}
      <div className="ns-immersive-atmosphere-shade" />
    </div>
  );
});
