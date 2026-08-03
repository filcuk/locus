import { describe, expect, it } from 'vitest';

import {
  isTagAssignableByViewer,
  isTagInViewerCatalog,
} from './tags';

describe('tag visibility helpers', () => {
  it('keeps user tags in catalog for owner only', () => {
    expect(
      isTagInViewerCatalog({ scope: 'user', ownerId: 'u1' }, 'u1'),
    ).toBe(true);
    expect(
      isTagInViewerCatalog({ scope: 'user', ownerId: 'u1' }, 'u2'),
    ).toBe(false);
    expect(
      isTagInViewerCatalog({ scope: 'system', ownerId: null }, 'u2'),
    ).toBe(true);
  });

  it('blocks retired and foreign user tags from assignment', () => {
    expect(
      isTagAssignableByViewer(
        { scope: 'system', ownerId: null, retiredAt: null },
        'u1',
      ),
    ).toBe(true);
    expect(
      isTagAssignableByViewer(
        { scope: 'user', ownerId: 'u1', retiredAt: null },
        'u1',
      ),
    ).toBe(true);
    expect(
      isTagAssignableByViewer(
        { scope: 'user', ownerId: 'u1', retiredAt: null },
        'u2',
      ),
    ).toBe(false);
    expect(
      isTagAssignableByViewer(
        { scope: 'user', ownerId: 'u1', retiredAt: new Date() },
        'u1',
      ),
    ).toBe(false);
  });
});
