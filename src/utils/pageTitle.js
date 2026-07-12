// Shared owner of the "base" document title — the per-page title set by the
// server-rendered <head> or by <PageMeta>. Transient overlays (e.g. the
// now-playing "▶ …" indicator in useAnimatedFavicon) must restore this value
// instead of overwriting the title with a hardcoded string.
let baseTitle = typeof document !== 'undefined' && document.title
  ? document.title
  : 'NoirSound';

export function setBaseTitle(title) {
  if (title) baseTitle = title;
}

export function getBaseTitle() {
  return baseTitle;
}
