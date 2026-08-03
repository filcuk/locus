import { describe, expect, it } from 'vitest';

import { markdownToSafeHtml } from '../src/services/markdown.js';

describe('markdownToSafeHtml', () => {
  it('renders basic markdown', () => {
    const html = markdownToSafeHtml('**hello**');
    expect(html).toContain('<strong>hello</strong>');
  });

  it('strips raw HTML from the source and sanitises output', () => {
    const html = markdownToSafeHtml(
      'Safe\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>',
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).toContain('Safe');
  });

  it('keeps http links', () => {
    const html = markdownToSafeHtml('[x](https://example.com)');
    expect(html).toContain('href="https://example.com"');
  });
});
