export const MAX_LYRICS_CHARACTERS = 50_000;
export const MAX_LYRICS_LINES = 1_000;

export function lyricsCounts(text) {
  const normalized = String(text || '').replace(/\r\n?/g, '\n');
  return {
    characters: normalized.length,
    lines: normalized ? normalized.split('\n').length : 0,
  };
}
