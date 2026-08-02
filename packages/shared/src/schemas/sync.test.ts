import { describe, expect, it } from 'vitest';

import {
  emptySyncChanges,
  SYNCED_TABLES,
  SyncErrorHttpStatus,
  SyncPullQuerySchema,
  SyncPullResponseSchema,
  SyncPushRequestSchema,
  SyncPushResponseSchema,
} from './sync.js';

describe('sync wire contract (DESIGN §5)', () => {
  it('lists every synced table once', () => {
    expect(new Set(SYNCED_TABLES).size).toBe(SYNCED_TABLES.length);
    expect(SYNCED_TABLES).toContain('areas');
    expect(SYNCED_TABLES).toContain('points');
    expect(SYNCED_TABLES).toContain('shares');
  });

  it('requires all table keys on pull even when empty', () => {
    const parsed = SyncPullResponseSchema.safeParse({
      changes: emptySyncChanges(),
      timestamp: 41822,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      for (const table of SYNCED_TABLES) {
        expect(parsed.data.changes[table]).toEqual({
          created: [],
          updated: [],
          deleted: [],
        });
      }
    }
  });

  it('parses pull query with cursor=0 as full sync', () => {
    const parsed = SyncPullQuerySchema.safeParse({
      cursor: '0',
      device_id: '018f0000-0000-7000-8000-0000000000aa',
      schema_version: '1',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.cursor).toBe(0);
      expect(parsed.data.schema_version).toBe(1);
    }
  });

  it('parses a push request and response with rejections', () => {
    const request = SyncPushRequestSchema.safeParse({
      push_id: '018f0000-0000-7000-8000-0000000000bb',
      cursor: 41822,
      device_id: '018f0000-0000-7000-8000-0000000000aa',
      changes: { points: { created: [], updated: [], deleted: [] } },
    });
    expect(request.success).toBe(true);

    const response = SyncPushResponseSchema.safeParse({
      applied: 0,
      timestamp: 41822,
      rejected: [
        {
          table: 'points',
          id: '018f0000-0000-7000-8000-0000000000cc',
          code: 'FORBIDDEN',
          message: 'not permitted',
        },
      ],
    });
    expect(response.success).toBe(true);
  });

  it('maps error codes to the documented HTTP statuses', () => {
    expect(SyncErrorHttpStatus.PULL_REQUIRED).toBe(409);
    expect(SyncErrorHttpStatus.CURSOR_TOO_OLD).toBe(409);
    expect(SyncErrorHttpStatus.SCHEMA_VERSION_UNSUPPORTED).toBe(426);
    expect(SyncErrorHttpStatus.FORBIDDEN).toBe(403);
    expect(SyncErrorHttpStatus.VALIDATION_FAILED).toBe(422);
  });
});
