import { afterEach, describe, expect, it } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import PageMeta from '../PageMeta';

describe('PageMeta', () => {
  afterEach(cleanup);

  it('updates document title, description, and canonical on render', () => {
    render(
      <PageMeta
        title="Track Title — Artist · NoirSound"
        description="A great track on NoirSound."
        canonical="https://noirsound.co/track/abc"
      />
    );
    expect(document.title).toBe('Track Title — Artist · NoirSound');
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content'))
      .toBe('A great track on NoirSound.');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href'))
      .toBe('https://noirsound.co/track/abc');
  });

  it('reuses (does not duplicate) the description + canonical elements across renders', () => {
    render(<PageMeta title="One" description="d1" canonical="https://noirsound.co/a" />);
    render(<PageMeta title="Two" description="d2" canonical="https://noirsound.co/b" />);
    expect(document.head.querySelectorAll('meta[name="description"]').length).toBe(1);
    expect(document.head.querySelectorAll('link[rel="canonical"]').length).toBe(1);
    expect(document.title).toBe('Two');
  });
});
