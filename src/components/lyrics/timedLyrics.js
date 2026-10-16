export function parseLrc(input) {
  if (typeof input !== 'string' || input.length > 50000) return [];
  const offset = Number(input.match(/\[offset:([+-]?\d+)\]/i)?.[1] || 0) / 1000;
  const lines = []; let characters = 0;
  for (const row of input.split(/\r?\n/)) {
    const stamps = [...row.matchAll(/\[(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?\]/g)];
    const text = row.replace(/\[[^\]]*\]/g, '').replace(/<\d{1,3}:\d{2}(?:\.\d{1,3})?>/g, '').trim();
    if (!text) continue;
    for (const stamp of stamps) {
      characters += text.length; if (characters > 50000) return [];
      lines.push({ time: Math.max(0, Number(stamp[1]) * 60 + Number(stamp[2]) + Number('0.' + (stamp[3] || '0')) + offset), text });
      if (lines.length > 1000) return [];
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}
export function activeLyricIndex(lines, time) {
  let low = 0, high = lines.length - 1, found = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (lines[middle].time <= time) { found = middle; low = middle + 1; }
    else high = middle - 1;
  }
  return found;
}
