'use strict';

// LRC timestamps are seconds, including decimal fractions and a global ms offset.
function parseLrc(input) {
  if (typeof input !== 'string' || input.length > 50000) return [];
  const offset = Number(input.match(/\[offset:([+-]?\d+)\]/i)?.[1] || 0) / 1000;
  const lines = []; let characters = 0;
  for (const row of input.split(/\r?\n/)) {
    const stamps = [...row.matchAll(/\[(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?\]/g)];
    const text = row.replace(/\[[^\]]*\]/g, '').replace(/<\d{1,3}:\d{2}(?:\.\d{1,3})?>/g, '').trim();
    if (!text) continue;
    for (const stamp of stamps) {
      characters += text.length; if (characters > 50000) return [];
      const time = Number(stamp[1]) * 60 + Number(stamp[2]) + Number('0.' + (stamp[3] || '0')) + offset;
      lines.push({ time: Math.max(0, time), text });
      if (lines.length > 1000) return [];
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}
module.exports = { parseLrc };
