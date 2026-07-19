export const MAX_PROFILE_BANNER_BYTES = 8 * 1024 * 1024;

export const ALLOWED_PROFILE_BANNER_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export function validateProfileBannerFile(file) {
  if (!file || !ALLOWED_PROFILE_BANNER_TYPES.has(file.type)) return 'type';
  if (file.size <= 0 || file.size > MAX_PROFILE_BANNER_BYTES) return 'size';
  return null;
}
