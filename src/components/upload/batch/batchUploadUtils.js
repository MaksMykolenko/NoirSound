export const BATCH_MAX_FILES = 20;
export const BATCH_MAX_FILE_BYTES = 50 * 1024 * 1024;
export const BATCH_MAX_BYTES = 500 * 1024 * 1024;

const ACCEPTED_MIME = new Set(['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/flac', 'audio/aac', 'audio/ogg']);
const ACCEPTED_EXT = /\.(mp3|wav|flac|aac|ogg)$/i;

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '0 MB';
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function validateSelectedFiles(files, currentCount = 0, currentBytes = 0) {
  const accepted = [];
  const errors = [];
  for (const file of files) {
    if (currentCount + accepted.length >= BATCH_MAX_FILES) {
      errors.push(`Only ${BATCH_MAX_FILES} files are allowed per batch.`);
      break;
    }
    if (!ACCEPTED_MIME.has(file.type) || !ACCEPTED_EXT.test(file.name)) {
      errors.push(`${file.name}: unsupported audio type.`);
      continue;
    }
    if (file.size <= 0 || file.size > BATCH_MAX_FILE_BYTES) {
      errors.push(`${file.name}: file must be between 1 byte and 50 MB.`);
      continue;
    }
    if (currentBytes + accepted.reduce((sum, entry) => sum + entry.size, 0) + file.size > BATCH_MAX_BYTES) {
      errors.push('The batch exceeds the 500 MB total limit.');
      break;
    }
    accepted.push(file);
  }
  return { accepted, errors };
}
