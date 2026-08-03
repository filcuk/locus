import { describe, expect, it } from 'vitest';

import { MARKED_OPTIONS, noRawHtmlMarkedExtension } from './options.js';

describe('shared marked options', () => {
  it('keeps GFM on and raw-HTML renderer empty', () => {
    expect(MARKED_OPTIONS.gfm).toBe(true);
    expect(MARKED_OPTIONS.breaks).toBe(false);
    expect(MARKED_OPTIONS.pedantic).toBe(false);
    expect(noRawHtmlMarkedExtension.renderer.html()).toBe('');
  });
});
