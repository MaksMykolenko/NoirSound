// Backwards-compatible shim. The genre-label logic now lives in
// src/utils/genreLabels.js and is backed by the shared taxonomy. Existing
// imports of getLocalizedGenre keep working unchanged.
import { getGenreLabel } from '../utils/genreLabels';

/**
 * Localized label for a genre value coming from the API/DB.
 * Normalizes legacy values (e.g. "Dark Synth" -> Synthwave) and falls back to
 * the original text for unknown/custom genres so the UI never breaks.
 */
export function getLocalizedGenre(genre) {
  if (!genre) return '';
  return getGenreLabel(genre);
}
