import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';

import { modelClasses } from './models';
import { schema } from './schema';

const adapter = new LokiJSAdapter({
  schema,
  useWebWorker: false,
  useIncrementalIndexedDB: true,
  onSetUpError: (error) => {
    console.error('WatermelonDB LokiJS setup failed', error);
  },
});

export const database = new Database({
  adapter,
  // WatermelonDB's Class<Model> typing is invariant over concrete subclasses.
  modelClasses: modelClasses as ConstructorParameters<typeof Database>[0]['modelClasses'],
});
