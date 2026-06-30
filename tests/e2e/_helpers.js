// Shared helpers for the public-beta full-stack E2E specs.
export const API_BASE = process.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

/** True if the current backend and its dependencies are ready for E2E. */
export async function backendUp(request) {
  try {
    const res = await request.get(`${API_BASE}/ready`);
    if (!res.ok()) return false;
    const body = await res.json();
    return body.status === 'ready';
  } catch {
    return false;
  }
}

/** Build a small, valid 1s mono 8kHz 16-bit PCM WAV (passes magic-byte + ffprobe). */
export function makeWavBuffer(seconds = 1) {
  const sampleRate = 8000;
  const numSamples = sampleRate * seconds;
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  // Low-amplitude sine so it is real audio, not pure silence.
  for (let i = 0; i < numSamples; i += 1) {
    buf.writeInt16LE(Math.round(3000 * Math.sin((2 * Math.PI * 220 * i) / sampleRate)), 44 + i * 2);
  }
  return buf;
}

/** Login an API context (cookies stored on the context). */
export async function loginApi(ctx, email, password = 'password123') {
  const res = await ctx.post(`${API_BASE}/auth/login`, { data: { email, password } });
  return res.ok();
}

/** Run the full upload pipeline via the API; returns { trackId, uploadId }. */
export async function uploadTrackViaApi(ctx, { title = 'E2E Track' } = {}) {
  const init = await ctx.post(`${API_BASE}/uploads/track/init`, {
    data: {
      title, genre: 'electronic', tags: ['e2e'], copyrightConfirmed: true,
      audio: { filename: 'e2e.wav', mimeType: 'audio/wav', sizeBytes: makeWavBuffer().length },
    },
  });
  if (!init.ok()) throw new Error(`init failed: ${init.status()}`);
  const { uploadId, trackId, audioUploadUrl } = await init.json();

  // Upload the bytes to the presigned URL.
  const put = await ctx.put(audioUploadUrl, {
    headers: { 'content-type': 'audio/wav' },
    data: makeWavBuffer(),
  });
  if (!put.ok()) throw new Error(`presigned PUT failed: ${put.status()}`);

  const complete = await ctx.post(`${API_BASE}/uploads/track/${uploadId}/complete`);
  if (!complete.ok()) throw new Error(`complete failed: ${complete.status()}`);

  // Poll until the worker publishes the track.
  for (let i = 0; i < 40; i += 1) {
    const s = await ctx.get(`${API_BASE}/uploads/track/${uploadId}/status`);
    const body = await s.json();
    if (body.status === 'READY' || body.trackStatus === 'PUBLISHED') return { trackId, uploadId };
    if (body.status === 'FAILED') throw new Error(`processing failed: ${body.error}`);
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error('Timed out waiting for worker to publish track.');
}
