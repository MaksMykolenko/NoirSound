/**
 * Public Beta sprint — isolated unit tests (no database required).
 * Runnable with: npx vitest run tests/publicBeta.unit.test.js
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import jwt from 'jsonwebtoken';

import {
  evaluateConfig,
  isWeakSecret,
  isPlaceholderValue,
  getAllowedOrigins
} from '../src/config.js';
import { isCsrfSafe } from '../src/plugins/csrf.js';
import {
  detectMediaType,
  isAllowedAudioSignature,
  signatureMatchesDeclared
} from '../src/lib/fileSignature.js';
import { hashToken, newSessionId, sessionExpiry } from '../src/lib/session.js';
import {
  safeReturnTo,
  secureEqual,
  usernameBase
} from '../src/lib/googleOAuth.js';
import { userOrIpKey } from '../src/lib/rateLimitKeys.js';
import { scaledRateLimitMax } from '../src/lib/rateLimit.js';
import { serializePublicTrack } from '../src/lib/publicTrack.js';
import {
  assertAudioSignature,
  probeDuration,
  transcodeToMp3,
  generateWaveform,
  MAX_AUDIO_DURATION_SECONDS
} from '../src/workers/audioProcessor.js';

const STRONG = 'b3f1c9a47d2e4f8a9c0b1d2e3f4a5b6c7d8e9f0a1b2c3d4e';
const STRONG2 = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718';
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));

describe('profile banner pending-object lifecycle', () => {
  it('expires only the pending prefix after one day in local and production MinIO setup', () => {
    const composeFiles = [
      path.resolve(TEST_DIR, '../docker-compose.yml'),
      path.resolve(TEST_DIR, '../../docker-compose.production.yml'),
    ];

    for (const composeFile of composeFiles) {
      const source = fs.readFileSync(composeFile, 'utf8');
      expect(source).toMatch(
        /mc ilm rule add --prefix 'profile-banner-pending\/' --expire-days 1/
      );
      expect(source).not.toMatch(
        /mc ilm rule add --prefix 'users\/' --expire-days 1/
      );
    }
  });
});

describe('config / secret validation', () => {
  it('flags weak secrets and accepts strong ones', () => {
    expect(isWeakSecret('secret')).toBe(true);
    expect(isWeakSecret('short')).toBe(true);
    expect(isWeakSecret('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe(true);
    expect(isWeakSecret(STRONG)).toBe(false);
  });

  it('detects production template placeholders', () => {
    expect(isPlaceholderValue('CHANGE_ME_LONG_RANDOM')).toBe(true);
    expect(isPlaceholderValue('https://example.com')).toBe(true);
    expect(isPlaceholderValue(STRONG)).toBe(false);
  });

  it('requires core secrets in any environment', () => {
    const { errors } = evaluateConfig({ NODE_ENV: 'development' });
    expect(errors.join(' ')).toMatch(/JWT_SECRET/);
    expect(errors.join(' ')).toMatch(/COOKIE_SECRET/);
    expect(errors.join(' ')).toMatch(/DATABASE_URL/);
  });

  it('rejects weak/missing secrets in production', () => {
    const { errors } = evaluateConfig({
      NODE_ENV: 'production',
      JWT_SECRET: 'secret',
      COOKIE_SECRET: 'secret',
      DATABASE_URL: 'postgres://x',
      REDIS_URL: 'redis://x',
      S3_ACCESS_KEY_ID: 'k', S3_SECRET_ACCESS_KEY: 'minioadmin', S3_BUCKET: 'b'
    });
    expect(errors.join(' ')).toMatch(/JWT_SECRET is too weak/);
    expect(errors.join(' ')).toMatch(/FRONTEND_ORIGIN is required/);
    expect(errors.join(' ')).toMatch(/S3_SECRET_ACCESS_KEY/);
  });

  it('rejects copied production templates before boot', () => {
    const { errors } = evaluateConfig({
      NODE_ENV: 'production',
      JWT_SECRET: 'CHANGE_ME_LONG_RANDOM_CHANGE_ME_LONG_RANDOM',
      COOKIE_SECRET: 'CHANGE_ME_LONG_RANDOM_DIFFERENT_SECRET',
      DATABASE_URL: 'postgresql://noirsound:CHANGE_ME_LONG_RANDOM@postgres:5432/noirsound',
      REDIS_URL: 'redis://redis:6379',
      FRONTEND_ORIGIN: 'https://example.com',
      S3_PUBLIC_ENDPOINT: 'https://example.com',
      S3_ACCESS_KEY_ID: 'CHANGE_ME',
      S3_SECRET_ACCESS_KEY: 'CHANGE_ME_LONG_RANDOM',
      S3_BUCKET: 'noirsound-audio'
    });
    expect(errors.join(' ')).toMatch(/placeholder value/);
  });

  it('passes a well-formed production config', () => {
    const { errors } = evaluateConfig({
      NODE_ENV: 'production',
      JWT_SECRET: STRONG,
      COOKIE_SECRET: STRONG2,
      DATABASE_URL: 'postgres://x',
      REDIS_URL: 'redis://x',
      FRONTEND_ORIGIN: 'https://noirsound.app',
      S3_PUBLIC_ENDPOINT: 'https://noirsound.app',
      S3_ACCESS_KEY_ID: 'AKIAEXAMPLE', S3_SECRET_ACCESS_KEY: STRONG, S3_BUCKET: 'b',
      GOOGLE_CLIENT_ID: '123.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: STRONG,
      GOOGLE_REDIRECT_URI: 'https://noirsound.app/api/auth/google/callback'
    });
    expect(errors).toEqual([]);
  });

  it('parses multi-origin allowlists', () => {
    expect(getAllowedOrigins({ FRONTEND_ORIGIN: 'https://a.com, https://b.com' }))
      .toEqual(['https://a.com', 'https://b.com']);
  });
});

describe('Google OAuth helpers', () => {
  it('accepts local return paths and rejects external redirects', () => {
    expect(safeReturnTo('/library?tab=likes')).toBe('/library?tab=likes');
    expect(safeReturnTo('https://evil.example')).toBe('/');
    expect(safeReturnTo('//evil.example')).toBe('/');
    expect(safeReturnTo('/\\evil.example')).toBe('/');
  });

  it('compares OAuth state values and creates safe username bases', () => {
    expect(secureEqual('state-value', 'state-value')).toBe(true);
    expect(secureEqual('state-value', 'different')).toBe(false);
    expect(usernameBase({ email: 'Jane.Doe+music@example.com' })).toBe('jane_doe_music');
    expect(usernameBase({ email: '🎵@example.com' })).toBe('listener');
  });
});

describe('CSRF origin guard', () => {
  const allowed = ['https://noirsound.app'];
  it('allows safe methods', () => {
    expect(isCsrfSafe({ method: 'GET', hasSessionCookie: true, origin: 'https://evil.com', allowedOrigins: allowed })).toBe(true);
  });
  it('allows requests without a session cookie', () => {
    expect(isCsrfSafe({ method: 'POST', hasSessionCookie: false, origin: 'https://evil.com', allowedOrigins: allowed })).toBe(true);
  });
  it('blocks credentialed cross-origin POST', () => {
    expect(isCsrfSafe({ method: 'POST', hasSessionCookie: true, origin: 'https://evil.com', allowedOrigins: allowed })).toBe(false);
  });
  it('allows credentialed same-origin POST', () => {
    expect(isCsrfSafe({ method: 'POST', hasSessionCookie: true, origin: 'https://noirsound.app', allowedOrigins: allowed })).toBe(true);
  });
  it('allows non-browser clients (no origin, no referer)', () => {
    expect(isCsrfSafe({ method: 'POST', hasSessionCookie: true, allowedOrigins: allowed })).toBe(true);
  });
  it('validates by referer when origin absent', () => {
    expect(isCsrfSafe({ method: 'POST', hasSessionCookie: true, referer: 'https://noirsound.app/x', allowedOrigins: allowed })).toBe(true);
    expect(isCsrfSafe({ method: 'POST', hasSessionCookie: true, referer: 'https://evil.com/x', allowedOrigins: allowed })).toBe(false);
  });
});

describe('CSRF same-origin (Origin/Referer == Host) guard', () => {
  // Allowlist deliberately does NOT contain www — the same-origin Host check
  // must still accept a genuine same-origin save from the host being served.
  const allowed = ['https://noirsound.app'];

  it('accepts a same-origin POST whose Origin host matches Host even if not allowlisted', () => {
    expect(isCsrfSafe({
      method: 'POST', hasSessionCookie: true,
      origin: 'https://www.noirsound.app', host: 'www.noirsound.app',
      allowedOrigins: allowed
    })).toBe(true);
  });

  it('accepts a same-origin POST validated by Referer host', () => {
    expect(isCsrfSafe({
      method: 'POST', hasSessionCookie: true,
      referer: 'https://www.noirsound.app/profile', host: 'www.noirsound.app',
      allowedOrigins: allowed
    })).toBe(true);
  });

  it('still blocks a cross-origin POST even when a Host header is present', () => {
    expect(isCsrfSafe({
      method: 'POST', hasSessionCookie: true,
      origin: 'https://evil.com', host: 'noirsound.app',
      allowedOrigins: allowed
    })).toBe(false);
  });

  it('still blocks a cross-origin POST validated by Referer when Host differs', () => {
    expect(isCsrfSafe({
      method: 'POST', hasSessionCookie: true,
      referer: 'https://evil.com/attack', host: 'noirsound.app',
      allowedOrigins: allowed
    })).toBe(false);
  });

  it('falls back to the allowlist when Origin host does not match Host', () => {
    // e.g. an intentionally configured cross-origin client; Host is the internal
    // upstream and does not match, but the Origin is explicitly allowlisted.
    expect(isCsrfSafe({
      method: 'POST', hasSessionCookie: true,
      origin: 'https://noirsound.app', host: 'backend:3000',
      allowedOrigins: allowed
    })).toBe(true);
  });

  it('treats an unparseable "null" Origin as not same-origin and rejects it', () => {
    expect(isCsrfSafe({
      method: 'POST', hasSessionCookie: true,
      origin: 'null', host: 'noirsound.app',
      allowedOrigins: allowed
    })).toBe(false);
  });
});

describe('file signature detection', () => {
  it('detects WAV/MP3/PNG/JPEG', () => {
    const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE')]);
    expect(detectMediaType(wav)).toBe('audio/wav');
    expect(detectMediaType(Buffer.from('ID3\x03'))).toBe('audio/mpeg');
    expect(detectMediaType(Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]))).toBe('image/png');
    expect(detectMediaType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
  });
  it('rejects scripts / executables as audio', () => {
    expect(isAllowedAudioSignature(Buffer.from('#!/bin/sh\n'))).toBe(false);
    expect(isAllowedAudioSignature(Buffer.from([0x4d, 0x5a, 0x90, 0x00]))).toBe(false); // PE
    expect(isAllowedAudioSignature(Buffer.from('%PDF-1.7'))).toBe(false);
  });
  it('matches declared mime to bytes', () => {
    const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE')]);
    expect(signatureMatchesDeclared('audio/wav', wav)).toBe(true);
    expect(signatureMatchesDeclared('audio/mpeg', wav)).toBe(false);
  });
});

describe('session helpers', () => {
  it('hashes tokens deterministically and uniquely', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
    expect(hashToken('abc')).toHaveLength(64);
  });
  it('creates unique session ids and future expiries', () => {
    expect(newSessionId()).not.toBe(newSessionId());
    expect(sessionExpiry(7).getTime()).toBeGreaterThan(Date.now());
  });
});

describe('rate-limit keys and public track serialization', () => {
  it('never scales production limits', () => {
    expect(scaledRateLimitMax(5, {
      NODE_ENV: 'production',
      RATE_LIMIT_MULTIPLIER: '20'
    })).toBe(5);
    expect(scaledRateLimitMax(5, {
      NODE_ENV: 'test',
      RATE_LIMIT_MULTIPLIER: '20'
    })).toBe(100);
  });

  it('uses a verified user id and rejects forged rate-limit identities', () => {
    const secret = process.env.JWT_SECRET;
    const token = jwt.sign({ userId: 'user-1' }, secret);
    expect(userOrIpKey({
      headers: { cookie: `token=${encodeURIComponent(token)}` },
      ip: '127.0.0.1'
    })).toBe('user:user-1');

    const forged = jwt.sign({ userId: 'victim' }, 'wrong-secret');
    expect(userOrIpKey({
      headers: { cookie: `token=${encodeURIComponent(forged)}` },
      ip: '127.0.0.1'
    })).toBe('ip:127.0.0.1');
  });

  it('never exposes private object keys in a public track payload', () => {
    const result = serializePublicTrack({
      id: 'track-1',
      status: 'PUBLISHED',
      originalAudioKey: 'uploads/private.wav',
      processedAudioKey: 'processed/private.mp3',
      coverImageKey: 'uploads/private.png',
      mimeType: 'audio/wav',
      fileSize: 42,
      copyrightConfirmed: true
    });
    expect(result).not.toHaveProperty('originalAudioKey');
    expect(result).not.toHaveProperty('processedAudioKey');
    expect(result).not.toHaveProperty('coverImageKey');
    expect(result).not.toHaveProperty('mimeType');
    expect(result).not.toHaveProperty('fileSize');
    expect(result.hasCoverImage).toBe(true);
    expect(result.isStreamable).toBe(true);
  });
});

describe('worker media pipeline (real ffmpeg)', () => {
  let tmpDir;
  let wavPath;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noirsound-test-'));
    wavPath = path.join(tmpDir, 'sine.wav');
    // 2-second 440Hz sine as a real, valid WAV file.
    execFileSync('ffmpeg', ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-y', wavPath], { stdio: 'ignore' });
  });

  it('accepts a real audio file signature and rejects junk', () => {
    expect(() => assertAudioSignature(wavPath, 'audio/wav')).not.toThrow();
    expect(() => assertAudioSignature(wavPath, 'audio/mpeg')).toThrow(/declared MIME type/);
    const junk = path.join(tmpDir, 'junk.bin');
    fs.writeFileSync(junk, 'this is definitely not audio');
    expect(() => assertAudioSignature(junk)).toThrow(/not a recognized audio/);
  });

  it('probes duration within the allowed maximum', async () => {
    const d = await probeDuration(wavPath);
    expect(d).toBeGreaterThanOrEqual(1);
    expect(d).toBeLessThanOrEqual(MAX_AUDIO_DURATION_SECONDS);
  });

  it('transcodes to mp3 and generates a deterministic waveform', async () => {
    const mp3 = path.join(tmpDir, 'out.mp3');
    await transcodeToMp3(wavPath, mp3);
    expect(fs.existsSync(mp3)).toBe(true);
    expect(fs.statSync(mp3).size).toBeGreaterThan(0);

    const wave = await generateWaveform(mp3);
    expect(wave).toHaveLength(100);
    expect(wave.every((n) => n >= 0 && n <= 1)).toBe(true);
  });
});
