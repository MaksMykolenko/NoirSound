import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import { getApiErrorMessage } from '../apiErrorMessage';

describe('getApiErrorMessage', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); });
  afterEach(async () => { await i18n.changeLanguage('en'); });

  it('maps CSRF_VALIDATION_FAILED to a friendly English message, never the raw code', () => {
    const msg = getApiErrorMessage({
      code: 'CSRF_VALIDATION_FAILED',
      status: 403,
      message: 'CSRF_VALIDATION_FAILED',
    });
    expect(msg).toBe('Your secure session expired. Please refresh the page and try again.');
    expect(msg).not.toContain('CSRF_VALIDATION_FAILED');
  });

  it('localizes the CSRF message (Ukrainian)', async () => {
    await i18n.changeLanguage('uk');
    const msg = getApiErrorMessage({ code: 'CSRF_VALIDATION_FAILED', status: 403 });
    expect(msg).toBe('Безпечна сесія застаріла. Оновіть сторінку й спробуйте ще раз.');
  });

  it('returns a human-readable server message unchanged', () => {
    expect(getApiErrorMessage({ code: null, message: 'Display name is required.' }))
      .toBe('Display name is required.');
  });

  it('never surfaces an unknown raw SCREAMING_SNAKE code; falls back to generic', () => {
    expect(getApiErrorMessage({ code: 'SOME_UNKNOWN_CODE', message: 'SOME_UNKNOWN_CODE' }))
      .toBe('Something went wrong. Please try again.');
  });

  it('maps network failures (status 0) to a friendly message', () => {
    expect(getApiErrorMessage({ status: 0, message: 'Network offline' }))
      .toBe('Network error. Please check your connection and try again.');
  });
});
