'use strict';

const UPLOAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i;
function avatarUrl(userId, uploadId) {
  return `/api/public/avatars/${encodeURIComponent(userId)}/${uploadId}`;
}
function avatarKey(userId, uploadId) {
  if (!UPLOAD_ID.test(uploadId) || !/^[\w-]+$/.test(userId)) return null;
  return `profile-avatars/${userId}/${uploadId}`;
}
function ownedAvatarKey(url, userId) {
  const prefix = `/api/public/avatars/${encodeURIComponent(userId)}/`;
  if (typeof url !== 'string' || !url.startsWith(prefix)) return null;
  return avatarKey(userId, url.slice(prefix.length));
}
module.exports = { avatarUrl, avatarKey, ownedAvatarKey };
