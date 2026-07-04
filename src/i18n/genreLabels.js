// Backwards-compatible shim. The genre-label logic now lives in
// src/utils/genreLabels.js and is backed by the shared taxonomy. Existing
// imports of getLocalizedGenre keep working unchanged.
//
// Despite the name (kept for import compatibility), this is intentionally
// English-only: genre names are music-taxonomy terms, not translated UI copy.
// See NOIRSOUND_GENRE_ENGLISH_ONLY_REPORT.md.
import { getGenreLabel } from '../utils/genreLabels';

/**
 * English display label for a genre value coming from the API/DB. Normalizes
 * legacy values (e.g. "Dark Synth" -> Synthwave) and falls back to the
 * original text for unknown/custom genres so the UI never breaks. Never
 * localized — always English regardless of the active UI language.
 */
export function getLocalizedGenre(genre) {
  if (!genre) return '';
  return getGenreLabel(genre);
}
