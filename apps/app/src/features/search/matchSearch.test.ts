import { describe, expect, it } from 'vitest';

import { isTagVisibleToViewer, matchSearch } from './matchSearch';
import type { SearchableRecord } from './types';

function record(
  partial: Partial<SearchableRecord> &
    Pick<SearchableRecord, 'id' | 'kind' | 'title'>,
): SearchableRecord {
  return {
    description: null,
    updatedAt: 1,
    tagLabels: [],
    ...partial,
  };
}

describe('isTagVisibleToViewer', () => {
  it('shows system tags to any viewer', () => {
    expect(
      isTagVisibleToViewer({ scope: 'system', ownerId: null }, null),
    ).toBe(true);
    expect(
      isTagVisibleToViewer({ scope: 'system', ownerId: null }, 'u1'),
    ).toBe(true);
  });

  it('shows user tags only to their owner', () => {
    expect(
      isTagVisibleToViewer({ scope: 'user', ownerId: 'u1' }, 'u1'),
    ).toBe(true);
    expect(
      isTagVisibleToViewer({ scope: 'user', ownerId: 'u1' }, 'u2'),
    ).toBe(false);
    expect(
      isTagVisibleToViewer({ scope: 'user', ownerId: 'u1' }, null),
    ).toBe(false);
  });

  it('hides unknown scopes', () => {
    expect(
      isTagVisibleToViewer({ scope: 'other', ownerId: 'u1' }, 'u1'),
    ).toBe(false);
  });
});

describe('matchSearch', () => {
  const rows: SearchableRecord[] = [
    record({
      id: 'a1',
      kind: 'area',
      title: 'North Ridge',
      description: 'Windy plateau',
      updatedAt: 10,
      tagLabels: ['hike'],
    }),
    record({
      id: 'p1',
      kind: 'place',
      title: 'Camp',
      description: 'Near the ridge trail',
      updatedAt: 20,
    }),
    record({
      id: 'pt1',
      kind: 'point',
      title: 'Spring',
      updatedAt: 15,
      tagLabels: ['water'],
    }),
    record({
      id: 'c1',
      kind: 'collection',
      title: 'Weekend plans',
      description: null,
      updatedAt: 5,
    }),
  ];

  it('returns no results for an empty query', () => {
    expect(matchSearch(rows, '')).toEqual([]);
    expect(matchSearch(rows, '   ')).toEqual([]);
  });

  it('matches title case-insensitively', () => {
    const hits = matchSearch(rows, 'north ridge');
    expect(hits.map((h) => h.id)).toEqual(['a1']);
    expect(hits[0]?.matchField).toBe('title');
  });

  it('matches description when title does not', () => {
    const hits = matchSearch(rows, 'plateau');
    expect(hits.map((h) => h.id)).toEqual(['a1']);
    expect(hits[0]?.matchField).toBe('description');
  });

  it('matches visible tag labels', () => {
    const hits = matchSearch(rows, 'water');
    expect(hits.map((h) => h.id)).toEqual(['pt1']);
    expect(hits[0]?.matchField).toBe('tag');
  });

  it('prefers title over description over tag for matchField', () => {
    const tagged = record({
      id: 'x',
      kind: 'place',
      title: 'water tower',
      description: 'water tank',
      tagLabels: ['water'],
      updatedAt: 1,
    });
    expect(matchSearch([tagged], 'water')[0]?.matchField).toBe('title');
  });

  it('searches areas, places, points, and collections', () => {
    const mixed: SearchableRecord[] = [
      record({ id: 'a', kind: 'area', title: 'Alpha zone' }),
      record({ id: 'p', kind: 'place', title: 'Alpha camp' }),
      record({ id: 'pt', kind: 'point', title: 'Alpha spring' }),
      record({ id: 'c', kind: 'collection', title: 'Alpha list' }),
    ];
    const kinds = new Set(matchSearch(mixed, 'alpha').map((h) => h.kind));
    expect(kinds).toEqual(
      new Set(['area', 'place', 'point', 'collection']),
    );
  });

  it('orders by updatedAt descending then title', () => {
    const ordered = [
      record({ id: 'old', kind: 'place', title: 'Zed match', updatedAt: 1 }),
      record({ id: 'new', kind: 'place', title: 'Ada match', updatedAt: 9 }),
      record({ id: 'mid-b', kind: 'place', title: 'Bob match', updatedAt: 5 }),
      record({ id: 'mid-a', kind: 'place', title: 'Ann match', updatedAt: 5 }),
    ];
    expect(matchSearch(ordered, 'match').map((h) => h.id)).toEqual([
      'new',
      'mid-a',
      'mid-b',
      'old',
    ]);
  });

  it('does not use another viewer private tag labels (pre-filtered)', () => {
    // Caller must omit private labels — matching only sees tagLabels given.
    const onlyOwn = record({
      id: 'p2',
      kind: 'place',
      title: 'Shared hut',
      tagLabels: ['mine'],
      updatedAt: 1,
    });
    expect(matchSearch([onlyOwn], 'secret')).toEqual([]);
    expect(matchSearch([onlyOwn], 'mine').map((h) => h.id)).toEqual(['p2']);
  });
});
