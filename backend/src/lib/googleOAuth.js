const crypto = require('crypto');

function oauthConfig(env = process.env) {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = env.GOOGLE_REDIRECT_URI?.trim();
  return {
    clientId,
    clientSecret,
    redirectUri,
    enabled: Boolean(clientId && clientSecret && redirectUri)
  };
}

function safeReturnTo(value) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  ) {
    return '/';
  }
  // The URL parser strips tabs/newlines before resolving URLs. Validate the
  // resolved origin as well as the source string, so a return path cannot
  // become a protocol-relative external redirect after normalization.
  const localOrigin = 'https://noirsound.invalid';
  try {
    if (new URL(value, localOrigin).origin !== localOrigin) return '/';
  } catch {
    return '/';
  }
  return value;
}

function secureEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function usernameBase({ email = '', name = '' } = {}) {
  const source = email.split('@')[0] || name || 'listener';
  const normalized = source
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  return normalized || 'listener';
}

async function uniqueUsername(prisma, profile) {
  const base = usernameBase(profile);
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}_${suffix}`;
    const existing = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true }
    });
    if (!existing) return candidate;
  }
  return `${base}_${crypto.randomBytes(4).toString('hex')}`;
}

module.exports = {
  oauthConfig,
  safeReturnTo,
  secureEqual,
  usernameBase,
  uniqueUsername
};
