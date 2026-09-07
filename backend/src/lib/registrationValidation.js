'use strict';

const { CREATOR_TYPES, MAX_DISPLAY_NAME_LENGTH, MAX_NOTE_LENGTH, sanitizeUrl } = require('./creators');

class RegistrationValidationError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
function invalid(code, message) { throw new RegistrationValidationError(code, message); }
function hasControlCharacters(value, allowLineBreaks = false) {
  return Array.from(value).some(character => {
    const code = character.codePointAt(0);
    return (code < 32 || code === 127) && !(allowLineBreaks && [9, 10, 13].includes(code));
  });
}

// Registration policy: canonical identifiers; modest password length without
// composition rules. Never trim passwords or silently truncate submitted values.
function validateEmail(value) {
  if (typeof value !== 'string') invalid('REGISTER_EMAIL_INVALID', 'Enter a valid email address.');
  const email = value.trim().toLowerCase();
  const [local, domain] = email.split('@');
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>.]+(?:\.[^\s@<>.]+)+$/.test(email)
    || local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')
    || !domain?.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
    || hasControlCharacters(email)) {
    invalid('REGISTER_EMAIL_INVALID', 'Enter a valid email address.');
  }
  return email;
}

function validateUsername(value) {
  const username = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!/^[a-z0-9_]{3,32}$/.test(username)) {
    invalid('REGISTER_USERNAME_INVALID', 'Username must contain 3–32 letters, numbers, or underscores.');
  }
  return username;
}

function validateDisplayName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || name.length > MAX_DISPLAY_NAME_LENGTH || hasControlCharacters(name)) {
    invalid('REGISTER_DISPLAY_NAME_INVALID', `Display name must contain 1–${MAX_DISPLAY_NAME_LENGTH} printable characters.`);
  }
  return name;
}

function validateCreatorInput(body, fallbackDisplayName) {
  const creatorType = body.creatorType === undefined ? 'ARTIST' : body.creatorType;
  if (!CREATOR_TYPES.includes(creatorType)) {
    invalid('REGISTER_CREATOR_TYPE_INVALID', 'Creator type must be ARTIST, BEATMAKER, or BOTH.');
  }
  for (const field of ['intendsMusic', 'intendsBeats']) {
    if (body[field] !== undefined && typeof body[field] !== 'boolean') {
      invalid('REGISTER_INTENT_INVALID', 'Creator intents must be boolean values.');
    }
  }
  if (body.note !== undefined && body.note !== null
    && (typeof body.note !== 'string' || body.note.length > MAX_NOTE_LENGTH
      || hasControlCharacters(body.note, true))) {
    invalid('REGISTER_NOTE_INVALID', `Creator note must be text of at most ${MAX_NOTE_LENGTH} characters.`);
  }
  let portfolioUrl;
  let primaryPlatformUrl;
  try {
    portfolioUrl = sanitizeUrl(body.portfolioUrl);
    primaryPlatformUrl = sanitizeUrl(body.primaryPlatformUrl);
  } catch (error) {
    invalid('INVALID_URL', error.message);
  }
  return {
    creatorType,
    intendsMusic: body.intendsMusic ?? (creatorType === 'ARTIST' || creatorType === 'BOTH'),
    intendsBeats: body.intendsBeats ?? (creatorType === 'BEATMAKER' || creatorType === 'BOTH'),
    displayName: validateDisplayName(body.displayName === undefined ? fallbackDisplayName : body.displayName),
    portfolioUrl,
    primaryPlatformUrl,
    note: body.note?.trim() || null
  };
}

function validateRegistration(body) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const email = validateEmail(input.email);
  const username = validateUsername(input.username);
  if (typeof input.password !== 'string' || input.password.length < 8
    || input.password.length > 128 || !input.password.trim() || input.password.includes('\u0000')) {
    invalid('REGISTER_PASSWORD_INVALID', 'Password must contain 8–128 characters.');
  }
  const displayName = validateDisplayName(input.displayName);
  if (input.accountType !== undefined && !['LISTENER', 'CREATOR'].includes(input.accountType)) {
    invalid('REGISTER_ACCOUNT_TYPE_INVALID', 'Account type must be LISTENER or CREATOR.');
  }
  const isCreator = input.accountType === 'CREATOR' || input.creatorType !== undefined;
  // Validate creator fields even on a listener payload: malformed values never
  // silently become valid just because a client omitted the account selector.
  const creatorInput = validateCreatorInput({ ...input, displayName }, displayName);
  return { email, username, password: input.password, displayName, creator: isCreator ? creatorInput : null };
}

module.exports = { RegistrationValidationError, validateEmail, validateUsername, validateRegistration, validateCreatorInput };
