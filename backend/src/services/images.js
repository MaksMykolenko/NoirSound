'use strict';

const { createHash } = require('node:crypto');
const { execFile } = require('node:child_process');
const { mkdtemp, writeFile, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { promisify } = require('node:util');

const run = promisify(execFile);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const pendingByStorage = new WeakMap();
let activeConversions = 0;
const waitingConversions = [];

async function withImageSlot(convert) {
  if (activeConversions >= 2) {
    if (waitingConversions.length >= 16) {
      const error = new Error('Image processing is busy. Please try again.');
      error.statusCode = 503;
      throw error;
    }
    await new Promise(resolve => waitingConversions.push(resolve));
  } else {
    activeConversions += 1;
  }
  try { return await convert(); }
  finally {
    const next = waitingConversions.shift();
    if (next) next();
    else activeConversions -= 1;
  }
}

// FFmpeg is already bundled in the backend image. Bound both input and CPU
// work; cached derivatives avoid decoding the original on subsequent visits.
async function convertImage(buffer, maxDimension) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    throw new Error('Invalid image size.');
  }
  let directory;
  try {
    directory = await mkdtemp(join(tmpdir(), 'noirsound-image-'));
    const input = join(directory, 'input');
    const output = join(directory, 'output.webp');
    await writeFile(input, buffer);
    const { stdout } = await run('ffprobe', [
      '-v', 'error', '-protocol_whitelist', 'file,pipe', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height', '-of', 'json', input,
    ], { timeout: 5000, maxBuffer: 64 * 1024 });
    const { width, height } = JSON.parse(stdout).streams?.[0] || {};
    if (!width || !height || width > 12000 || height > 12000 || width * height > 40000000) {
      throw new Error('Image dimensions are too large or invalid.');
    }
    await run('ffmpeg', [
      '-v', 'error', '-nostdin', '-threads', '1', '-filter_threads', '1',
      '-protocol_whitelist', 'file,pipe', '-i', input, '-frames:v', '1',
      '-vf', `scale=w='min(${maxDimension},iw)':h='min(${maxDimension},ih)':force_original_aspect_ratio=decrease`,
      '-c:v', 'libwebp', '-quality', '82', '-threads', '1', '-y', output,
    ], { timeout: 15000, maxBuffer: 64 * 1024 });
    return await readFile(output);
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}

function optimizeImage(buffer, maxDimension = 640) {
  return withImageSlot(() => convertImage(buffer, maxDimension));
}

async function readImage(storage, key) {
  const body = await storage.getObjectStream(key);
  const chunks = [];
  let size = 0;
  for await (const chunk of Buffer.isBuffer(body) ? [body] : body) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_IMAGE_BYTES) {
      body.destroy?.();
      throw new Error('Image exceeds the size limit.');
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function getOptimizedImage(storage, key) {
  const source = await storage.getObjectMetadata(key);
  if (!source?.exists || !IMAGE_TYPES.has(source.mimeType) || source.size <= 0 || source.size > MAX_IMAGE_BYTES) {
    throw new Error('Image not found.');
  }
  const version = createHash('sha256')
    .update(`${key}:${source.etag || source.lastModified || ''}:${source.size}`).digest('hex');
  const cacheKey = `image-cache/v1/${version}.webp`;
  const cached = await storage.getObjectMetadata(cacheKey);
  if (cached?.exists) {
    return { body: await storage.getObjectStream(cacheKey), mimeType: 'image/webp', etag: `"${version}"` };
  }
  let pending = pendingByStorage.get(storage);
  if (!pending) { pending = new Map(); pendingByStorage.set(storage, pending); }
  if (!pending.has(cacheKey)) {
    const job = (async () => {
      // Queue before reading the original so a grid of covers does not retain
      // dozens of full-size source images in memory while waiting for a slot.
      const result = await withImageSlot(async () => convertImage(await readImage(storage, key), 640));
      await storage.putObject(cacheKey, result, 'image/webp');
      return result;
    })().finally(() => pending.delete(cacheKey));
    pending.set(cacheKey, job);
  }
  return { body: await pending.get(cacheKey), mimeType: 'image/webp', etag: `"${version}"` };
}

async function sendCoverImage(storage, key, request, reply, logger) {
  let image;
  try {
    image = await getOptimizedImage(storage, key);
  } catch (error) {
    // A missing converter/cache permission must not break existing artwork.
    logger?.warn?.({ message: error.message }, 'Cover optimization unavailable; serving original');
    const meta = await storage.getObjectMetadata(key);
    if (!meta?.exists || !IMAGE_TYPES.has(meta.mimeType)) return reply.code(404).send();
    image = { body: await storage.getObjectStream(key), mimeType: meta.mimeType, etag: meta.etag };
  }
  // Covers may belong to a private track. Never share a viewer's response in a
  // public proxy cache; the route rechecks access after this short browser TTL.
  reply.header('cache-control', 'private, max-age=300');
  reply.header('content-type', image.mimeType);
  reply.header('x-content-type-options', 'nosniff');
  if (image.etag) {
    reply.header('etag', image.etag);
    if (request.headers['if-none-match'] === image.etag) {
      image.body.destroy?.();
      return reply.code(304).send();
    }
  }
  return reply.send(image.body);
}

module.exports = { MAX_IMAGE_BYTES, IMAGE_TYPES, optimizeImage, getOptimizedImage, sendCoverImage };
