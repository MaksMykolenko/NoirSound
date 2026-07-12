import { describe, expect, it } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { getBaseTitle, setBaseTitle } from '../pageTitle';
import PageMeta from '../../components/meta/PageMeta';

describe('pageTitle', () => {
  it('ignores empty titles and keeps the last non-empty base title', () => {
    setBaseTitle('NoirSound — Test');
    setBaseTitle('');
    setBaseTitle(null);
    expect(getBaseTitle()).toBe('NoirSound — Test');
  });

  it('is kept in sync by PageMeta so overlays can restore the page title', () => {
    render(<PageMeta title="Track Title — Artist · NoirSound" />);
    expect(getBaseTitle()).toBe('Track Title — Artist · NoirSound');
    // Simulate the now-playing overlay ending: restoring the base title must
    // return the PageMeta-owned value, not a hardcoded marketing string.
    document.title = '▶ Some Track • Artist';
    document.title = getBaseTitle();
    expect(document.title).toBe('Track Title — Artist · NoirSound');
    cleanup();
  });
});
