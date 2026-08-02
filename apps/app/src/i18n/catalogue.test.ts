import { describe, expect, it } from 'vitest';
import { catalogue } from './catalogue';
import { t } from './index';

describe('i18n catalogue', () => {
  it('resolves every key to a non-empty string', () => {
    for (const key of Object.keys(catalogue) as (keyof typeof catalogue)[]) {
      expect(t(key).length).toBeGreaterThan(0);
    }
  });

  it('never embeds a hardcoded instance host', () => {
    const joined = Object.values(catalogue).join('\n');
    expect(joined).not.toMatch(/https?:\/\/(?!locus\.example\.com)[a-z0-9.-]+\.[a-z]{2,}/i);
  });
});
