import { describe, expect, it } from 'vitest';
import registrationValidation from '../src/lib/registrationValidation.js';
const { validateRegistration, validateCreatorInput } = registrationValidation;
const valid = { email: 'person@example.test', username: 'person_123', displayName: 'A Person', password: 'eight-ok' };
function expectCode(payload, code) {
  try { validateRegistration(payload); throw new Error('Expected validation failure'); }
  catch (error) { expect(error.code).toBe(code); }
}

describe('authoritative registration policy', () => {
  it('normalizes identifiers and preserves password whitespace without composition requirements', () => {
    expect(validateRegistration({ ...valid, email: ' Person@Example.Test ', username: ' Person_123 ', password: ' eight spaces ' }))
      .toMatchObject({ email: valid.email, username: valid.username, password: ' eight spaces ', creator: null });
    expect(validateRegistration({ ...valid, password: 'abcdefgh' }).password).toBe('abcdefgh');
  });
  it.each(['bad', 'a b@example.test', 'a@@example.test', 'a@localhost', 'a@example..test', '.a@example.test', 'a..b@example.test', 'a@bad_domain.test', 'a@-bad.test', 'a'.repeat(65) + '@example.test', 'a@' + 'x'.repeat(250) + '.test', null, 12])('rejects malformed email %j', email => expectCode({ ...valid, email }, 'REGISTER_EMAIL_INVALID'));
  it.each(['x', 'xy', 'x'.repeat(33), 'bad name', '<script>', 'foo/bar', null, 123])('rejects malformed username %j', username => expectCode({ ...valid, username }, 'REGISTER_USERNAME_INVALID'));
  it.each(['a', ' '.repeat(8), 'x'.repeat(129), 'abcdefgh\u0000', null, 123, {}])('rejects malformed password %j', password => expectCode({ ...valid, password }, 'REGISTER_PASSWORD_INVALID'));
  it.each(['', ' ', 'x'.repeat(121), 'line\nfeed', null, 123])('rejects malformed displayName %j', displayName => expectCode({ ...valid, displayName }, 'REGISTER_DISPLAY_NAME_INVALID'));
  it.each(['ADMIN', 'SUPERADMIN', '', null, false, {}, ['ARTIST']])('rejects malformed creator type %j', creatorType => expectCode({ ...valid, creatorType }, 'REGISTER_CREATOR_TYPE_INVALID'));
  it.each(['true', 'false', 0, 1, null, {}])('rejects coercible creator intents %j', intendsMusic => expectCode({ ...valid, creatorType: 'BOTH', intendsMusic }, 'REGISTER_INTENT_INVALID'));
  it.each(['javascript:alert(1)', 'ftp://example.test', 'https://name:password@example.test', 123, {}, 'https://example.test/' + 'x'.repeat(2048)])('rejects unsafe portfolio URLs %j', portfolioUrl => expectCode({ ...valid, creatorType: 'ARTIST', portfolioUrl }, 'INVALID_URL'));
  it.each(['ARTIST', 'BEATMAKER', 'BOTH'])('keeps %s creator classification separate from account privileges', creatorType => {
    const result = validateRegistration({ ...valid, creatorType, role: 'ADMIN', permissions: ['pii.read'], canUploadTracks: true, status: 'ACTIVE' });
    expect(result.creator.creatorType).toBe(creatorType);
    expect(result).not.toHaveProperty('role');
    expect(result.creator).not.toHaveProperty('permissions');
    expect(result.creator).not.toHaveProperty('canUploadTracks');
  });
  it('validates onboarding and only emits creator-owned fields', () => {
    expect(validateCreatorInput({ creatorType: 'BEATMAKER', intendsMusic: false, note: ' my note ', adminNote: 'not mine', status: 'ENABLED' }, 'Existing Name'))
      .toEqual({ creatorType: 'BEATMAKER', intendsMusic: false, intendsBeats: true, displayName: 'Existing Name', note: 'my note', portfolioUrl: null, primaryPlatformUrl: null });
  });
});
