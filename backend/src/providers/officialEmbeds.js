'use strict';
const { platformUrl, fail } = require('../lib/externalCatalog');
const EMBED_PROVIDERS = ['SOUNDCLOUD', 'APPLE_MUSIC', 'YOUTUBE'];
// Official visible widgets only. No upstream fetch, credentials or audio extraction.
function officialEmbed(provider, input) {
  if (!EMBED_PROVIDERS.includes(provider)) fail('EXTERNAL_EMBED_UNSUPPORTED');
  const { canonicalUrl, externalId } = platformUrl(provider, input);
  let embedUrl;
  if (provider === 'SOUNDCLOUD') {
    const widget = new URL('https://w.soundcloud.com/player/');
    widget.search = new URLSearchParams({url:canonicalUrl,auto_play:'false',single_active:'true',show_artwork:'true',show_user:'true'});
    embedUrl = widget.href;
  } else if (provider === 'APPLE_MUSIC') {
    const widget = new URL(canonicalUrl);
    widget.hostname = 'embed.music.apple.com';
    embedUrl = widget.href;
  } else {
    embedUrl = `https://www.youtube-nocookie.com/embed/${externalId}?playsinline=1&autoplay=0`;
  }
  return { provider, canonicalUrl, embedUrl, playbackMode:'OFFICIAL_EMBED' };
}
module.exports = { EMBED_PROVIDERS, officialEmbed };
