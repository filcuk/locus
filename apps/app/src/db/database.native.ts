import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { modelClasses } from './models';
import { migrations } from './migrations';
import { schema } from './schema';

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: true,
  onSetUpError: (error) => {
    console.error('WatermelonDB SQLite setup failed', error);
  },
});

export const database = new Database({
  adapter,
  // WatermelonDB's Class<Model> typing is invariant over concrete subclasses.
  modelClasses: modelClasses as ConstructorParameters<typeof Database>[0]['modelClasses'],
});
