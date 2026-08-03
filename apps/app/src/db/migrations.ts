import { addColumns, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

/** WatermelonDB schema migrations — keep in lockstep with `schema.ts` version. */
export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'tags',
          columns: [
            { name: 'namespace', type: 'string', isOptional: true },
            { name: 'retired_at', type: 'number', isOptional: true },
          ],
        }),
        addColumns({
          table: 'taggings',
          columns: [
            { name: 'tag_label', type: 'string', isOptional: true },
            { name: 'tag_colour', type: 'string', isOptional: true },
            { name: 'tag_scope', type: 'string', isOptional: true },
            { name: 'tag_namespace', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
