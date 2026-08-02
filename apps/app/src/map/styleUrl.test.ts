import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_MAP_STYLE_URL, getMapStyleUrl, setMapStyleUrl } from './styleUrl';
import { MAP_ATTRIBUTION_TEXT } from './attribution';

afterEach(() => {
  setMapStyleUrl(null);
});

describe('map style URL', () => {
  it('defaults to the OpenFreeMap public style (no API key)', () => {
    expect(getMapStyleUrl()).toBe(DEFAULT_MAP_STYLE_URL);
    expect(getMapStyleUrl()).toContain('openfreemap.org');
    expect(getMapStyleUrl()).not.toMatch(/[?&]key=/i);
  });

  it('allows an operator override without baking a host into the binary', () => {
    setMapStyleUrl('https://tiles.example.com/style.json');
    expect(getMapStyleUrl()).toBe('https://tiles.example.com/style.json');
  });
});

describe('map attribution', () => {
  it('includes OpenStreetMap credit at a legible length', () => {
    expect(MAP_ATTRIBUTION_TEXT).toMatch(/OpenStreetMap/);
    expect(MAP_ATTRIBUTION_TEXT.length).toBeGreaterThan(20);
  });
});
