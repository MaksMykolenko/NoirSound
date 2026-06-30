require('dotenv').config();

const { Worker } = require('bullmq');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile, execFileSync } = require('child_process');
const { pipeline } = require('stream/promises');
const { createPrismaClient } = require('../lib/prisma');
const storage = require('../services/storage');
const { getRedisConnection } = require('../services/audioQueue');
const {
  isAllowedAudioSignature,
  signatureMatchesDeclared
} = require('../lib/fileSignature');

// Hardening limits (override via env).
const FFPROBE_TIMEOUT_MS = Number(process.env.FFPROBE_TIMEOUT_MS || 30 * 1000);
const FFMPEG_TIMEOUT_MS = Number(process.env.FFMPEG_TIMEOUT_MS || 5 * 60 * 1000);
const MAX_AUDIO_DURATION_SECONDS = Number(process.env.MAX_AUDIO_DURATION_SECONDS || 30 * 60);

/** Verify the first bytes of a file look like real, supported audio. */
function assertAudioSignature(filePath, declaredMimeType) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(16);
    fs.readSync(fd, header, 0, 16, 0);
    if (!isAllowedAudioSignature(header)) {
      throw new Error('Uploaded file is not a recognized audio format.');
    }
    if (declaredMimeType && !signatureMatchesDeclared(declaredMimeType, header)) {
      throw new Error('Uploaded audio bytes do not match the declared MIME type.');
    }
  } finally {
    fs.closeSync(fd);
  }
}

function probeDuration(filePath) {
  return new Promise((resolve, reject) => {
    execFile('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'json',
      filePath
    ], {
      timeout: FFPROBE_TIMEOUT_MS,
      killSignal: 'SIGKILL',
      maxBuffer: 1024 * 1024
    }, (error, stdout) => {
      if (error) {
        if (error.killed || error.signal === 'SIGKILL') {
          return reject(new Error('FFprobe timed out.'));
        }
        return reject(error);
      }
      let metadata;
      try {
        metadata = JSON.parse(stdout);
      } catch {
        return reject(new Error('FFprobe returned invalid metadata.'));
      }
      const duration = Number(metadata?.format?.duration);
      if (!Number.isFinite(duration) || duration <= 0) {
        return reject(new Error('FFprobe did not return a valid audio duration.'));
      }
      if (duration > MAX_AUDIO_DURATION_SECONDS) {
        return reject(new Error(
          `Audio exceeds the maximum allowed duration of ${MAX_AUDIO_DURATION_SECONDS}s.`
        ));
      }
      resolve(Math.round(duration));
    });
  });
}

function transcodeToMp3(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .audioBitrate('192k')
      .format('mp3')
      .on('error', reject)
      .on('end', resolve);

    const timer = setTimeout(() => {
      try { command.kill('SIGKILL'); } catch { /* noop */ }
      reject(new Error('FFmpeg transcode timed out.'));
    }, FFMPEG_TIMEOUT_MS);
    command.on('end', () => clearTimeout(timer));
    command.on('error', () => clearTimeout(timer));

    command.save(outputPath);
  });
}

function generateWaveform(filePath, pointCount = 100) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const command = ffmpeg(filePath)
      .noVideo()
      .audioChannels(1)
      .audioFrequency(1000)
      .format('s16le')
      .on('error', reject);

    const timer = setTimeout(() => {
      try { command.kill('SIGKILL'); } catch { /* noop */ }
      reject(new Error('FFmpeg waveform generation timed out.'));
    }, FFMPEG_TIMEOUT_MS);

    const pcmStream = command.pipe();
    pcmStream.on('data', (chunk) => chunks.push(chunk));
    pcmStream.on('error', (err) => { clearTimeout(timer); reject(err); });
    pcmStream.on('end', () => {
      clearTimeout(timer);
      const pcm = Buffer.concat(chunks);
      const sampleCount = Math.floor(pcm.length / 2);
      if (sampleCount === 0) {
        return reject(new Error('No PCM samples were decoded for waveform generation.'));
      }

      const points = [];
      for (let point = 0; point < pointCount; point += 1) {
        const start = Math.floor((point * sampleCount) / pointCount);
        const end = Math.max(start + 1, Math.floor(((point + 1) * sampleCount) / pointCount));
        let peak = 0;
        for (let sample = start; sample < end && sample < sampleCount; sample += 1) {
          peak = Math.max(peak, Math.abs(pcm.readInt16LE(sample * 2)));
        }
        points.push(Number((peak / 32768).toFixed(4)));
      }
      resolve(points);
    });
  });
}

function safeProcessingError(error, tempDir = '') {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const withoutTempPath = tempDir
    ? rawMessage.split(tempDir).join('[TEMP_DIR]')
    : rawMessage;
  return withoutTempPath.slice(0, 1000);
}

function assertMediaToolsAvailable() {
  for (const command of ['ffmpeg', 'ffprobe']) {
    try {
      execFileSync(command, ['-version'], {
        stdio: 'ignore',
        timeout: 5000
      });
    } catch {
      throw new Error(`${command} is required by the audio worker but is not available.`);
    }
  }
}

async function markProcessingFailed(prisma, uploadId, trackId, error, tempDir = '') {
  const safeMessage = safeProcessingError(error, tempDir);
  await prisma.$transaction([
    prisma.track.update({
      where: { id: trackId },
      data: { status: 'FAILED' }
    }),
    prisma.upload.update({
      where: { id: uploadId },
      data: {
        status: 'FAILED',
        processingError: safeMessage,
        errorMessage: 'Audio processing failed. Please verify the file and try again.'
      }
    })
  ]);
  return safeMessage;
}

function createProcessAudioJob({ prisma, storageService = storage, logger = console }) {
  return async function processAudioJob(job) {
    const { uploadId, storageKey } = job.data;
    logger.info(`[audio:${job.id}] job started`);

    const upload = await prisma.upload.findUnique({
      where: { id: uploadId },
      include: { track: true }
    });
    if (!upload || !upload.track) {
      throw new Error('Upload or linked Track not found.');
    }
    if (!upload.storageKey || upload.storageKey !== storageKey) {
      throw new Error('Queued storage key does not match the persisted upload.');
    }

    const trackId = upload.track.id;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noirsound-'));
    const originalFilePath = path.join(tempDir, 'original_audio');
    const processedFilePath = path.join(tempDir, 'processed_audio.mp3');

    try {
      const originalStream = await storageService.getObjectStream(storageKey);
      await pipeline(originalStream, fs.createWriteStream(originalFilePath));
      logger.info(`[audio:${job.id}] original downloaded`);

      // Magic-byte verification: the declared MIME at presign time is
      // client-controlled, so verify the actual bytes are real audio before
      // doing any further processing.
      assertAudioSignature(originalFilePath, upload.mimeType);
      logger.info(`[audio:${job.id}] signature verified`);

      const durationSeconds = await probeDuration(originalFilePath);
      logger.info(`[audio:${job.id}] ffprobe duration ${durationSeconds}s`);

      await transcodeToMp3(originalFilePath, processedFilePath);
      logger.info(`[audio:${job.id}] transcode completed`);

      const waveform = await generateWaveform(processedFilePath);
      const waveformJson = JSON.stringify(waveform);

      const processedAudioKey =
        `processed/${upload.userId}/${trackId}/stream.mp3`;
      await storageService.putObject(
        processedAudioKey,
        fs.createReadStream(processedFilePath),
        'audio/mpeg'
      );
      logger.info(`[audio:${job.id}] processed object uploaded`);

      await prisma.$transaction([
        prisma.track.update({
          where: { id: trackId },
          data: {
            durationSeconds,
            waveformJson,
            processedAudioKey,
            status: 'PUBLISHED',
            publishedAt: new Date()
          }
        }),
        prisma.upload.update({
          where: { id: uploadId },
          data: {
            status: 'READY',
            processingError: null,
            errorMessage: null
          }
        })
      ]);
      logger.info(`[audio:${job.id}] database updated`);
      logger.info(`[audio:${job.id}] job completed`);

      return {
        uploadId,
        trackId,
        processedAudioKey,
        durationSeconds
      };
    } catch (error) {
      logger.error(`[audio:${job.id}] processing failed`, error);
      try {
        await markProcessingFailed(prisma, uploadId, trackId, error, tempDir);
      } catch (statusError) {
        logger.error(`[audio:${job.id}] failed to persist failure state`, statusError);
      }
      throw error;
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

function startWorker() {
  assertMediaToolsAvailable();
  const prisma = createPrismaClient();
  const processAudioJob = createProcessAudioJob({ prisma });
  const worker = new Worker('audioProcessingQueue', processAudioJob, {
    connection: getRedisConnection(),
    concurrency: Number(process.env.AUDIO_WORKER_CONCURRENCY || 2)
  });

  worker.on('completed', (job) => {
    console.info(`[audio:${job.id}] BullMQ completion acknowledged`);
  });
  worker.on('failed', (job, error) => {
    console.error(`[audio:${job?.id || 'unknown'}] BullMQ job failed: ${error.message}`);
  });
  worker.on('error', (error) => {
    console.error('[audio-worker] worker error', error);
  });

  const shutdown = async (signal) => {
    console.info(`[audio-worker] ${signal} received, shutting down`);
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  console.info('Audio processing worker started.');
  return worker;
}

if (require.main === module) {
  startWorker();
}

module.exports = {
  assertAudioSignature,
  assertMediaToolsAvailable,
  createProcessAudioJob,
  generateWaveform,
  markProcessingFailed,
  probeDuration,
  safeProcessingError,
  startWorker,
  transcodeToMp3,
  FFPROBE_TIMEOUT_MS,
  FFMPEG_TIMEOUT_MS,
  MAX_AUDIO_DURATION_SECONDS
};
